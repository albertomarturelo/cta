import { toIsoDate } from '../../dates/dates.js';
import type { Cuenta, Movimiento, Saldo } from '../../domain/types.js';
import { BankBlocked, BankError, NotAuthenticated } from '../../errors/errors.js';
import { money, parseDecimalAmount } from '../../money/money.js';
import type { HttpAnswer } from '../../seams/seams.js';
import { BCI } from './config.js';

/**
 * Pure reading of BCI's answers (`docs/bank-contract/bci.md`). The raw shape
 * never leaves this module (CONVENTIONS: normalize at the boundary), and an
 * unexpected shape is a `BankError`, never a guess.
 */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const unexpected = (what: string) =>
  new BankError(BCI.slug, `El banco respondió con un formato inesperado (${what}).`);

// Account numbers are digit strings.
const ACCOUNT_NUMBER = /^\d{4,20}$/;

/** The app's own `por-rut` answer: `{ cuentas: [{ numero, tipo }] }`. */
export function parseCuentas(json: unknown): Cuenta[] {
  if (!isRecord(json) || !Array.isArray(json['cuentas'])) throw unexpected('cuentas');
  return json['cuentas'].map((c) => {
    if (!isRecord(c) || typeof c['numero'] !== 'string' || !ACCOUNT_NUMBER.test(c['numero'])) {
      throw unexpected('cuenta');
    }
    return {
      banco: BCI.slug,
      numero: c['numero'],
      tipo: typeof c['tipo'] === 'string' ? c['tipo'] : '',
      // Every amount of these reads is whole pesos (contract, Formats).
      moneda: 'CLP',
    };
  });
}

/** `por-numero-cuenta`: integer pesos for `saldoDisponible`, `saldoContable`, `retenciones`. */
export function parseSaldo(json: unknown): Saldo {
  if (!isRecord(json) || typeof json['numero'] !== 'string') throw unexpected('saldo');
  const pesos = (key: string) => {
    const v = json[key];
    if (typeof v !== 'number' || !Number.isInteger(v)) throw unexpected(key);
    return money('CLP', v);
  };
  const retenciones = json['retenciones'];
  return {
    banco: BCI.slug,
    cuenta: json['numero'],
    disponible: pesos('saldoDisponible'),
    contable: pesos('saldoContable'),
    ...(retenciones === undefined || retenciones === null
      ? {}
      : { retenciones: pesos('retenciones') }),
  };
}

/**
 * `cuentas-movimientos/por-numero-cuenta`: `{ movimientos: [{ fechaMovimiento,
 * glosa, monto: "1000.00" (unsigned), tipo: "C" | "A", … }] }`. The sign comes
 * from `tipo` (mapping confirmed against the bank's app, contract); an unknown letter is never guessed.
 */
export function parseMovimientos(json: unknown, cuenta: string): Movimiento[] {
  if (!isRecord(json) || !Array.isArray(json['movimientos'])) throw unexpected('movimientos');
  return json['movimientos'].map((m) => {
    if (!isRecord(m)) throw unexpected('movimiento');
    const { fechaMovimiento, glosa, monto, tipo } = m;
    if (typeof fechaMovimiento !== 'string' || typeof monto !== 'string') {
      throw unexpected('movimiento');
    }
    // Own keys only: a prototype name ('toString') must not pass as a known letter.
    const sign =
      typeof tipo === 'string' && Object.hasOwn(BCI.movementSign, tipo)
        ? BCI.movementSign[tipo as keyof typeof BCI.movementSign]
        : undefined;
    if (sign === undefined) throw unexpected(`tipo de movimiento '${String(tipo)}'`);
    let fecha: string;
    let abs: number;
    try {
      fecha = toIsoDate(fechaMovimiento);
      abs = parseDecimalAmount(monto, 'CLP').monto;
    } catch {
      throw unexpected('fecha o monto');
    }
    if (abs < 0) throw unexpected('monto con signo');
    return {
      banco: BCI.slug,
      cuenta,
      fecha,
      descripcion: typeof glosa === 'string' ? glosa : '',
      monto: money('CLP', sign === 'cargo' ? -abs : abs),
      tipo: sign,
    };
  });
}

/** The saldos app's URL, under either observed root; anywhere else is not the app. */
export function isAppUrl(url: string, app: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === BCI.appsHost &&
      BCI.appPathRoots.some((root) => u.pathname.startsWith(`${root}${app}/`))
    );
  } catch {
    return false;
  }
}

/**
 * Unix seconds of the bearer's `exp` — the ONLY claim `cta` reads (ADR-015): the
 * others carry the customer's identifiers and are never decoded into anything.
 */
export function grantExpiry(authorization: string): number {
  const token = authorization.replace(/^Bearer\s+/i, '');
  const payload = token.split('.')[1];
  let exp: unknown;
  try {
    // atob, not Buffer: this module stays free of Node APIs (ADR-003). The
    // payload is JSON, and only `exp` (a number) is read, so bytes need no UTF-8 pass.
    const b64 = (payload ?? '').replace(/-/g, '+').replace(/_/g, '/');
    exp = (JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))) as { exp?: unknown })
      .exp;
  } catch {
    throw unexpected('autorización de la app');
  }
  if (typeof exp !== 'number' || !Number.isFinite(exp))
    throw unexpected('vencimiento de la sesión');
  return exp;
}

const titleOf = (html: string) =>
  /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, ' ').trim() || undefined;

const messageOf = (json: unknown): string | undefined => {
  if (!isRecord(json)) return undefined;
  for (const key of ['error_description', 'mensaje', 'message']) {
    const v = json[key];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return undefined;
};

/**
 * Judges an API answer to an HTTP-mode read (ADR-015, contract "Reads from a Node
 * HTTP client"): the JSON on `200`; `401` → `NotAuthenticated` (seen past `exp`);
 * a challenge, a `403` or a non-JSON answer → `BankBlocked`; anything else →
 * `BankError`. Decided by content as well as status (CONVENTIONS); never retried.
 */
export function judgeApiAnswer(a: HttpAnswer): unknown {
  const isJson = /\bjson\b/i.test(a.contentType);
  const challenged = BCI.challengeMarkers.some((m) => a.body.includes(m));
  if (a.status === 401) throw new NotAuthenticated(BCI.slug);
  if (challenged || a.status === 403 || (a.status === 200 && !isJson)) {
    throw new BankBlocked(
      BCI.slug,
      (isJson ? undefined : titleOf(a.body)) ??
        `El banco detuvo la lectura (HTTP ${a.status}, sin datos).`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(a.body);
  } catch {
    throw unexpected('respuesta no legible');
  }
  if (a.status !== 200) {
    throw new BankError(BCI.slug, messageOf(json) ?? `El banco respondió ${a.status}.`);
  }
  return json;
}

/**
 * The headers of the app's own API request that `cta` repeats for the next
 * reads from the same page (ADR-012) — only the ones the app sets; the browser
 * adds its own (origin, cookies, user agent) as it always does.
 */
export function appHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of BCI.apiHeaders) {
    const v = headers[name];
    if (v !== undefined) out[name] = v;
  }
  if (!out['authorization']) throw unexpected('sin autorización de la app');
  return out;
}
