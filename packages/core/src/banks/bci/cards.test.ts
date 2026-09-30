import { describe, expect, it } from 'vitest';

import { BankError, NoSuchCard } from '../../errors/errors.js';
import {
  groupByAccount,
  matchTarjeta,
  parseInformacionTarjeta,
  parseTarjetasLista,
} from './cards.js';

// Synthetic shapes of the contract (docs/bank-contract/bci.md, "Credit cards");
// invented keys, labels and amounts.
// A digit run of card-number length, built at run time: never a card-shaped literal (ADR-009).
const longRun = (last4: string) => `${'0'.repeat(12)}${last4}`;

const lista = [
  {
    numeroTarjeta: '1001',
    numeroDeCuenta: '900001',
    descripcionLogo: '1',
    tipoCliente: 'P',
    descripcionSelectorTarjeta: 'Visa Ficticia **** 1111',
  },
  {
    numeroTarjeta: '1002',
    numeroDeCuenta: '900002',
    descripcionLogo: '2',
    tipoCliente: 'P',
    descripcionSelectorTarjeta: 'Master Ficticia **** 2222',
  },
  {
    numeroTarjeta: '1003',
    numeroDeCuenta: '900002',
    descripcionLogo: '2',
    tipoCliente: 'P',
    descripcionSelectorTarjeta: 'Master Ficticia **** 3333',
  },
];

const item = (over: Record<string, unknown>) => ({
  monto: 1000,
  descripcion: 'COMERCIO FICTICIO',
  latitud: null,
  fecha: '3/9/2026',
  numeroCuota: 0,
  totalCuotas: 0,
  numeroTarjeta: '1001',
  codigoReferencia: 'x',
  tipo: 'Titular **** 1111',
  ciudad: '',
  temporal: false,
  adicional: false,
  ...over,
});

const informacion = (over: Record<string, unknown> = {}) => ({
  cupoNacional: 1_000_000,
  cupoUtilizadoNacional: 250_000,
  cupoDisponibleNacional: 750_000,
  montoFacturadoNacional: 120_000,
  pagoMinimo: 12_000,
  cupoInternacional: 1000,
  cupoUtilizadoInternacional: 12.5,
  cupoDisponibleInternacional: 987.5,
  montoFacturadoInternacional: 10.25,
  fechaVencimiento: '5/10/2026',
  fechaVencimientoNoFacturado: '5/11/2026',
  fechaFacturacion: '20/9/2026',
  fechaProximaFacturacion: '20/10/2026',
  periodoFacturacion: 'texto',
  errorNacional: null,
  errorInternacional: null,
  errorNoFacturados: null,
  facturadosNacionales: [
    item({}),
    item({ monto: -50_000, descripcion: 'PAGO', fecha: '15/9/2026' }),
  ],
  noFacturadosNacional: [
    item({
      monto: 30_000,
      numeroCuota: 2,
      totalCuotas: 6,
      tipo: 'Adicional **** 3333',
      adicional: true,
    }),
  ],
  facturadosInternacionales: [item({ monto: 10.25, fecha: '1/9/2026' })],
  noFacturadosInternacional: [item({ monto: -2.5 })],
  ...over,
});

describe('BCI cards', () => {
  it('lists one entry per plastic, keeping keys and the last 4 digits', () => {
    expect(parseTarjetasLista(lista)).toEqual([
      { cardKey: '1001', accountKey: '900001', label: 'Visa Ficticia **** 1111', last4: '1111' },
      { cardKey: '1002', accountKey: '900002', label: 'Master Ficticia **** 2222', last4: '2222' },
      { cardKey: '1003', accountKey: '900002', label: 'Master Ficticia **** 3333', last4: '3333' },
    ]);
  });

  it('rejects a card list it does not recognize, and a label with a long digit run', () => {
    expect(() => parseTarjetasLista({ tarjetas: [] })).toThrow(BankError);
    expect(() => parseTarjetasLista([{ numeroTarjeta: 1001 }])).toThrow(BankError);
    const long = [{ ...lista[0], descripcionSelectorTarjeta: `Visa ${longRun('1111')}` }];
    expect(() => parseTarjetasLista(long)).toThrow(BankError);
    try {
      parseTarjetasLista(long);
    } catch (err) {
      // The message names the field, never the label.
      expect((err as Error).message).not.toMatch(/\d{5,}/);
    }
  });

  it('groups an additional card with its account, in the bank order', () => {
    const accounts = groupByAccount(parseTarjetasLista(lista));
    expect(accounts.map((a) => [a.first.last4, a.others.map((c) => c.last4)])).toEqual([
      ['1111', []],
      ['2222', ['3333']],
    ]);
  });

  it('selects an account by the last 4 digits of any of its cards', () => {
    const accounts = groupByAccount(parseTarjetasLista(lista));
    expect(matchTarjeta(accounts, '3333').first.last4).toBe('2222');
    expect(matchTarjeta(accounts, '1111').first.last4).toBe('1111');
    expect(() => matchTarjeta(accounts, '9999')).toThrow(NoSuchCard);
    expect(() => matchTarjeta(accounts, '11')).toThrow(NoSuchCard);
  });

  it('refuses a selector that matches cards of two accounts', () => {
    const twin = [...lista, { ...lista[0], numeroTarjeta: '1004', numeroDeCuenta: '900003' }];
    const accounts = groupByAccount(parseTarjetasLista(twin));
    expect(() => matchTarjeta(accounts, '1111')).toThrow(/más de una cuenta/);
  });

  it('reads quotas in minor units: whole pesos, and dollars into cents', () => {
    const [account] = groupByAccount(parseTarjetasLista(lista));
    const { tarjeta } = parseInformacionTarjeta(informacion(), account!);
    expect(tarjeta).toEqual({
      banco: 'bci',
      tarjeta: '1111',
      descripcion: 'Visa Ficticia **** 1111',
      nacional: {
        total: { moneda: 'CLP', monto: 1_000_000 },
        utilizado: { moneda: 'CLP', monto: 250_000 },
        disponible: { moneda: 'CLP', monto: 750_000 },
        facturado: { moneda: 'CLP', monto: 120_000 },
        pagoMinimo: { moneda: 'CLP', monto: 12_000 },
      },
      internacional: {
        total: { moneda: 'USD', monto: 100_000 },
        utilizado: { moneda: 'USD', monto: 1250 },
        disponible: { moneda: 'USD', monto: 98_750 },
        facturado: { moneda: 'USD', monto: 1025 },
      },
      facturacion: {
        ultima: '2026-09-20',
        proxima: '2026-10-20',
        vencimiento: '2026-10-05',
        vencimientoProximo: '2026-11-05',
      },
    });
  });

  it('names the additional cards of a shared account once', () => {
    const accounts = groupByAccount(parseTarjetasLista(lista));
    const { tarjeta } = parseInformacionTarjeta(informacion(), accounts[1]!);
    expect([tarjeta.tarjeta, tarjeta.adicionales]).toEqual(['2222', ['3333']]);
  });

  it('omits what the bank sends as null: no international billing', () => {
    const [account] = groupByAccount(parseTarjetasLista(lista));
    const { tarjeta, movimientos } = parseInformacionTarjeta(
      informacion({
        montoFacturadoInternacional: null,
        facturadosInternacionales: null,
        noFacturadosInternacional: [],
        errorInternacional: { mensaje: 'sin datos', codigo: '1' },
      }),
      account!,
    );
    expect(tarjeta.internacional.facturado).toBeUndefined();
    expect(movimientos.every((m) => m.monto.moneda === 'CLP')).toBe(true);
  });

  it('signs movements like ADR-007, keeping billing state, installments and the card', () => {
    const [account] = groupByAccount(parseTarjetasLista(lista));
    const { movimientos } = parseInformacionTarjeta(informacion(), account!);
    expect(movimientos).toEqual([
      {
        banco: 'bci',
        tarjeta: '1111',
        fecha: '2026-09-03',
        descripcion: 'COMERCIO FICTICIO',
        monto: { moneda: 'CLP', monto: -1000 },
        tipo: 'cargo',
        facturado: true,
      },
      {
        banco: 'bci',
        tarjeta: '1111',
        fecha: '2026-09-15',
        descripcion: 'PAGO',
        monto: { moneda: 'CLP', monto: 50_000 },
        tipo: 'abono',
        facturado: true,
      },
      {
        banco: 'bci',
        tarjeta: '3333',
        fecha: '2026-09-03',
        descripcion: 'COMERCIO FICTICIO',
        monto: { moneda: 'CLP', monto: -30_000 },
        tipo: 'cargo',
        facturado: false,
        cuota: { numero: 2, total: 6 },
        adicional: true,
      },
      {
        banco: 'bci',
        tarjeta: '1111',
        fecha: '2026-09-01',
        descripcion: 'COMERCIO FICTICIO',
        monto: { moneda: 'USD', monto: -1025 },
        tipo: 'cargo',
        facturado: true,
      },
      {
        banco: 'bci',
        tarjeta: '1111',
        fecha: '2026-09-03',
        descripcion: 'COMERCIO FICTICIO',
        monto: { moneda: 'USD', monto: 250 },
        tipo: 'abono',
        facturado: false,
      },
    ]);
  });

  it('keeps descriptions verbatim but masks a card-number-length digit run', () => {
    const [account] = groupByAccount(parseTarjetasLista(lista));
    const { movimientos } = parseInformacionTarjeta(
      informacion({
        facturadosNacionales: [
          item({ descripcion: 'TIENDA 123456 REF' }),
          item({ descripcion: `PAGO ${longRun('9999')}` }),
        ],
      }),
      account!,
    );
    expect(movimientos.slice(0, 2).map((m) => m.descripcion)).toEqual([
      'TIENDA 123456 REF',
      'PAGO ****9999',
    ]);
  });

  it('surfaces a national error verbatim and rejects shapes it does not know', () => {
    const [account] = groupByAccount(parseTarjetasLista(lista));
    expect(() =>
      parseInformacionTarjeta(
        informacion({ errorNacional: { mensaje: 'Servicio no disponible' } }),
        account!,
      ),
    ).toThrow('Servicio no disponible');
    expect(() =>
      parseInformacionTarjeta(informacion({ fechaVencimiento: '2026/10/05' }), account!),
    ).toThrow(BankError);
    expect(() =>
      parseInformacionTarjeta(informacion({ fechaVencimiento: '31/2/2026' }), account!),
    ).toThrow(BankError);
    expect(() => parseInformacionTarjeta(informacion({ cupoNacional: 10.5 }), account!)).toThrow(
      BankError,
    );
    expect(() =>
      parseInformacionTarjeta(informacion({ cupoUtilizadoInternacional: 1.005 }), account!),
    ).toThrow(BankError);
    expect(() =>
      parseInformacionTarjeta(informacion({ facturadosNacionales: {} }), account!),
    ).toThrow(BankError);
  });
});
