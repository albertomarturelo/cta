import type { IsoDate } from '../dates/dates.js';
import type { Cartola, Cuenta, Saldo } from '../domain/types.js';

/** A browser cookie as persisted — the ONLY thing stored for a session (ADR-006). */
export interface StoredCookie {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  /** Unix seconds; -1 for a session cookie. */
  readonly expires: number;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: 'Strict' | 'Lax' | 'None';
}

export interface StoredSession {
  readonly banco: string;
  readonly cookies: readonly StoredCookie[];
  /** ISO 8601 timestamp of the login that minted it. */
  readonly savedAt: string;
}

export interface SessionStore {
  get(banco: string): Promise<StoredSession | undefined>;
  put(session: StoredSession): Promise<void>;
  delete(banco: string): Promise<void>;
  /** Banks that currently have a stored session. */
  list(): Promise<readonly string[]>;
}

/** A receipt of an action, never of data (ADR-004): no accounts, amounts or cookies. */
export interface AuditEntry {
  readonly ts: string;
  readonly action: string;
  readonly banco: string;
  readonly result: 'ok' | 'error';
  readonly durationMs: number;
  readonly errorCode?: string;
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<void>;
}

export interface Clock {
  now(): Date;
}

/**
 * The read grant an HTTP-mode driver captures at login (ADR-015): the headers
 * the bank's own app sent with its API call — bearer included — and when the
 * bearer expires. Memory only: never written, logged, audited or returned.
 */
export interface ReadGrant {
  readonly banco: string;
  readonly headers: Readonly<Record<string, string>>;
  /** Unix seconds, from the bearer's `exp` claim — the only claim `cta` reads. */
  readonly expiresAt: number;
  /** Accounts as the bank's app listed them at login (the app's own answer, ADR-012). */
  readonly cuentas: readonly Cuenta[];
}

/** What a login yields: cookies to store (browser mode) or a grant to hold (HTTP mode). */
export type LoginOutcome =
  | { readonly kind: 'cookies'; readonly cookies: readonly StoredCookie[] }
  | { readonly kind: 'grant'; readonly grant: ReadGrant };

/** How a read authenticates: stored cookies (ADR-006/012) or the held grant (ADR-015). */
export type ReadAuth =
  | { readonly kind: 'cookies'; readonly session: StoredSession }
  | { readonly kind: 'grant'; readonly grant: ReadGrant };

/** An answer as the driver needs it to judge it: status, declared type, raw body. */
export interface HttpAnswer {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

/**
 * A plain HTTP client for HTTP-mode reads (ADR-015). It sends exactly the
 * headers given — no cookies, no browser headers made up — and never retries.
 */
export interface HttpClient {
  post(url: string, headers: Readonly<Record<string, string>>, body: string): Promise<HttpAnswer>;
}

/** Both ends optional and inclusive; absent means unbounded (ADR-014). */
export interface DateRange {
  readonly desde?: IsoDate;
  readonly hasta?: IsoDate;
}

/**
 * One bank. Each read is task-sized: in browser modes it runs in ONE browser
 * from start to end (ADR-012); in HTTP mode it uses the held grant (ADR-015).
 */
export interface BankDriver {
  /** Lowercase slug, e.g. `bci`. */
  readonly slug: string;
  /** Chilean bank code, e.g. `016`. */
  readonly code: string;
  readonly name: string;
  /** How reads run, justified in the driver's contract (ADR-012, ADR-015). */
  readonly readMode: 'headed' | 'headless' | 'http';
  /** Opens the bank's real login page; the user types everything (ADR-006). */
  login(): Promise<LoginOutcome>;
  cuentas(auth: ReadAuth): Promise<readonly Cuenta[]>;
  /**
   * `cuenta` is the user's selector (full number or last 4 digits); the driver
   * resolves it with `matchCuenta` within the same read.
   */
  saldos(auth: ReadAuth, cuenta?: string): Promise<readonly Saldo[]>;
  /** Filtered to `range`; each account read says how far it reaches (ADR-014). */
  movimientos(auth: ReadAuth, range: DateRange, cuenta?: string): Promise<Cartola>;
}
