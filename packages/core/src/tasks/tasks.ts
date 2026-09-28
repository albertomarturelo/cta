import { toIsoDate, type IsoDate } from '../dates/dates.js';
import type { Cartola, Cuenta, Saldo } from '../domain/types.js';
import { BankBlocked, CtaError, InvalidDateRange, NotAuthenticated } from '../errors/errors.js';
import { resolveBank } from '../identity/resolve-bank.js';
import type {
  AuditSink,
  BankDriver,
  Clock,
  DateRange,
  ReadAuth,
  ReadGrant,
  SessionStore,
} from '../seams/seams.js';

export interface TaskDeps {
  readonly drivers: readonly BankDriver[];
  readonly sessions: SessionStore;
  readonly audit: AuditSink;
  readonly clock: Clock;
}

export interface BancoInfo {
  readonly banco: string;
  readonly codigo: string;
  readonly nombre: string;
  /** Cookies are stored; NOT a check that the bank still accepts them (ADR-011). */
  readonly sesionGuardada: boolean;
  /** An HTTP-mode session is held in memory until this instant (ADR-015). */
  readonly sesionHasta?: string;
  /** Present while a login of this bank runs in this process (ADR-013). */
  readonly loginEnCurso?: true;
  /** The last login of this bank in this process failed; cleared when the next one starts. */
  readonly ultimoLoginFallido?: LoginFallido;
}

export interface LoginFallido {
  /** The bank's message verbatim for a `CtaError` (ADR-004). */
  readonly error: string;
  readonly code: string;
}

export interface LoginResult {
  readonly banco: string;
  /** Cookies stored on disk (browser-mode drivers, ADR-006). */
  readonly sesionGuardada: boolean;
  /** When the login finished. */
  readonly guardadaEn: string;
  /** HTTP-mode drivers: the session is held in memory until this instant (ADR-015). */
  readonly sesionHasta?: string;
}

export interface MovimientosQuery {
  /** Full account number or its last 4 digits; all accounts when absent. */
  readonly cuenta?: string;
  /** Inclusive; `YYYY-MM-DD` (or the bank formats `toIsoDate` accepts). */
  readonly desde?: string;
  readonly hasta?: string;
}

export interface LoginStarted {
  readonly banco: string;
  /** `en-curso`: a login of this bank was already running; no new window opened. */
  readonly estado: 'ventana-abierta' | 'en-curso';
}

/**
 * The public API every surface calls (ADR-003). Each task resolves the required
 * bank first (ADR-011), calls its driver at most once — one browser (ADR-012) —
 * and leaves an audit receipt of the action, never of the data (ADR-004).
 */
export function createTasks(deps: TaskDeps) {
  // ADR-013: at most one login per bank in flight, and the last failure of each,
  // for the life of this tasks instance. Nothing of it reaches the disk.
  const loginsInFlight = new Map<string, Promise<LoginResult>>();
  const failedLogins = new Map<string, LoginFallido>();
  // ADR-015: HTTP-mode read grants, in memory only, for the life of this instance.
  const grants = new Map<string, ReadGrant>();

  async function run<T>(
    action: string,
    bancoInput: string | undefined,
    fn: (driver: BankDriver) => Promise<T>,
  ): Promise<T> {
    const started = deps.clock.now().getTime();
    const driver = await resolve(action, bancoInput, started);
    return audited(action, driver.slug, started, () => fn(driver));
  }

  /** Resolves the bank; an unknown or missing one is audited as `banco: '-'`. */
  async function resolve(
    action: string,
    bancoInput: string | undefined,
    started: number,
  ): Promise<BankDriver> {
    try {
      return resolveBank(bancoInput, deps.drivers);
    } catch (err) {
      await failureReceipt(action, '-', started, err);
      throw err;
    }
  }

  async function audited<T>(
    action: string,
    banco: string,
    started: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    let result: T;
    try {
      result = await fn();
    } catch (err) {
      await failureReceipt(action, banco, started, err);
      throw err;
    }
    // On success a broken audit sink is surfaced, not ignored.
    await receipt(action, banco, started, 'ok');
    return result;
  }

  // The original error always wins: a failing audit write must never hide the
  // bank's verbatim message (ADR-004).
  async function failureReceipt(action: string, banco: string, started: number, err: unknown) {
    await receipt(
      action,
      banco,
      started,
      'error',
      err instanceof CtaError ? err.code : 'UNEXPECTED',
    ).catch(() => undefined);
  }

  async function receipt(
    action: string,
    banco: string,
    started: number,
    result: 'ok' | 'error',
    errorCode?: string,
  ) {
    const now = deps.clock.now();
    await deps.audit.record({
      ts: now.toISOString(),
      action,
      banco,
      result,
      durationMs: now.getTime() - started,
      ...(errorCode === undefined ? {} : { errorCode }),
    });
  }

  /** Joins the running login of this bank, or starts one (ADR-013). */
  function loginOnce(driver: BankDriver): Promise<LoginResult> {
    const running = loginsInFlight.get(driver.slug);
    if (running) return running;
    failedLogins.delete(driver.slug);
    const started = deps.clock.now().getTime();
    const login = audited('login', driver.slug, started, async (): Promise<LoginResult> => {
      const outcome = await driver.login();
      const savedAt = deps.clock.now().toISOString();
      if (outcome.kind === 'grant') {
        grants.set(driver.slug, outcome.grant);
        // An HTTP-mode driver persists nothing; older cookies of it are dropped.
        await deps.sessions.delete(driver.slug);
        return {
          banco: driver.slug,
          sesionGuardada: false,
          guardadaEn: savedAt,
          sesionHasta: new Date(outcome.grant.expiresAt * 1000).toISOString(),
        };
      }
      await deps.sessions.put({ banco: driver.slug, cookies: outcome.cookies, savedAt });
      return { banco: driver.slug, sesionGuardada: true, guardadaEn: savedAt };
    })
      .catch((err: unknown) => {
        failedLogins.set(driver.slug, describeFailure(err));
        throw err;
      })
      .finally(() => loginsInFlight.delete(driver.slug));
    loginsInFlight.set(driver.slug, login);
    return login;
  }

  /** A grant still inside its `exp`, or none; an expired one is forgotten. */
  function liveGrant(slug: string): ReadGrant | undefined {
    const grant = grants.get(slug);
    if (grant && deps.clock.now().getTime() < grant.expiresAt * 1000) return grant;
    grants.delete(slug);
    return undefined;
  }

  async function auth(driver: BankDriver): Promise<ReadAuth> {
    if (driver.readMode === 'http') {
      const grant = liveGrant(driver.slug);
      if (!grant) throw new NotAuthenticated(driver.slug);
      return { kind: 'grant', grant };
    }
    const stored = await deps.sessions.get(driver.slug);
    if (!stored) throw new NotAuthenticated(driver.slug);
    return { kind: 'cookies', session: stored };
  }

  /** A read; an expired or blocked answer ends the held grant (ADR-015). */
  async function read<T>(driver: BankDriver, fn: (a: ReadAuth) => Promise<T>): Promise<T> {
    const a = await auth(driver);
    try {
      return await fn(a);
    } catch (err) {
      if (a.kind === 'grant' && (err instanceof NotAuthenticated || err instanceof BankBlocked)) {
        grants.delete(driver.slug);
      }
      throw err;
    }
  }

  /** Validates the range before any browser opens: a usage error, not a bank one. */
  function dateRange(q: MovimientosQuery): DateRange {
    const iso = (name: string, v: string | undefined): IsoDate | undefined => {
      if (v === undefined) return undefined;
      try {
        return toIsoDate(v);
      } catch {
        throw new InvalidDateRange(`'${name}' no es una fecha (${v})`);
      }
    };
    const desde = iso('desde', q.desde);
    const hasta = iso('hasta', q.hasta);
    if (desde !== undefined && hasta !== undefined && desde > hasta) {
      throw new InvalidDateRange(`'desde' (${desde}) es posterior a 'hasta' (${hasta})`);
    }
    return { ...(desde === undefined ? {} : { desde }), ...(hasta === undefined ? {} : { hasta }) };
  }

  return {
    /**
     * Opens the bank's real login page and waits for the user to finish; stores
     * the resulting cookies only (ADR-006), or holds an HTTP-mode driver's grant
     * in memory (ADR-015). Joins a login already running.
     */
    login: async (banco: string | undefined): Promise<LoginResult> =>
      loginOnce(await resolve('login', banco, deps.clock.now().getTime())),

    /**
     * Starts the same login without waiting for it (ADR-013); `bancos` reports
     * how it ends. Never opens a second window for a bank.
     */
    startLogin: async (banco: string | undefined): Promise<LoginStarted> => {
      const driver = await resolve('login', banco, deps.clock.now().getTime());
      if (loginsInFlight.has(driver.slug)) return { banco: driver.slug, estado: 'en-curso' };
      // Audited and kept for `bancos`; nobody awaits it, so it must not reject.
      loginOnce(driver).catch(() => undefined);
      return { banco: driver.slug, estado: 'ventana-abierta' };
    },

    /**
     * Forgets the stored cookies and any held grant. It does not sign out at the bank, nor cancel a
     * login in flight: that one stores its cookies when the user finishes (ADR-013).
     */
    logout: (banco: string | undefined) =>
      run('logout', banco, async (driver) => {
        await deps.sessions.delete(driver.slug);
        grants.delete(driver.slug);
        return {
          banco: driver.slug,
          sesionGuardada: false,
          ...(loginsInFlight.has(driver.slug) ? { loginEnCurso: true as const } : {}),
        };
      }),

    bancos: async (): Promise<{ bancos: readonly BancoInfo[] }> => {
      const stored = new Set(await deps.sessions.list());
      return {
        bancos: deps.drivers.map((d) => ({
          banco: d.slug,
          codigo: d.code,
          nombre: d.name,
          sesionGuardada: stored.has(d.slug),
          ...withGrant(liveGrant(d.slug)),
          ...(loginsInFlight.has(d.slug) ? { loginEnCurso: true as const } : {}),
          ...withFailure(failedLogins.get(d.slug)),
        })),
      };
    },

    cuentas: (banco: string | undefined): Promise<{ banco: string; cuentas: readonly Cuenta[] }> =>
      run('cuentas', banco, async (driver) => ({
        banco: driver.slug,
        cuentas: await read(driver, (a) => driver.cuentas(a)),
      })),

    saldo: (
      banco: string | undefined,
      cuenta?: string,
    ): Promise<{ banco: string; saldos: readonly Saldo[] }> =>
      run('saldo', banco, async (driver) => ({
        banco: driver.slug,
        saldos: await read(driver, (a) => driver.saldos(a, cuenta)),
      })),

    /**
     * Movements of one bank, filtered to the range, with how far each account's
     * read reaches (ADR-014). Never claims a range the bank did not return.
     */
    movimientos: (
      banco: string | undefined,
      query: MovimientosQuery = {},
    ): Promise<{ banco: string } & Cartola> =>
      run('movimientos', banco, async (driver) => {
        const range = dateRange(query);
        const cartola = await read(driver, (a) => driver.movimientos(a, range, query.cuenta));
        return { banco: driver.slug, ...cartola };
      }),
  };
}

function withGrant(g: ReadGrant | undefined): { sesionHasta?: string } {
  return g === undefined ? {} : { sesionHasta: new Date(g.expiresAt * 1000).toISOString() };
}

function withFailure(f: LoginFallido | undefined): { ultimoLoginFallido?: LoginFallido } {
  return f === undefined ? {} : { ultimoLoginFallido: f };
}

/** A failure as the surfaces may show it: an unexpected error keeps only its class. */
function describeFailure(err: unknown): LoginFallido {
  return err instanceof CtaError
    ? { error: err.message, code: err.code }
    : {
        // Unexpected errors may carry request details (cookies): the class only.
        error: `Error inesperado (${err instanceof Error ? err.name : 'Error'})`,
        code: 'UNEXPECTED',
      };
}

export type Tasks = ReturnType<typeof createTasks>;
