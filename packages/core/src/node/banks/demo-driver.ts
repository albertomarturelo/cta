import { matchCuenta } from '../../accounts/match-cuenta.js';
import {
  DEMO,
  demoCuentas,
  demoMovimientos,
  demoSaldos,
  demoTarjetas,
} from '../../banks/demo/dataset.js';
import { DEMO_DONE_FLAG, DEMO_LOGIN_HTML } from '../../banks/demo/login-page.js';
import type { IsoDate } from '../../dates/dates.js';
import type {
  Cartola,
  Cobertura,
  Cuenta,
  EstadoTarjetas,
  Movimiento,
  Saldo,
} from '../../domain/types.js';
import { LoginCancelled, NoSuchCard, NotAuthenticated } from '../../errors/errors.js';
import { inRange, latestOnlyCoverage } from '../../movements/coverage.js';
import type {
  BankDriver,
  DateRange,
  LoginOutcome,
  ReadAuth,
  ReadGrant,
  TarjetasQuery,
} from '../../seams/seams.js';
import { launchVisible, loadChromium } from '../browser.js';

const FIVE_MINUTES = 5 * 60_000;
const GRANT_SECONDS = 60 * 60;
// Long enough to read «Sesión iniciada» before the window closes.
const DONE_PAUSE = 1_200;

/** The local calendar date — what "today" means to the person at the machine. */
function localDate(now: Date): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The visible window of the demo login (ADR-019): the same Chromium as a real
 * bank, on a local page. Only the page's own done flag is read — never a field.
 */
async function demoLoginWindow(timeoutMs: number): Promise<void> {
  const browser = await launchVisible(await loadChromium());
  try {
    const page = await browser.newPage();
    await page.setContent(DEMO_LOGIN_HTML);
    await page.bringToFront().catch(() => undefined);
    const closed = new Promise<'closed'>((resolve) => {
      page.once('close', () => resolve('closed'));
      browser.once('disconnected', () => resolve('closed'));
    });
    // A string expression: the core compiles without the DOM lib.
    const done = page
      .waitForFunction(`document.documentElement.dataset.${DEMO_DONE_FLAG} === 'ok'`, undefined, {
        timeout: timeoutMs,
        polling: 250,
      })
      .then(() => 'done' as const)
      .catch(() => 'timeout' as const);
    const result = await Promise.race([done, closed]);
    if (result !== 'done') throw new LoginCancelled(DEMO.slug, result);
    await new Promise((r) => setTimeout(r, DONE_PAUSE));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/**
 * The fictitious bank of ADR-019, registered only with `CTA_DEMO=1`. It reads
 * like an HTTP-mode bank — a login yields a 60-minute grant held by the holder —
 * but every answer comes from the synthetic dataset, dated relative to today.
 */
export class DemoDriver implements BankDriver {
  readonly slug = DEMO.slug;
  readonly code = DEMO.code;
  readonly name = DEMO.name;
  readonly readMode = 'http' as const;

  constructor(
    private readonly options: {
      loginTimeoutMs?: number;
      now?: () => Date;
      /** The login window; tests replace it. */
      loginWindow?: (timeoutMs: number) => Promise<void>;
    } = {},
  ) {}

  async login(): Promise<LoginOutcome> {
    await (this.options.loginWindow ?? demoLoginWindow)(
      this.options.loginTimeoutMs ?? FIVE_MINUTES,
    );
    const grant: ReadGrant = {
      banco: this.slug,
      headers: {},
      expiresAt: Math.floor(this.now().getTime() / 1000) + GRANT_SECONDS,
      cuentas: demoCuentas(),
    };
    return { kind: 'grant', grant };
  }

  async cuentas(auth: ReadAuth): Promise<readonly Cuenta[]> {
    return this.grantOf(auth).cuentas;
  }

  async saldos(auth: ReadAuth, cuenta?: string): Promise<readonly Saldo[]> {
    const wanted = this.targets(auth, cuenta);
    return demoSaldos(this.today()).filter((s) => wanted.includes(s.cuenta));
  }

  /** The latest movements per account only, with their coverage — as a real bank answers (ADR-014). */
  async movimientos(auth: ReadAuth, range: DateRange, cuenta?: string): Promise<Cartola> {
    const all = demoMovimientos(this.today());
    const movimientos: Movimiento[] = [];
    const cobertura: Cobertura[] = [];
    for (const numero of this.targets(auth, cuenta)) {
      const latest = (all.get(numero) ?? []).slice(0, DEMO.latestPerAccount);
      cobertura.push(latestOnlyCoverage(numero, latest, range));
      movimientos.push(...latest.filter((m) => inRange(m.fecha, range)));
    }
    return { movimientos, cobertura };
  }

  async tarjetas(auth: ReadAuth, query: TarjetasQuery): Promise<EstadoTarjetas> {
    this.grantOf(auth);
    const { tarjetas, movimientos } = demoTarjetas(this.today());
    let selected = tarjetas;
    if (query.tarjeta !== undefined) {
      const wanted = query.tarjeta.trim();
      selected = tarjetas.filter((t) => t.tarjeta === wanted || t.adicionales?.includes(wanted));
      if (selected.length === 0) throw new NoSuchCard(this.slug, query.tarjeta);
    }
    if (query.movimientos !== true) return { tarjetas: selected };
    const plastics = new Set(selected.flatMap((t) => [t.tarjeta, ...(t.adicionales ?? [])]));
    return { tarjetas: selected, movimientos: movimientos.filter((m) => plastics.has(m.tarjeta)) };
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private today(): IsoDate {
    return localDate(this.now());
  }

  private grantOf(auth: ReadAuth): ReadGrant {
    if (auth.kind !== 'grant') throw new NotAuthenticated(this.slug);
    return auth.grant;
  }

  private targets(auth: ReadAuth, cuenta: string | undefined): string[] {
    const numeros = this.grantOf(auth).cuentas.map((c) => c.numero);
    return cuenta === undefined ? numeros : [matchCuenta(this.slug, numeros, cuenta)];
  }
}
