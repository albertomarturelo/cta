import type { IsoDate } from '../../dates/dates.js';
import type {
  Cuenta,
  Cupo,
  Movimiento,
  MovimientoTarjeta,
  Saldo,
  Tarjeta,
} from '../../domain/types.js';
import { money } from '../../money/money.js';

/**
 * The fictitious bank of ADR-019: a pure, deterministic generator keyed on the
 * calendar. Each amount depends only on its own date and label, so a movement
 * keeps its amount from one day to the next, and dates follow today so "this
 * month" always has data. Every name and number here is invented.
 */

export const DEMO = {
  slug: 'demo',
  code: '000',
  name: 'Banco Demo (datos ficticios)',
  // Like a real bank (ADR-014): a read returns only the latest movements.
  latestPerAccount: 40,
  historyDays: 60,
  enableHint:
    'El banco demo se activa con CTA_DEMO=1; si ya hay una sesión abierta sin esa variable, ciérrala (cta logout <banco>) y vuelve a iniciar.',
} as const;

const CORRIENTE = '90004821';
const VISTA = '90001937';

// ---------- calendar ----------

const DAY_MS = 86_400_000;
const ms = (d: IsoDate) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number): IsoDate => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: IsoDate, n: number): IsoDate => iso(ms(d) + n * DAY_MS);
const weekday = (d: IsoDate) => new Date(ms(d)).getUTCDay(); // 0 = Sunday
const dayOf = (d: IsoDate) => Number(d.slice(8, 10));
const monthKey = (d: IsoDate) => d.slice(0, 7);
const monthIndex = (d: IsoDate) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;

/** The date `n` months after `d`'s month, on `day` (clamped to the month's end). */
function monthDay(d: IsoDate, n: number, day: number): IsoDate {
  const m = monthIndex(d) + n;
  const year = Math.floor(m / 12);
  const month = m % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return iso(Date.UTC(year, month, Math.min(day, last)));
}

function lastBusinessDay(d: IsoDate): IsoDate {
  let last = monthDay(d, 1, 1);
  do last = addDays(last, -1);
  while (weekday(last) === 0 || weekday(last) === 6);
  return last;
}

function days(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------- deterministic variation ----------

/** FNV-1a of a string, as a fraction in [0, 1). */
function unit(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x1_0000_0000;
}

const vary = (key: string, base: number, spread: number, step = 10) =>
  Math.round((base + (unit(key) * 2 - 1) * spread) / step) * step;

const sometimes = (key: string, p: number) => unit(key) < p;

// ---------- credit cards ----------

const BILLING_DAY = 22;
const DUE_DAY = 10;

interface CardRule {
  readonly plastic: string;
  readonly descripcion: string;
  readonly moneda: 'CLP' | 'USD';
  readonly when: (d: IsoDate) => boolean;
  readonly amount: (d: IsoDate) => number;
  readonly abono?: true;
  readonly cuotas?: number;
}

interface CardAccount {
  readonly tarjeta: string;
  readonly adicionales: readonly string[];
  readonly descripcion: string;
  readonly cupoClp: number;
  readonly cupoUsd: number;
  readonly paymentDay: number;
  readonly rules: readonly CardRule[];
}

const VISA: CardAccount = {
  tarjeta: '7319',
  adicionales: ['5520'],
  descripcion: 'Visa Demo **** 7319',
  cupoClp: 3_000_000,
  cupoUsd: 100_000,
  paymentDay: 8,
  rules: [
    {
      plastic: '7319',
      descripcion: 'SEGURO DESGRAVAMEN TARJETA',
      moneda: 'CLP',
      when: (d) => dayOf(d) === 1,
      amount: () => 3_890,
    },
    {
      plastic: '7319',
      descripcion: 'SEGURO PROTECCION FRAUDE',
      moneda: 'CLP',
      when: (d) => dayOf(d) === 1,
      amount: () => 2_490,
    },
    {
      plastic: '7319',
      descripcion: 'STREAMING VIDEO PLUS',
      moneda: 'USD',
      when: (d) => dayOf(d) === 4,
      amount: () => 1_299,
    },
    {
      plastic: '7319',
      descripcion: 'STREAMING MUSICA ONDA',
      moneda: 'USD',
      when: (d) => dayOf(d) === 11,
      amount: () => 999,
    },
    {
      plastic: '7319',
      descripcion: 'ALMACENAMIENTO NUBE',
      moneda: 'USD',
      when: (d) => dayOf(d) === 16,
      amount: () => 299,
    },
    {
      plastic: '7319',
      descripcion: 'TIENDA DEPORTES CUMBRE',
      moneda: 'CLP',
      when: (d) => dayOf(d) === 14,
      amount: () => 34_990,
      cuotas: 6,
    },
    {
      plastic: '7319',
      descripcion: 'SUPERMERCADO LOS AROMOS',
      moneda: 'CLP',
      when: (d) => weekday(d) === 3,
      amount: (d) => vary(`aromos${d}`, 54_000, 20_000),
    },
    {
      plastic: '7319',
      descripcion: 'RESTAURANTE EL FOGON',
      moneda: 'CLP',
      when: (d) => weekday(d) === 5 && sometimes(`fogon${d}`, 0.6),
      amount: (d) => vary(`fogon$${d}`, 38_000, 15_000),
    },
    {
      plastic: '5520',
      descripcion: 'FARMACIA SAN ROQUE',
      moneda: 'CLP',
      when: (d) => weekday(d) === 4 && sometimes(`farm-tc${d}`, 0.5),
      amount: (d) => vary(`farm-tc$${d}`, 12_000, 6_000),
    },
    {
      plastic: '5520',
      descripcion: 'LIBRERIA PAGINAS',
      moneda: 'CLP',
      when: (d) => dayOf(d) === 13,
      amount: () => 18_990,
    },
  ],
};

const MASTERCARD: CardAccount = {
  tarjeta: '2048',
  adicionales: [],
  descripcion: 'Mastercard Demo **** 2048',
  cupoClp: 1_500_000,
  cupoUsd: 50_000,
  paymentDay: 9,
  rules: [
    {
      plastic: '2048',
      descripcion: 'SEGURO DESGRAVAMEN TARJETA',
      moneda: 'CLP',
      when: (d) => dayOf(d) === 1,
      amount: () => 2_290,
    },
    {
      plastic: '2048',
      descripcion: 'AEROLINEA DEMO PASAJES',
      moneda: 'CLP',
      when: (d) => dayOf(d) === 6,
      amount: () => 64_990,
      cuotas: 6,
    },
    {
      plastic: '2048',
      descripcion: 'SEGURO HOGAR ASEGURADORA ANDINA',
      moneda: 'CLP',
      when: (d) => dayOf(d) === 19,
      amount: () => 15_900,
    },
    {
      plastic: '2048',
      descripcion: 'HOTEL COSTA AZUL RESERVA',
      moneda: 'USD',
      when: (d) => dayOf(d) === 23,
      amount: () => 21_000,
    },
    {
      plastic: '2048',
      descripcion: 'ESTACION DE SERVICIO COSTANERA',
      moneda: 'CLP',
      when: (d) => weekday(d) === 2 && sometimes(`costanera${d}`, 0.5),
      amount: (d) => vary(`costanera$${d}`, 42_000, 9_000),
    },
  ],
};

const CARDS = [VISA, MASTERCARD] as const;

/** The billing date on or before `d`: this month's day 22, or last month's. */
function lastBilling(d: IsoDate): IsoDate {
  return dayOf(d) >= BILLING_DAY ? monthDay(d, 0, BILLING_DAY) : monthDay(d, -1, BILLING_DAY);
}

/** Every card charge or credit of `card` dated in (from, to], oldest first. */
function cardMovements(card: CardAccount, from: IsoDate, to: IsoDate) {
  const out: { fecha: IsoDate; rule: CardRule; monto: number }[] = [];
  for (const d of days(addDays(from, 1), to)) {
    for (const rule of card.rules)
      if (rule.when(d)) out.push({ fecha: d, rule, monto: rule.amount(d) });
    // The payment of the statement billed the month before, as a credit.
    if (dayOf(d) === card.paymentDay) {
      const billed = statementClp(card, lastBilling(addDays(d, -1)));
      if (billed > 0) {
        out.push({
          fecha: d,
          rule: {
            plastic: card.tarjeta,
            descripcion: 'PAGO RECIBIDO - GRACIAS',
            moneda: 'CLP',
            when: () => true,
            amount: () => billed,
            abono: true,
          },
          monto: billed,
        });
      }
    }
  }
  return out;
}

/** The national charges billed on `billing`: the month that ends that day. */
function statementClp(card: CardAccount, billing: IsoDate): number {
  let total = 0;
  for (const d of days(addDays(monthDay(billing, -1, BILLING_DAY), 1), billing)) {
    for (const rule of card.rules)
      if (rule.moneda === 'CLP' && rule.when(d)) total += rule.amount(d);
  }
  return total;
}

function sum(list: readonly { monto: number; rule: CardRule }[], moneda: 'CLP' | 'USD'): number {
  return list
    .filter((m) => m.rule.moneda === moneda && !m.rule.abono)
    .reduce((t, m) => t + m.monto, 0);
}

function cupo(moneda: 'CLP' | 'USD', total: number, utilizado: number, facturado: number): Cupo {
  return {
    total: money(moneda, total),
    utilizado: money(moneda, utilizado),
    disponible: money(moneda, total - utilizado),
    ...(facturado > 0 ? { facturado: money(moneda, facturado) } : {}),
    ...(moneda === 'CLP' && facturado > 0
      ? { pagoMinimo: money('CLP', Math.round((facturado * 0.05) / 10) * 10) }
      : {}),
  };
}

/** Card accounts and their billed and unbilled movements, as of `today`. */
export function demoTarjetas(today: IsoDate): {
  tarjetas: Tarjeta[];
  movimientos: MovimientoTarjeta[];
} {
  const ultima = lastBilling(today);
  const anterior = monthDay(ultima, -1, BILLING_DAY);
  const tarjetas: Tarjeta[] = [];
  const movimientos: MovimientoTarjeta[] = [];
  for (const card of CARDS) {
    const billed = cardMovements(card, anterior, ultima);
    const unbilled = cardMovements(card, ultima, today);
    const pendingCuotas = card.rules
      .filter((r) => r.cuotas !== undefined)
      .reduce((t, r) => t + r.amount(today) * (r.cuotas! - cuotaOf(today, r.cuotas!)), 0);
    tarjetas.push({
      banco: DEMO.slug,
      tarjeta: card.tarjeta,
      ...(card.adicionales.length > 0 ? { adicionales: card.adicionales } : {}),
      descripcion: card.descripcion,
      nacional: cupo('CLP', card.cupoClp, sum(unbilled, 'CLP') + pendingCuotas, sum(billed, 'CLP')),
      internacional: cupo('USD', card.cupoUsd, sum(unbilled, 'USD'), sum(billed, 'USD')),
      facturacion: {
        ultima,
        proxima: monthDay(ultima, 1, BILLING_DAY),
        vencimiento: monthDay(ultima, 1, DUE_DAY),
        vencimientoProximo: monthDay(ultima, 2, DUE_DAY),
      },
    });
    for (const [list, facturado] of [
      [billed, true],
      [unbilled, false],
    ] as const) {
      for (const m of list) {
        movimientos.push({
          banco: DEMO.slug,
          tarjeta: m.rule.plastic,
          fecha: m.fecha,
          descripcion: m.rule.descripcion,
          monto: money(m.rule.moneda, m.rule.abono ? m.monto : -m.monto),
          tipo: m.rule.abono ? 'abono' : 'cargo',
          facturado,
          ...(m.rule.cuotas !== undefined
            ? { cuota: { numero: cuotaOf(m.fecha, m.rule.cuotas), total: m.rule.cuotas } }
            : {}),
          ...(m.rule.plastic !== card.tarjeta ? { adicional: true as const } : {}),
        });
      }
    }
  }
  movimientos.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  return { tarjetas, movimientos };
}

/** Which installment a monthly charge is on `d`: it cycles 1..total with the months. */
function cuotaOf(d: IsoDate, total: number): number {
  return (monthIndex(d) % total) + 1;
}

// ---------- accounts ----------

interface AccountRule {
  readonly cuenta: string;
  readonly descripcion: string;
  readonly when: (d: IsoDate) => boolean;
  readonly amount: (d: IsoDate) => number;
  readonly abono?: true;
}

const ACCOUNT_RULES: readonly AccountRule[] = [
  {
    cuenta: CORRIENTE,
    descripcion: 'COMISION MANTENCION CUENTA CORRIENTE',
    when: (d) => dayOf(d) === 1,
    amount: () => 6_490,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'TRANSF. A CUENTA VISTA PROPIA ****1937',
    when: (d) => dayOf(d) === 2,
    amount: () => 140_000,
  },
  {
    cuenta: VISTA,
    descripcion: 'TRANSF. DESDE CUENTA CORRIENTE PROPIA ****4821',
    when: (d) => dayOf(d) === 2,
    amount: () => 140_000,
    abono: true,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAC SEGURO AUTOMOTRIZ ASEGURADORA ANDINA',
    when: (d) => dayOf(d) === 3,
    amount: () => 42_300,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAC SEGURO DE VIDA ASEGURADORA ANDINA',
    when: (d) => dayOf(d) === 3,
    amount: () => 18_900,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'TRANSF. A TERCEROS - ARRIENDO DEPARTAMENTO',
    when: (d) => dayOf(d) === 5,
    amount: () => 650_000,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAC AHORRO PREVISIONAL VOLUNTARIO',
    when: (d) => dayOf(d) === 6,
    amount: () => 100_000,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAC SEGURO COMPLEMENTARIO DE SALUD',
    when: (d) => dayOf(d) === 7,
    amount: () => 24_500,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAGO TARJETA DE CREDITO VISA DEMO ****7319',
    when: (d) => dayOf(d) === VISA.paymentDay,
    amount: (d) => statementClp(VISA, lastBilling(addDays(d, -1))),
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAGO TARJETA DE CREDITO MASTERCARD DEMO ****2048',
    when: (d) => dayOf(d) === MASTERCARD.paymentDay,
    amount: (d) => statementClp(MASTERCARD, lastBilling(addDays(d, -1))),
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAGO CUENTA LUZ - ELECTRICA DEL VALLE',
    when: (d) => dayOf(d) === 10,
    amount: (d) => vary(`luz${monthKey(d)}`, 42_000, 9_000),
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAGO CUENTA AGUA - AGUAS DEL VALLE',
    when: (d) => dayOf(d) === 12,
    amount: (d) => vary(`agua${monthKey(d)}`, 19_000, 5_000),
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAGO INTERNET Y TELEFONIA - FIBRANET',
    when: (d) => dayOf(d) === 15,
    amount: () => 29_990,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAGO GAS - GASCENTRO',
    when: (d) => dayOf(d) === 18,
    amount: (d) => vary(`gas${monthKey(d)}`, 28_000, 8_000),
  },
  {
    cuenta: VISTA,
    descripcion: 'TRANSF. A TERCEROS - CUOTA CLUB DEPORTIVO',
    when: (d) => dayOf(d) === 20,
    amount: () => 25_000,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'TRANSF. DE TERCEROS - DEVOLUCION PRESTAMO',
    when: (d) => dayOf(d) === 21,
    amount: () => 50_000,
    abono: true,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'PAGO GASTOS COMUNES - EDIFICIO LOS ROBLES',
    when: (d) => dayOf(d) === 25,
    amount: (d) => vary(`gc${monthKey(d)}`, 85_000, 10_000),
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'REMUNERACION - EMPRESA DEMO SPA',
    when: (d) => d === lastBusinessDay(d),
    amount: () => 2_350_000,
    abono: true,
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'COMPRA DEBITO SUPERMERCADO EL ALMENDRO',
    when: (d) => weekday(d) === 6,
    amount: (d) => vary(`almendro${d}`, 72_000, 25_000),
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'COMPRA DEBITO ESTACION DE SERVICIO RUTA 5',
    when: (d) => weekday(d) === 2,
    amount: (d) => vary(`ruta5${d}`, 38_000, 8_000),
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'COMPRA DEBITO FARMACIA SAN ROQUE',
    when: (d) => weekday(d) === 4 && sometimes(`farm${d}`, 0.5),
    amount: (d) => vary(`farm$${d}`, 15_000, 9_000),
  },
  {
    cuenta: CORRIENTE,
    descripcion: 'GIRO CAJERO AUTOMATICO',
    when: (d) => weekday(d) === 5 && Math.floor(ms(d) / (7 * DAY_MS)) % 2 === 0,
    amount: () => 40_000,
  },
  {
    cuenta: VISTA,
    descripcion: 'CARGA TARJETA DE TRANSPORTE',
    when: (d) => weekday(d) === 1,
    amount: () => 10_000,
  },
  {
    cuenta: VISTA,
    descripcion: 'COMPRA DEBITO CAFETERIA LA ESQUINA',
    when: (d) => weekday(d) >= 1 && weekday(d) <= 5 && sometimes(`cafe${d}`, 0.35),
    amount: (d) => vary(`cafe$${d}`, 3_500, 1_200),
  },
  {
    cuenta: VISTA,
    descripcion: 'COMPRA DEBITO APP DELIVERY COMIDA',
    when: (d) => weekday(d) === 0 && sometimes(`delivery${d}`, 0.6),
    amount: (d) => vary(`delivery$${d}`, 16_000, 6_000),
  },
];

// Balances run from a fixed day, so each one is the same whatever "today" is;
// the monthly flows roughly net out, so they neither run dry nor pile up.
const EPOCH: IsoDate = '2025-01-01';
const OPENING = { [CORRIENTE]: 3_300_000, [VISTA]: 200_000 } as const;
// A deposit still on hold: contable includes it, disponible does not.
const RETENCION_CORRIENTE = 15_000;

export function demoCuentas(): Cuenta[] {
  return [
    { banco: DEMO.slug, numero: CORRIENTE, tipo: 'Cuenta Corriente', moneda: 'CLP' },
    { banco: DEMO.slug, numero: VISTA, tipo: 'Cuenta Vista', moneda: 'CLP' },
  ];
}

/** Every movement of the history window per account, newest first, with its running balance. */
export function demoMovimientos(today: IsoDate): Map<string, Movimiento[]> {
  const balance = new Map<string, number>(Object.entries(OPENING));
  const byAccount = new Map<string, Movimiento[]>(demoCuentas().map((c) => [c.numero, []]));
  const from = addDays(today, 1 - DEMO.historyDays);
  for (const d of days(from < EPOCH ? from : EPOCH, today)) {
    for (const rule of ACCOUNT_RULES) {
      if (!rule.when(d)) continue;
      const amount = rule.amount(d);
      if (amount <= 0) continue;
      const signed = rule.abono ? amount : -amount;
      const saldo = balance.get(rule.cuenta)! + signed;
      balance.set(rule.cuenta, saldo);
      if (d < from) continue;
      byAccount.get(rule.cuenta)!.push({
        banco: DEMO.slug,
        cuenta: rule.cuenta,
        fecha: d,
        descripcion: rule.descripcion,
        monto: money('CLP', signed),
        tipo: rule.abono ? 'abono' : 'cargo',
        saldo: money('CLP', saldo),
      });
    }
  }
  for (const list of byAccount.values()) list.reverse();
  return byAccount;
}

/** Balances as of `today`: the last running balance of each account. */
export function demoSaldos(today: IsoDate): Saldo[] {
  const movs = demoMovimientos(today);
  return demoCuentas().map((c) => {
    const contable =
      movs.get(c.numero)?.[0]?.saldo?.monto ?? OPENING[c.numero as keyof typeof OPENING];
    const retenido = c.numero === CORRIENTE ? RETENCION_CORRIENTE : 0;
    return {
      banco: DEMO.slug,
      cuenta: c.numero,
      disponible: money('CLP', contable - retenido),
      contable: money('CLP', contable),
      ...(retenido > 0 ? { retenciones: money('CLP', retenido) } : {}),
    };
  });
}
