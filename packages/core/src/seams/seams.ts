import type { IsoDate } from '../dates/dates.js';
import type { Cartola, Cuenta, EstadoTarjetas, Saldo } from '../domain/types.js';

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
  /** Accounts as the bank listed them at login, with no RUT sent (ADR-012, ADR-018). */
  readonly cuentas: readonly Cuenta[];
  /**
   * The cards app, read in the same login (ADR-017, ADR-018): its own headers and
   * card list, or why it could not be read — a cards failure never fails the login.
   * Absent for a driver without cards.
   */
  readonly tarjetas?: CardsGrant | { readonly fallo: string };
}

/** A card as the bank's cards app listed it; its keys are request keys only (ADR-017). */
export interface CardRef {
  /** The bank's card key, sent back in reads; never output. */
  readonly cardKey: string;
  /** The card account's key; cards sharing it share a quota. Never output. */
  readonly accountKey: string;
  /** The bank's own label, at most 4 digits shown. */
  readonly label: string;
  readonly last4: string;
}

/** The cards app's own headers — bearer included, exactly as sent — and card list. */
export interface CardsGrant {
  readonly headers: Readonly<Record<string, string>>;
  readonly cards: readonly CardRef[];
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
  get(url: string, headers: Readonly<Record<string, string>>): Promise<HttpAnswer>;
  post(url: string, headers: Readonly<Record<string, string>>, body: string): Promise<HttpAnswer>;
}

/** What a card read covers (ADR-017). */
export interface TarjetasQuery {
  /** Last 4 digits of any card of the account wanted; all accounts when absent. */
  readonly tarjeta?: string;
  /** Also return the billed and unbilled movements. */
  readonly movimientos?: boolean;
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
  /** Credit card accounts, one read per account (ADR-017). */
  tarjetas(auth: ReadAuth, query: TarjetasQuery): Promise<EstadoTarjetas>;
}
