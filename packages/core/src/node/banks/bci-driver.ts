import type { BrowserContext, Page, Response } from 'playwright';

import { matchCuenta } from '../../accounts/match-cuenta.js';
import { bundleHeaders, mainScriptOf, withToken } from '../../banks/bci/bundle.js';
import { BCI } from '../../banks/bci/config.js';
import {
  classifyDocumentResponse,
  isLoggedInUrl,
  isTokenCall,
  pageMessage,
} from '../../banks/bci/login-flow.js';
import {
  grantExpiry,
  judgeApiAnswer,
  parseCuentas,
  parseMovimientos,
  parseSaldo,
  parseTokenAnswer,
} from '../../banks/bci/reads.js';
import {
  groupByAccount,
  matchTarjeta,
  parseInformacionTarjeta,
  parseTarjetasLista,
} from '../../banks/bci/cards.js';
import type {
  Cartola,
  Cobertura,
  Cuenta,
  EstadoTarjetas,
  Movimiento,
  MovimientoTarjeta,
  Saldo,
  Tarjeta,
} from '../../domain/types.js';
import {
  BankBlocked,
  BankError,
  CtaError,
  LoginCancelled,
  NotAuthenticated,
} from '../../errors/errors.js';
import { inRange, latestOnlyCoverage } from '../../movements/coverage.js';
import type {
  BankDriver,
  CardsGrant,
  DateRange,
  HttpAnswer,
  HttpClient,
  LoginOutcome,
  ReadAuth,
  ReadGrant,
  TarjetasQuery,
} from '../../seams/seams.js';
import { launchVisible, loadChromium } from '../browser.js';
import { FetchHttpClient } from '../http-client.js';

const FIVE_MINUTES = 5 * 60_000;
// The orchestrator sent its token call 3 s after the landing (2026-10-07): a
// bounded wait past the landing, so a changed flow closes the window in seconds.
const TOKEN_WAIT = 30_000;

type Outcome =
  { kind: 'success' } | { kind: 'login-server-error'; page: Page } | { kind: 'closed' | 'timeout' };

async function errorPageText(page: Page, fallback: string): Promise<string> {
  await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
  const title = await page.title().catch(() => undefined);
  const heading = await page
    .locator('h1, h2')
    .first()
    .textContent({ timeout: 2_000 })
    .catch(() => undefined);
  return pageMessage({ title, heading: heading ?? undefined }, fallback);
}

/**
 * Watches — and only watches — a login the user performs by hand: it never
 * fills, clicks or submits anything, and resolves on the first decisive signal.
 */
function watchLogin(context: BrowserContext, first: Page, timeoutMs: number): Promise<Outcome> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (o: Outcome) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(o);
    };
    const timer = setTimeout(() => finish({ kind: 'timeout' }), timeoutMs);

    const watchPage = (page: Page) => {
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame() && isLoggedInUrl(frame.url())) finish({ kind: 'success' });
      });
      page.on('close', () => {
        if (context.pages().length === 0) finish({ kind: 'closed' });
      });
    };
    watchPage(first);
    context.on('page', watchPage);
    context.on('response', (res: Response) => {
      if (res.request().resourceType() !== 'document') return;
      const kind = classifyDocumentResponse({ url: res.url(), status: res.status() });
      // A challenge during an attended login is the user's to resolve (ADR-004):
      // keep waiting. Only the bank's login error ends the attempt here.
      if (kind !== 'login-server-error') return;
      let page: Page;
      try {
        page = res.frame().page();
      } catch {
        return; // no frame to read the message from; the watcher keeps waiting
      }
      finish({ kind, page });
    });
    context.on('close', () => finish({ kind: 'closed' }));
  });
}

/**
 * The BCI driver (ADR-003), built from `docs/bank-contract/bci.md`. The login
 * only watches until the orchestrator's own token call; reads go over HTTP with
 * that token and each app's own headers, read from its public bundle (ADR-015,
 * ADR-018).
 */
export class BciDriver implements BankDriver {
  readonly slug = BCI.slug;
  readonly code = BCI.code;
  readonly name = BCI.name;
  // A Node client with the app's grant read for 46 min (contract, GH-37).
  readonly readMode = 'http' as const;

  private readonly http: HttpClient;

  constructor(private readonly options: { loginTimeoutMs?: number; http?: HttpClient } = {}) {
    this.http = options.http ?? new FetchHttpClient();
  }

  async login(): Promise<LoginOutcome> {
    const token = await this.watchForToken();
    return { kind: 'grant', grant: await this.grantFromToken(token) };
  }

  /**
   * A visible browser at the bank's page; the user types everything (ADR-006).
   * `cta` clicks nothing: it waits for the orchestrator's own `connectors/td`
   * answer and closes the window as soon as the token is in (ADR-018).
   */
  private async watchForToken(): Promise<string> {
    const browser = await launchVisible(await loadChromium());
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      const timeout = this.options.loginTimeoutMs ?? FIVE_MINUTES;
      // Armed before the first load, so an answer that beats the landing event counts.
      const tokenAnswer = context.waitForEvent('response', {
        predicate: (r) => isTokenCall(r.request().method(), r.url()),
        timeout,
      });
      tokenAnswer.catch(() => undefined); // awaited below
      const outcome = watchLogin(context, page, timeout);
      // A failed first load is not retried; the watcher still decides the outcome.
      await page.goto(BCI.loginEntryUrl).catch(() => undefined);
      // The holder that opens this window runs in the background, so macOS
      // leaves it behind the active app; ask for the front, once.
      await page.bringToFront().catch(() => undefined);
      const result = await outcome;

      switch (result.kind) {
        case 'success':
          return await this.tokenFrom(tokenAnswer, context);
        case 'login-server-error':
          throw new BankError(
            this.slug,
            await errorPageText(result.page, 'El banco respondió con un error al iniciar sesión.'),
          );
        case 'closed':
        case 'timeout':
          throw new LoginCancelled(this.slug, result.kind);
      }
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  private async tokenFrom(answer: Promise<Response>, context: BrowserContext): Promise<string> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), TOKEN_WAIT);
    });
    const res = await Promise.race([answer.catch(() => undefined), late]);
    clearTimeout(timer);
    if (res === undefined) {
      if (context.pages().length === 0) throw new LoginCancelled(this.slug, 'closed');
      throw new BankError(
        this.slug,
        'Iniciaste sesión, pero el banco no entregó su token de lectura; pudo cambiar su inicio.',
      );
    }
    if (res.status() !== 200) {
      throw new BankError(this.slug, `El banco respondió ${res.status()} al entregar el token.`);
    }
    return parseTokenAnswer(await res.json().catch(() => undefined));
  }

  /**
   * The rest of the login, browser closed: each app's headers from its public
   * bundle, then the accounts and the cards lists the apps would ask for, sent
   * by `cta` with each app's own headers. No RUT anywhere (ADR-012, ADR-018).
   * The token, accounts and saldos are required; cards only fail `tarjetas`.
   */
  async grantFromToken(token: string): Promise<ReadGrant> {
    const expiresAt = grantExpiry(token);
    const headers = withToken(await this.appTemplate('saldos'), token);
    const cuentasHeaders = withToken(await this.appTemplate('cuentas'), token);
    const cuentas = parseCuentas(await this.get(cuentasHeaders, BCI.api.cuentas));
    return { banco: this.slug, headers, expiresAt, cuentas, tarjetas: await this.cards(token) };
  }

  private async cards(token: string): Promise<CardsGrant | { fallo: string }> {
    try {
      const headers = withToken(await this.appTemplate('tarjetas'), token);
      const cards = parseTarjetasLista(await this.get(headers, BCI.api.tarjetasLista));
      return { headers, cards };
    } catch (err) {
      // Unexpected errors may carry request details: the class only.
      return {
        fallo:
          err instanceof CtaError
            ? err.message
            : `No pude leer las tarjetas al iniciar sesión (${err instanceof Error ? err.name : 'Error'}).`,
      };
    }
  }

  /** An app's headers, from its shell and the main script it names (ADR-018). */
  private async appTemplate(app: keyof typeof BCI.apps) {
    const shell = BCI.apps[app];
    const html = await this.publicText(shell, app);
    const js = await this.publicText(new URL(mainScriptOf(html, app), shell).href, app);
    return bundleHeaders(js, app);
  }

  /** A public file of the bank's web: no header, no cookie, no token; never retried. */
  private async publicText(url: string, app: string): Promise<string> {
    let a: HttpAnswer;
    try {
      a = await this.http.get(url, {});
    } catch (err) {
      throw new BankError(
        this.slug,
        `No se pudo contactar al banco (${err instanceof Error ? err.name : 'Error'}).`,
      );
    }
    if (a.status === 403 || BCI.challengeMarkers.some((m) => a.body.includes(m))) {
      throw new BankBlocked(
        this.slug,
        `El banco detuvo la carga de su app ${app} (HTTP ${a.status}).`,
      );
    }
    if (a.status !== 200) {
      throw new BankError(this.slug, `La app ${app} del banco respondió ${a.status}.`);
    }
    return a.body;
  }

  async cuentas(auth: ReadAuth): Promise<readonly Cuenta[]> {
    return this.grantOf(auth).cuentas;
  }

  async saldos(auth: ReadAuth, cuenta?: string): Promise<readonly Saldo[]> {
    const grant = this.grantOf(auth);
    const saldos: Saldo[] = [];
    // One account at a time, like the app itself (contract, Accounts / balances).
    for (const numero of this.targets(grant, cuenta)) {
      const json = await this.post(grant.headers, BCI.api.saldoPorCuenta, {
        cuentaNumero: numero,
      });
      saldos.push(parseSaldo(json));
    }
    return saldos;
  }

  /**
   * BCI's only JSON movements read has no range: the latest movements per
   * account (50 seen). Filtered here, with coverage saying how far back it
   * reached (ADR-014); the JSF date search is not used yet (#27).
   */
  async movimientos(auth: ReadAuth, range: DateRange, cuenta?: string): Promise<Cartola> {
    const grant = this.grantOf(auth);
    const movimientos: Movimiento[] = [];
    const cobertura: Cobertura[] = [];
    for (const numero of this.targets(grant, cuenta)) {
      const json = await this.post(grant.headers, BCI.api.movimientosPorCuenta, {
        numeroCuenta: numero,
      });
      const all = parseMovimientos(json, numero);
      cobertura.push(latestOnlyCoverage(numero, all, range));
      movimientos.push(...all.filter((m) => inRange(m.fecha, range)));
    }
    return { movimientos, cobertura };
  }

  /**
   * Credit card accounts (ADR-017): one `informacion-tdc` per account, with the
   * cards app's own headers, keyed by the account's first card as the app does.
   */
  async tarjetas(auth: ReadAuth, query: TarjetasQuery): Promise<EstadoTarjetas> {
    const cards = this.grantOf(auth).tarjetas;
    if (cards === undefined) {
      throw new BankError(this.slug, 'Esta sesión no incluye tarjetas. Ejecuta: cta login bci');
    }
    if ('fallo' in cards) throw new BankError(this.slug, cards.fallo);
    const accounts = groupByAccount(cards.cards);
    const selected =
      query.tarjeta === undefined ? accounts : [matchTarjeta(accounts, query.tarjeta)];
    const tarjetas: Tarjeta[] = [];
    const movimientos: MovimientoTarjeta[] = [];
    for (const account of selected) {
      // The body the app itself sends (contract): both keys from its card list.
      const json = await this.post(cards.headers, BCI.api.informacionTarjeta, {
        numeroCuenta: account.first.accountKey,
        numeroTarjeta: account.first.cardKey,
      });
      const read = parseInformacionTarjeta(json, account);
      tarjetas.push(read.tarjeta);
      movimientos.push(...read.movimientos);
    }
    return query.movimientos === true ? { tarjetas, movimientos } : { tarjetas };
  }

  /** HTTP mode reads with the held grant only; stored cookies are not a session here. */
  private grantOf(auth: ReadAuth): ReadGrant {
    if (auth.kind !== 'grant') throw new NotAuthenticated(this.slug);
    return auth.grant;
  }

  private targets(grant: ReadGrant, cuenta: string | undefined): string[] {
    const numeros = grant.cuentas.map((c) => c.numero);
    return cuenta === undefined ? numeros : [matchCuenta(this.slug, numeros, cuenta)];
  }

  /** One GET with the app's own headers only; judged by content, never retried (ADR-004). */
  private get(headers: Readonly<Record<string, string>>, url: string): Promise<unknown> {
    return this.send(() => this.http.get(url, headers));
  }

  /** One POST with the app's own headers only; judged by content, never retried (ADR-004). */
  private post(
    headers: Readonly<Record<string, string>>,
    url: string,
    body: unknown,
  ): Promise<unknown> {
    return this.send(() => this.http.post(url, headers, JSON.stringify(body)));
  }

  private async send(request: () => Promise<HttpAnswer>): Promise<unknown> {
    let answer: HttpAnswer;
    try {
      answer = await request();
    } catch (err) {
      // Network failure or timeout: the class only (a cause may echo the request).
      const kind = err instanceof Error ? err.name : 'Error';
      throw new BankError(this.slug, `No se pudo contactar al banco (${kind}).`);
    }
    return judgeApiAnswer(answer);
  }
}
