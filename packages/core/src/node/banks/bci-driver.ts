import type { Browser, BrowserContext, BrowserType, Page, Response } from 'playwright';

import { matchCuenta } from '../../accounts/match-cuenta.js';
import { BCI } from '../../banks/bci/config.js';
import {
  bankCookies,
  classifyDocumentResponse,
  hasSessionCookie,
  isLoggedInUrl,
  pageMessage,
} from '../../banks/bci/login-flow.js';
import {
  appHeaders,
  grantExpiry,
  isAppUrl,
  judgeApiAnswer,
  parseCuentas,
  parseMovimientos,
  parseSaldo,
} from '../../banks/bci/reads.js';
import type { Cartola, Cobertura, Cuenta, Movimiento, Saldo } from '../../domain/types.js';
import {
  BankError,
  BrowserMissing,
  LoginCancelled,
  NotAuthenticated,
} from '../../errors/errors.js';
import { inRange, latestOnlyCoverage } from '../../movements/coverage.js';
import type {
  BankDriver,
  DateRange,
  HttpAnswer,
  HttpClient,
  LoginOutcome,
  ReadAuth,
  ReadGrant,
  StoredCookie,
} from '../../seams/seams.js';
import { FetchHttpClient } from '../http-client.js';

const FIVE_MINUTES = 5 * 60_000;
const SESSION_COOKIE_WAIT = 10_000;
const MENU_WAIT = 30_000;

/**
 * Lazy-load Playwright — an optional peer of the core (STACK). Importing `./node`
 * never loads it; a missing install fails here, at first use, with an actionable
 * message. Lineage: sii adapters/node/portal.ts.
 */
async function loadChromium(): Promise<BrowserType> {
  try {
    return (await import('playwright')).chromium;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') throw new BrowserMissing();
    throw err;
  }
}

async function launchVisible(chromium: BrowserType): Promise<Browser> {
  try {
    // A normal, visible Chromium: no flags, no plugins, no user-agent change (ADR-004).
    return await chromium.launch({ headless: false });
  } catch (err) {
    if (err instanceof Error && /Executable doesn't exist|playwright install/i.test(err.message)) {
      throw new BrowserMissing();
    }
    throw err;
  }
}

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
 * The bank's cookies once its session cookie is readable. The orchestrator's
 * `/home` is a client-side route and the probe first read `__Host-SESSIONID`
 * seconds after it (contract, 2026-09-28), so this waits a moment for it — it
 * only reads the browser's jar and sends nothing to the bank.
 */
async function sessionCookies(context: BrowserContext): Promise<StoredCookie[]> {
  const deadline = Date.now() + SESSION_COOKIE_WAIT;
  for (;;) {
    const cookies = bankCookies(await context.cookies());
    if (hasSessionCookie(cookies) || Date.now() >= deadline) return cookies;
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** Clicks the home's own menu path to the saldos app, once each; false if absent. */
async function openUltimosMovimientos(page: Page): Promise<string | undefined> {
  const all = (name: string) => page.getByRole('link', { name, exact: true });
  // Only a visible match counts: the home may also carry hidden copies of its
  // menu (e.g. a collapsed mobile one), and the first match can be one of them.
  const visible = (name: string) => all(name).filter({ visible: true }).first();
  const menuName = BCI.orchestrator.menuMiCuenta;
  const itemName = BCI.orchestrator.menuUltimosMovimientos;
  // The home carries two copies of each link (2 found, both "visible" on
  // 2026-09-28), and "Últimos Movimientos" lives inside the "Mi Cuenta" menu.
  // So open the first "Mi Cuenta" copy that takes a click, then click the item
  // inside that same menu: the nearest ancestor of "Mi Cuenta" that holds it.
  // Page clicks only; no bank request is repeated.
  const routed = (url: URL) => url.pathname.includes(BCI.orchestrator.embeddedSegment);
  let step = `«${menuName}»`;
  try {
    // The landing's /home routes on to /comp/mi_banco/…, whose menu takes clicks
    // only once the page has settled: a click made earlier was accepted but did
    // nothing (2026-09-29). So wait for that route and a quiet network first.
    await page
      .waitForURL((u) => u.pathname.includes(BCI.orchestrator.miBancoSegment), {
        timeout: MENU_WAIT,
      })
      .catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await visible(menuName).waitFor({ state: 'visible', timeout: MENU_WAIT });
    const menus = all(menuName);
    const n = await menus.count();
    for (let i = 0; i < n; i++) {
      const menu = menus.nth(i);
      if (!(await menu.isVisible())) continue;
      const opened = await menu
        .click({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (!opened) continue;
      step = `«${itemName}»`;
      const within = menu.locator(
        `xpath=ancestor::*[.//a[normalize-space(.)=${JSON.stringify(itemName)}]][1]`,
      );
      const item = within.getByRole('link', { name: itemName, exact: true }).first();
      // A click proves nothing by itself: the menu must route to /comp/embedded.
      // One more click only if the first led nowhere; nothing the bank answered
      // is repeated.
      for (let attempt = 0; attempt < 2; attempt++) {
        const clicked = await item
          .click({ timeout: 10_000 })
          .then(() => true)
          .catch(() => false);
        if (!clicked) break;
        const went = await page
          .waitForURL(routed, { timeout: 10_000 })
          .then(() => true)
          .catch(() => false);
        if (went) return undefined;
        step = `«${itemName}» (sin navegar)`;
      }
    }
    throw new Error('menu path not taken');
  } catch {
    // Where it stopped, in counts only: enough to fix the selector from a report.
    const seen = async (name: string) =>
      `${await all(name).count()}/${await all(name).filter({ visible: true }).count()}`;
    const menu = await seen(menuName).catch(() => '?');
    const item = await seen(itemName).catch(() => '?');
    return `${step}; encontrados/visibles: «${menuName}» ${menu}, «${itemName}» ${item}`;
  }
}

/**
 * The BCI driver (ADR-003), built from `docs/bank-contract/bci.md`. The login
 * only watches, then takes the read grant from the bank's own saldos app; reads
 * go over HTTP with that grant (ADR-015).
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
    const browser = await launchVisible(await loadChromium());
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      const outcome = watchLogin(context, page, this.options.loginTimeoutMs ?? FIVE_MINUTES);
      // A failed first load is not retried; the watcher still decides the outcome.
      await page.goto(BCI.loginEntryUrl).catch(() => undefined);
      // The holder that opens this window runs in the background, so macOS
      // leaves it behind the active app; ask for the front, once.
      await page.bringToFront().catch(() => undefined);
      const result = await outcome;

      switch (result.kind) {
        case 'success': {
          const cookies = await sessionCookies(context);
          if (!hasSessionCookie(cookies)) {
            throw new BankError(this.slug, 'El banco no entregó una sesión reconocible.');
          }
          return { kind: 'grant', grant: await this.captureGrant(context) };
        }
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

  /**
   * After the landing, opens the saldos app through the home's own menu — the
   * credentials were typed by the user, untouched (ADR-006) — and keeps what the
   * app's own account listing
   * carried: its headers (bearer included) and the accounts it got. `cta` never
   * builds a URL into the app, nor sends, reads or stores the RUT (ADR-012).
   */
  private async captureGrant(context: BrowserContext): Promise<ReadGrant> {
    // Only the saldos app's own listing counts: another frame's call is ignored,
    // not taken as a failure.
    const fromApp = (r: Response) => {
      try {
        return isAppUrl(r.frame().url(), BCI.saldosApp);
      } catch {
        return false; // a response without a frame is not the app's
      }
    };
    const listing = context.waitForEvent('response', {
      predicate: (r) =>
        r.request().method() === 'POST' && r.url() === BCI.api.cuentasPorRut && fromApp(r),
      timeout: this.options.loginTimeoutMs ?? FIVE_MINUTES,
    });
    listing.catch(() => undefined); // awaited below
    // The user's own path, observed 2026-09-28: "Mi Cuenta" → "Últimos
    // Movimientos". Exact names only: a guessed link (the old JSF "Ir a últimos
    // Movimientos") led to a bank error page. If the menu is not there, nothing
    // else is tried and the login ends at once, saying so.
    const page = context.pages().find((p) => isLoggedInUrl(p.url())) ?? context.pages()[0];
    const failedAt = page ? await openUltimosMovimientos(page) : 'sin página';
    if (failedAt !== undefined) {
      throw new BankError(
        this.slug,
        'Iniciaste sesión, pero no pude abrir «Mi Cuenta» → «Últimos Movimientos» en tu inicio ' +
          `(se detuvo en ${failedAt}); el banco pudo cambiar su menú.`,
      );
    }

    let res: Response;
    try {
      res = await listing;
    } catch {
      throw new LoginCancelled(this.slug, context.pages().length === 0 ? 'closed' : 'timeout');
    }
    if (res.status() === 401) throw new NotAuthenticated(this.slug);
    if (res.status() !== 200) {
      throw new BankError(this.slug, `El banco respondió ${res.status()} al listar las cuentas.`);
    }
    const cuentas = parseCuentas(await res.json().catch(() => undefined));
    const headers = appHeaders(await res.request().allHeaders());
    return {
      banco: this.slug,
      headers,
      expiresAt: grantExpiry(headers['authorization'] ?? ''),
      cuentas,
    };
  }

  async cuentas(auth: ReadAuth): Promise<readonly Cuenta[]> {
    return this.grantOf(auth).cuentas;
  }

  async saldos(auth: ReadAuth, cuenta?: string): Promise<readonly Saldo[]> {
    const grant = this.grantOf(auth);
    const saldos: Saldo[] = [];
    // One account at a time, like the app itself (contract, Accounts / balances).
    for (const numero of this.targets(grant, cuenta)) {
      const json = await this.post(grant, BCI.api.saldoPorCuenta, { cuentaNumero: numero });
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
      const json = await this.post(grant, BCI.api.movimientosPorCuenta, { numeroCuenta: numero });
      const all = parseMovimientos(json, numero);
      cobertura.push(latestOnlyCoverage(numero, all, range));
      movimientos.push(...all.filter((m) => inRange(m.fecha, range)));
    }
    return { movimientos, cobertura };
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

  /** One POST with the app's own headers only; judged by content, never retried (ADR-004). */
  private async post(grant: ReadGrant, url: string, body: unknown): Promise<unknown> {
    let answer: HttpAnswer;
    try {
      answer = await this.http.post(url, grant.headers, JSON.stringify(body));
    } catch (err) {
      // Network failure or timeout: the class only (a cause may echo the request).
      const kind = err instanceof Error ? err.name : 'Error';
      throw new BankError(this.slug, `No se pudo contactar al banco (${kind}).`);
    }
    return judgeApiAnswer(answer);
  }
}
