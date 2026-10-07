import { toIsoDate, type IsoDate } from '../../dates/dates.js';
import type { Cupo, Facturacion, MovimientoTarjeta, Tarjeta } from '../../domain/types.js';
import { BankError, NoSuchCard } from '../../errors/errors.js';
import { money, parseDecimalAmount, type Moneda, type Money } from '../../money/money.js';
import type { CardRef } from '../../seams/seams.js';
import { BCI } from './config.js';
import { isRecord, unexpected } from './reads.js';

/**
 * Pure reading of BCI's cards app (`docs/bank-contract/bci.md`, "Credit cards";
 * ADR-017). Card and account keys stay request keys: nothing here puts them in a
 * result or an error message.
 */

const KEY = /^\d{1,20}$/;
const LAST4 = /(\d{4})\D*$/;

/** A label may show at most 4 digits in a row: a longer run could be a card number. */
function cardLabel(label: string): string {
  const text = label.trim();
  // The message names the field, never the label itself.
  if (/\d{5,}/.test(text)) throw unexpected('etiqueta de tarjeta');
  return text;
}

function last4Of(label: string): string {
  const m = LAST4.exec(label);
  if (!m) throw unexpected('etiqueta de tarjeta');
  return m[1]!;
}

/** `GET mov-tdc/`: `[{ numeroTarjeta, numeroDeCuenta, descripcionSelectorTarjeta, … }]`. */
export function parseTarjetasLista(json: unknown): CardRef[] {
  if (!Array.isArray(json)) throw unexpected('tarjetas');
  return json.map((e) => {
    if (!isRecord(e)) throw unexpected('tarjeta');
    const { numeroTarjeta, numeroDeCuenta, descripcionSelectorTarjeta } = e;
    if (
      typeof numeroTarjeta !== 'string' ||
      !KEY.test(numeroTarjeta) ||
      typeof numeroDeCuenta !== 'string' ||
      !KEY.test(numeroDeCuenta) ||
      typeof descripcionSelectorTarjeta !== 'string'
    ) {
      throw unexpected('tarjeta');
    }
    const label = cardLabel(descripcionSelectorTarjeta);
    return { cardKey: numeroTarjeta, accountKey: numeroDeCuenta, label, last4: last4Of(label) };
  });
}

/** One card account: its first card in the bank's list, and the others that share it. */
export interface CardAccount {
  readonly first: CardRef;
  readonly others: readonly CardRef[];
}

/**
 * The list has one entry per plastic, and an additional card shares its
 * account (contract), so accounts are grouped in the bank's order and each is
 * read once: a shared quota is never reported twice (ADR-017).
 */
export function groupByAccount(cards: readonly CardRef[]): CardAccount[] {
  const byAccount = new Map<string, CardRef[]>();
  for (const c of cards) {
    const group = byAccount.get(c.accountKey);
    if (group) group.push(c);
    else byAccount.set(c.accountKey, [c]);
  }
  return [...byAccount.values()].map(([first, ...others]) => ({ first: first!, others }));
}

/** `--tarjeta`: the last 4 digits of any card of an account selects that account. */
export function matchTarjeta(accounts: readonly CardAccount[], selector: string): CardAccount {
  const wanted = selector.replace(/\D/g, '');
  const hits =
    wanted.length === 4
      ? accounts.filter((a) => [a.first, ...a.others].some((c) => c.last4 === wanted))
      : [];
  if (hits.length === 1) return hits[0]!;
  throw new NoSuchCard(BCI.slug, selector, hits.length > 1);
}

/** International amounts come as dollars with up to 2 decimals (contract); cents out. */
function usd(v: unknown, what: string): Money {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw unexpected(what);
  try {
    return parseDecimalAmount(String(v), 'USD');
  } catch {
    throw unexpected(what);
  }
}

function pesos(v: unknown, what: string): Money {
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw unexpected(what);
  return money('CLP', v);
}

const amountIn = (moneda: Moneda) => (moneda === 'USD' ? usd : pesos);

/** Dates come as `D/M/YYYY` without zero padding (contract). */
function dmy(v: unknown, what: string): IsoDate {
  const m = typeof v === 'string' ? /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(v) : null;
  if (!m) throw unexpected(what);
  try {
    return toIsoDate(`${m[1]!.padStart(2, '0')}/${m[2]!.padStart(2, '0')}/${m[3]}`);
  } catch {
    throw unexpected(what);
  }
}

const absent = (v: unknown) => v === undefined || v === null || v === '';

/** A run of card-number length inside a description is masked to its last 4 (ADR-017). */
const maskCardNumbers = (text: string) => text.replace(/\d{13,}/g, (d) => `****${d.slice(-4)}`);

// Each list, its currency and whether it is billed (contract, "Everything for one card").
const LISTS = [
  ['facturadosNacionales', 'CLP', true],
  ['noFacturadosNacional', 'CLP', false],
  ['facturadosInternacionales', 'USD', true],
  ['noFacturadosInternacional', 'USD', false],
] as const;

/**
 * `POST informacion-tdc` for one card account: quotas, billing dates and the
 * billed and unbilled movements. Inferred until the live run (contract): a
 * positive bank `monto` is a cargo, so it is negated (ADR-007).
 */
export function parseInformacionTarjeta(
  json: unknown,
  account: CardAccount,
): { tarjeta: Tarjeta; movimientos: MovimientoTarjeta[] } {
  if (!isRecord(json)) throw unexpected('tarjeta');
  // A national failure is the bank's own message; the international one comes
  // with empty lists for a card with no international billing (contract).
  for (const key of ['errorNacional', 'errorNoFacturados']) {
    const err = json[key];
    if (!absent(err)) {
      const msg = isRecord(err) && typeof err['mensaje'] === 'string' ? err['mensaje'].trim() : '';
      throw new BankError(BCI.slug, msg || 'El banco no entregó los datos de la tarjeta.');
    }
  }

  const opt = <T>(key: string, read: (v: unknown, what: string) => T): T | undefined =>
    absent(json[key]) ? undefined : read(json[key], key);
  const withOpt = <K extends string, T>(k: K, v: T | undefined) =>
    (v === undefined ? {} : { [k]: v }) as { [P in K]?: T };

  const nacional: Cupo = {
    total: pesos(json['cupoNacional'], 'cupoNacional'),
    utilizado: pesos(json['cupoUtilizadoNacional'], 'cupoUtilizadoNacional'),
    disponible: pesos(json['cupoDisponibleNacional'], 'cupoDisponibleNacional'),
    ...withOpt('facturado', opt('montoFacturadoNacional', pesos)),
    ...withOpt('pagoMinimo', opt('pagoMinimo', pesos)),
  };
  const internacional: Cupo = {
    total: usd(json['cupoInternacional'], 'cupoInternacional'),
    utilizado: usd(json['cupoUtilizadoInternacional'], 'cupoUtilizadoInternacional'),
    disponible: usd(json['cupoDisponibleInternacional'], 'cupoDisponibleInternacional'),
    ...withOpt('facturado', opt('montoFacturadoInternacional', usd)),
  };
  const facturacion: Facturacion = {
    ...withOpt('ultima', opt('fechaFacturacion', dmy)),
    ...withOpt('proxima', opt('fechaProximaFacturacion', dmy)),
    ...withOpt('vencimiento', opt('fechaVencimiento', dmy)),
    ...withOpt('vencimientoProximo', opt('fechaVencimientoNoFacturado', dmy)),
  };

  const movimientos: MovimientoTarjeta[] = [];
  for (const [key, moneda, facturado] of LISTS) {
    const list = json[key];
    if (absent(list)) continue;
    if (!Array.isArray(list)) throw unexpected(key);
    for (const m of list) movimientos.push(movimiento(m, moneda, facturado, account));
  }

  const { first, others } = account;
  return {
    tarjeta: {
      banco: BCI.slug,
      tarjeta: first.last4,
      ...(others.length ? { adicionales: others.map((c) => c.last4) } : {}),
      descripcion: first.label,
      nacional,
      internacional,
      facturacion,
    },
    movimientos,
  };
}

function movimiento(
  m: unknown,
  moneda: Moneda,
  facturado: boolean,
  account: CardAccount,
): MovimientoTarjeta {
  if (!isRecord(m)) throw unexpected('movimiento de tarjeta');
  const bank = amountIn(moneda)(m['monto'], 'monto de tarjeta').monto;
  // The movement's own label names its card ("<word> **** 0000"), not its sign.
  const label = typeof m['tipo'] === 'string' ? cardLabel(m['tipo']) : '';
  const own = LAST4.exec(label)?.[1];
  const total = m['totalCuotas'];
  const numero = m['numeroCuota'];
  return {
    banco: BCI.slug,
    tarjeta: own ?? account.first.last4,
    fecha: dmy(m['fecha'], 'fecha de tarjeta'),
    descripcion: typeof m['descripcion'] === 'string' ? maskCardNumbers(m['descripcion']) : '',
    monto: money(moneda, bank === 0 ? 0 : -bank),
    tipo: bank < 0 ? 'abono' : 'cargo',
    facturado,
    ...(typeof total === 'number' &&
    Number.isInteger(total) &&
    total > 1 &&
    typeof numero === 'number' &&
    Number.isInteger(numero)
      ? { cuota: { numero, total } }
      : {}),
    ...(m['adicional'] === true ? { adicional: true as const } : {}),
  };
}
