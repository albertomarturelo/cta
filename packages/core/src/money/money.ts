/** ISO 4217 codes `cta` normalizes to, with their minor-unit exponent (ADR-007). */
export const CURRENCY_EXPONENT = { CLP: 0, USD: 2 } as const;
export type Moneda = keyof typeof CURRENCY_EXPONENT;

/** An amount in integer minor units. Never a float, never a formatted string. */
export interface Money {
  readonly moneda: Moneda;
  readonly monto: number;
}

export function money(moneda: Moneda, monto: number): Money {
  if (!Number.isSafeInteger(monto)) {
    throw new RangeError(`Money amount must be a safe integer in minor units, got ${monto}`);
  }
  return { moneda, monto };
}

export function isMoneda(value: string): value is Moneda {
  return Object.hasOwn(CURRENCY_EXPONENT, value);
}

/**
 * Converts sign + integer digits + fraction digits into minor units, refusing
 * any fraction the currency cannot represent (e.g. 0.50 CLP).
 */
function toMinorUnits(negative: boolean, whole: string, fraction: string, moneda: Moneda): Money {
  const exponent = CURRENCY_EXPONENT[moneda];
  const kept = fraction.slice(0, exponent).padEnd(exponent, '0');
  const dropped = fraction.slice(exponent);
  if (/[1-9]/.test(dropped)) {
    throw new RangeError(`Amount has more precision than ${moneda} allows`);
  }
  const digits = `${whole.replace(/^0+(?=\d)/, '')}${kept}`;
  const monto = Number(digits);
  if (!Number.isSafeInteger(monto)) throw new RangeError('Amount out of range');
  return money(moneda, negative && monto !== 0 ? -monto : monto);
}

/** Parses a machine decimal such as `1000.00` or `-15.5` (dot decimals, no grouping). */
export function parseDecimalAmount(input: string, moneda: Moneda): Money {
  const m = /^\s*([+-])?(\d+)(?:\.(\d+))?\s*$/.exec(input);
  if (!m) throw new SyntaxError(`Not a decimal amount: '${input}'`);
  return toMinorUnits(m[1] === '-', m[2] ?? '0', m[3] ?? '', moneda);
}

/**
 * Parses an amount as Chilean pages render it: optional `$`, `.` thousands,
 * optional `,` decimals, sign before or after the `$` (`$ -1.234`, `-$1.234,50`).
 */
export function parseEsClAmount(input: string, moneda: Moneda): Money {
  const m = /^\s*([+-])?\s*(US)?\$?\s*([+-])?\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?\s*$/.exec(
    input,
  );
  if (!m) throw new SyntaxError(`Not an es-CL amount: '${input}'`);
  if (m[1] && m[3]) throw new SyntaxError(`Two signs in amount: '${input}'`);
  // A `US$` prefix names the currency; it must agree with the one expected.
  if (m[2] && moneda !== 'USD') {
    throw new SyntaxError(`Amount '${input}' is in USD, expected ${moneda}`);
  }
  const negative = (m[1] ?? m[3]) === '-';
  return toMinorUnits(negative, (m[4] ?? '0').replace(/\./g, ''), m[5] ?? '', moneda);
}
