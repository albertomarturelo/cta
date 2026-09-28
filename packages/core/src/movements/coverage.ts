import type { IsoDate } from '../dates/dates.js';
import type { Cobertura, Movimiento } from '../domain/types.js';
import type { DateRange } from '../seams/seams.js';

/** Inclusive on both ends; ISO dates compare as strings. */
export function inRange(fecha: IsoDate, range: DateRange): boolean {
  return (
    (range.desde === undefined || fecha >= range.desde) &&
    (range.hasta === undefined || fecha <= range.hasta)
  );
}

/**
 * Coverage of a read with no range, only the latest movements (ADR-014): it
 * reaches back to the oldest date returned, and a cap may have cut that day in
 * half, so only a `desde` strictly after it is vouched for.
 */
export function latestOnlyCoverage(
  cuenta: string,
  returned: readonly Pick<Movimiento, 'fecha'>[],
  range: DateRange,
): Cobertura {
  if (returned.length === 0) return { cuenta, completo: false };
  const fechas = returned.map((m) => m.fecha).sort();
  const desde = fechas[0]!;
  const hasta = fechas[fechas.length - 1]!;
  return { cuenta, desde, hasta, completo: range.desde !== undefined && range.desde > desde };
}
