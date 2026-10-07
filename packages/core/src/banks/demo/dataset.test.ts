import { describe, expect, it } from 'vitest';

import {
  addDays,
  DEMO,
  demoCuentas,
  demoMovimientos,
  demoSaldos,
  demoTarjetas,
} from './dataset.js';

const TODAY = '2026-10-07';

describe('demo dataset (ADR-019)', () => {
  it('is deterministic for a given day', () => {
    expect(demoMovimientos(TODAY)).toEqual(demoMovimientos(TODAY));
    expect(demoTarjetas(TODAY)).toEqual(demoTarjetas(TODAY));
    expect(demoSaldos(TODAY)).toEqual(demoSaldos(TODAY));
  });

  it('keeps a movement, its amount and its balance from one day to the next', () => {
    const before = demoMovimientos(TODAY);
    const after = demoMovimientos(addDays(TODAY, 1));
    for (const c of demoCuentas()) {
      const shared = (list: readonly { fecha: string }[]) =>
        list.filter((m) => m.fecha > addDays(TODAY, 1 - DEMO.historyDays) && m.fecha <= TODAY);
      expect(shared(after.get(c.numero)!)).toEqual(shared(before.get(c.numero)!));
    }
  });

  it('dates movements within the history window, newest first, with a running balance', () => {
    for (const list of demoMovimientos(TODAY).values()) {
      const fechas = list.map((m) => m.fecha);
      expect([...fechas].sort().reverse()).toEqual(fechas);
      expect(fechas.at(-1)! >= addDays(TODAY, 1 - DEMO.historyDays)).toBe(true);
      expect(fechas[0]! <= TODAY).toBe(true);
      for (let i = 0; i + 1 < list.length; i++) {
        expect(list[i]!.saldo!.monto - list[i]!.monto.monto).toBe(list[i + 1]!.saldo!.monto);
      }
      for (const m of list) expect(m.monto.monto < 0).toBe(m.tipo === 'cargo');
    }
  });

  it('never lets an account balance go below zero (sampled weekly over three years)', () => {
    for (let d = '2025-02-01'; d <= '2028-02-01'; d = addDays(d, 7)) {
      for (const list of demoMovimientos(d).values()) {
        for (const m of list) expect(m.saldo!.monto).toBeGreaterThan(0);
      }
    }
  });

  it('balances follow the last movement; the hold makes disponible lower than contable', () => {
    const movs = demoMovimientos(TODAY);
    for (const s of demoSaldos(TODAY)) {
      expect(s.contable.monto).toBe(movs.get(s.cuenta)![0]!.saldo!.monto);
      expect(s.disponible.monto).toBe(s.contable.monto - (s.retenciones?.monto ?? 0));
    }
  });

  it('carries salary, insurance, transfers and card payments that match the cards', () => {
    const all = [...demoMovimientos(TODAY).values()].flat().map((m) => m.descripcion);
    for (const kind of ['REMUNERACION', 'SEGURO', 'TRANSF.', 'PAGO TARJETA']) {
      expect(all.some((d) => d.includes(kind))).toBe(true);
    }
    const { movimientos } = demoTarjetas(TODAY);
    const paid = [...demoMovimientos(TODAY).values()]
      .flat()
      .filter((m) => m.descripcion.startsWith('PAGO TARJETA'))
      .map((m) => -m.monto.monto)
      .sort();
    const received = movimientos
      .filter((m) => m.tipo === 'abono')
      .map((m) => m.monto.monto)
      .sort();
    expect(received.every((r) => paid.includes(r))).toBe(true);
  });

  it('has a card account with an additional card, two currencies and billing dates in order', () => {
    const { tarjetas, movimientos } = demoTarjetas(TODAY);
    expect(tarjetas.some((t) => (t.adicionales?.length ?? 0) > 0)).toBe(true);
    for (const t of tarjetas) {
      expect(t.nacional.total.moneda).toBe('CLP');
      expect(t.internacional.total.moneda).toBe('USD');
      expect(t.nacional.disponible.monto).toBe(t.nacional.total.monto - t.nacional.utilizado.monto);
      const f = t.facturacion;
      expect(f.ultima! <= TODAY && TODAY < f.proxima!).toBe(true);
      expect(f.ultima! < f.vencimiento! && f.vencimiento! < f.vencimientoProximo!).toBe(true);
    }
    expect(new Set(movimientos.map((m) => m.facturado))).toEqual(new Set([true, false]));
    expect(movimientos.some((m) => m.monto.moneda === 'USD')).toBe(true);
    expect(movimientos.some((m) => m.adicional === true)).toBe(true);
    for (const m of movimientos) {
      expect(m.monto.monto < 0).toBe(m.tipo === 'cargo');
      if (m.cuota) expect(m.cuota.numero >= 1 && m.cuota.numero <= m.cuota.total).toBe(true);
    }
  });
});
