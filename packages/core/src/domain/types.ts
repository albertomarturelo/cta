import type { IsoDate } from '../dates/dates.js';
import type { Money } from '../money/money.js';

/** An account as `cta` reports it. Account data is PII: never logged or audited. */
export interface Cuenta {
  readonly banco: string;
  readonly numero: string;
  /** The bank's own product label, verbatim. */
  readonly tipo: string;
  readonly moneda: Money['moneda'];
}

export interface Saldo {
  readonly banco: string;
  readonly cuenta: string;
  readonly disponible: Money;
  readonly contable: Money;
  readonly retenciones?: Money;
}

/** A normalized movement (ADR-007): `monto` is signed, the description verbatim. */
export interface Movimiento {
  readonly banco: string;
  readonly cuenta: string;
  readonly fecha: IsoDate;
  readonly descripcion: string;
  readonly monto: Money;
  readonly tipo: 'cargo' | 'abono';
  readonly saldo?: Money;
}

/**
 * How far one account's movements reach (ADR-014): the oldest and newest dates
 * the bank returned, and whether nothing in the requested range is missing.
 */
export interface Cobertura {
  readonly cuenta: string;
  readonly desde?: IsoDate;
  readonly hasta?: IsoDate;
  readonly completo: boolean;
}

/** Movements of one or more accounts, with the coverage of each (ADR-014). */
export interface Cartola {
  readonly movimientos: readonly Movimiento[];
  readonly cobertura: readonly Cobertura[];
}
