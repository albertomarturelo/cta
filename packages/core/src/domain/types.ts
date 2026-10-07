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

/** One quota of a credit card account, every amount in the quota's currency (ADR-017). */
export interface Cupo {
  readonly total: Money;
  readonly utilizado: Money;
  readonly disponible: Money;
  /** Amount of the last billed statement. */
  readonly facturado?: Money;
  readonly pagoMinimo?: Money;
}

/** Billing dates of a card account (ADR-017), each omitted when the bank sends none. */
export interface Facturacion {
  readonly ultima?: IsoDate;
  readonly proxima?: IsoDate;
  readonly vencimiento?: IsoDate;
  readonly vencimientoProximo?: IsoDate;
}

/**
 * A credit card account as `cta` reports it (ADR-017): one per account, never
 * per plastic, so a shared quota appears once. Cards are named by their last 4
 * digits only; card numbers never leave the driver.
 */
export interface Tarjeta {
  readonly banco: string;
  /** Last 4 digits of the account's first card in the bank's list. */
  readonly tarjeta: string;
  /** Last 4 digits of the account's other cards (additional cards). */
  readonly adicionales?: readonly string[];
  /** The bank's own card label, verbatim. */
  readonly descripcion: string;
  /** National quota, `CLP`. */
  readonly nacional: Cupo;
  /** International quota, `USD` (cents). */
  readonly internacional: Cupo;
  readonly facturacion: Facturacion;
}

/** A card movement (ADR-017): `monto` signed like ADR-007, its currency says national or not. */
export interface MovimientoTarjeta {
  readonly banco: string;
  /** Last 4 digits of the card that made it. */
  readonly tarjeta: string;
  readonly fecha: IsoDate;
  readonly descripcion: string;
  readonly monto: Money;
  readonly tipo: 'cargo' | 'abono';
  /** In the last billed statement (true) or not yet billed (false). */
  readonly facturado: boolean;
  /** Only when the bank says it is one of more than one installment. */
  readonly cuota?: { readonly numero: number; readonly total: number };
  /** Only for an additional card's movement, by the bank's own flag. */
  readonly adicional?: true;
}

/** Card accounts of one bank and, when asked, their movements (ADR-017). */
export interface EstadoTarjetas {
  readonly tarjetas: readonly Tarjeta[];
  readonly movimientos?: readonly MovimientoTarjeta[];
}
