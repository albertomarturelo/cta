import type {
  BancoInfo,
  Cobertura,
  Cuenta,
  Money,
  Movimiento,
  Saldo,
} from '@albertomarturelo/cta-core';

/** Formats money for humans only; JSON output keeps integer minor units (ADR-007). */
export function formatMoney(m: Money): string {
  const negative = m.monto < 0;
  const abs = Math.abs(m.monto);
  const [whole, cents] =
    m.moneda === 'USD'
      ? [Math.trunc(abs / 100), String(abs % 100).padStart(2, '0')]
      : [abs, undefined];
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const prefix = m.moneda === 'USD' ? 'US$' : '$';
  return `${negative ? '-' : ''}${prefix} ${grouped}${cents === undefined ? '' : `,${cents}`}`;
}

/**
 * The STDERR warning `--human` owes the reader when a bank returned less than
 * the range (ADR-014); undefined when every account is complete.
 */
export function coverageWarning(cobertura: readonly Cobertura[]): string | undefined {
  const partial = cobertura.filter((c) => !c.completo);
  if (partial.length === 0) return undefined;
  return partial
    .map((c) =>
      c.desde === undefined
        ? `aviso: la cuenta ${c.cuenta} no devolvió movimientos; puede haber más fuera de lo que el banco entrega.`
        : `aviso: la cuenta ${c.cuenta} solo cubre desde ${c.desde}; puede faltar lo anterior.`,
    )
    .join('\n');
}

export const human = {
  login: (r: { banco: string; guardadaEn: string; sesionHasta?: string }) =>
    r.sesionHasta === undefined
      ? `Sesión guardada para ${r.banco} (${r.guardadaEn}).`
      : `Sesión de ${r.banco} abierta hasta ${r.sesionHasta}, en memoria, compartida por el CLI ` +
        'y el MCP de este equipo.',
  logout: (r: { banco: string }) => `Sesión de ${r.banco} eliminada de este equipo.`,
  bancos: (r: { bancos: readonly BancoInfo[] }) =>
    r.bancos.length === 0
      ? 'No hay bancos soportados todavía.'
      : r.bancos
          .map(
            (b) =>
              `${b.banco} (${b.codigo}) ${b.nombre}${b.sesionGuardada ? ' — sesión guardada' : ''}` +
              (b.sesionHasta === undefined ? '' : ` — sesión hasta ${b.sesionHasta}`),
          )
          .join('\n'),
  cuentas: (r: { cuentas: readonly Cuenta[] }) =>
    r.cuentas.length === 0
      ? 'Sin cuentas.'
      : r.cuentas.map((c) => `${c.numero}  ${c.tipo}  ${c.moneda}`).join('\n'),
  saldo: (r: { saldos: readonly Saldo[] }) =>
    r.saldos.length === 0
      ? 'Sin cuentas.'
      : r.saldos
          .map(
            (s) =>
              `${s.cuenta}  disponible ${formatMoney(s.disponible)}  contable ${formatMoney(s.contable)}` +
              (s.retenciones ? `  retenciones ${formatMoney(s.retenciones)}` : ''),
          )
          .join('\n'),
  movimientos: (r: { movimientos: readonly Movimiento[] }) =>
    r.movimientos.length === 0
      ? 'Sin movimientos en el rango.'
      : r.movimientos
          .map(
            (m) =>
              `${m.fecha}  ${m.cuenta}  ${formatMoney(m.monto).padStart(14)}  ${m.descripcion}`,
          )
          .join('\n'),
};
