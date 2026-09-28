import { describe, expect, it } from 'vitest';

import {
  BankBlocked,
  InvalidDateRange,
  LoginCancelled,
  NotAuthenticated,
  UnknownBank,
} from '../errors/errors.js';
import { money } from '../money/money.js';
import {
  FakeBankDriver,
  FixedClock,
  InMemorySessionStore,
  MemoryAuditSink,
} from '../seams/fakes.js';
import { createTasks } from './tasks.js';

const cookie = {
  name: 'SESSION',
  value: 'synthetic-cookie-value',
  domain: 'banco.example',
  path: '/',
  expires: -1,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax' as const,
};
const saldos = [
  {
    banco: 'bci',
    cuenta: '00001111',
    disponible: money('CLP', 1500),
    contable: money('CLP', 1500),
  },
  { banco: 'bci', cuenta: '00002222', disponible: money('CLP', 20), contable: money('CLP', 25) },
];

function setup(driverData: ConstructorParameters<typeof FakeBankDriver>[3] = {}) {
  const driver = new FakeBankDriver('bci', '016', 'Banco Ficticio', {
    cookies: [cookie],
    saldos,
    ...driverData,
  });
  const sessions = new InMemorySessionStore();
  const audit = new MemoryAuditSink();
  const clock = new FixedClock(new Date('2026-01-02T03:04:05Z'));
  const tasks = createTasks({ drivers: [driver], sessions, audit, clock });
  return { driver, sessions, audit, tasks };
}

describe('tasks', () => {
  it('login stores the cookies and never returns them', async () => {
    const { tasks, sessions } = setup();
    const out = await tasks.login('bci');
    expect(out).toEqual({
      banco: 'bci',
      sesionGuardada: true,
      guardadaEn: '2026-01-02T03:04:05.000Z',
    });
    expect(JSON.stringify(out)).not.toContain('synthetic-cookie-value');
    expect((await sessions.get('bci'))?.cookies).toEqual([cookie]);
  });

  it('reads require a stored session', async () => {
    const { tasks, driver } = setup();
    await expect(tasks.saldo('bci')).rejects.toBeInstanceOf(NotAuthenticated);
    expect(driver.calls).toEqual([]);
  });

  it('saldo returns every account, or the one selected by --cuenta', async () => {
    const { tasks } = setup();
    await tasks.login('bci');
    expect((await tasks.saldo('bci')).saldos).toHaveLength(2);
    expect(await tasks.saldo('016', '2222')).toEqual({ banco: 'bci', saldos: [saldos[1]] });
  });

  it('calls the driver once per task (one browser, ADR-012)', async () => {
    const { tasks, driver } = setup();
    await tasks.login('bci');
    await tasks.saldo('bci', '1111');
    expect(driver.calls).toEqual(['login', 'saldos:1111']);
  });

  it('requires the bank (ADR-011) and audits the failure without it', async () => {
    const { tasks, audit } = setup();
    await expect(tasks.cuentas(undefined)).rejects.toBeInstanceOf(UnknownBank);
    expect(audit.entries.at(-1)).toMatchObject({
      action: 'cuentas',
      banco: '-',
      result: 'error',
      errorCode: 'UNKNOWN_BANK',
    });
  });

  it('audits receipts of actions, never data (ADR-004)', async () => {
    const { tasks, audit } = setup();
    await tasks.login('bci');
    await tasks.saldo('bci');
    const text = JSON.stringify(audit.entries);
    expect(audit.entries.map((e) => [e.action, e.result])).toEqual([
      ['login', 'ok'],
      ['saldo', 'ok'],
    ]);
    for (const secret of ['synthetic-cookie-value', '00001111', '1500'])
      expect(text).not.toContain(secret);
  });

  it('passes bank blocks through verbatim and audits them', async () => {
    const { tasks, sessions, audit } = setup({
      failWith: new BankBlocked('bci', 'Mensaje del banco.'),
    });
    await sessions.put({ banco: 'bci', cookies: [cookie], savedAt: 'x' });
    await expect(tasks.cuentas('bci')).rejects.toThrow('Mensaje del banco.');
    expect(audit.entries.at(-1)).toMatchObject({ result: 'error', errorCode: 'BANK_BLOCKED' });
  });

  it('never lets a failing audit write hide the bank error', async () => {
    const sessions = new InMemorySessionStore();
    await sessions.put({ banco: 'bci', cookies: [cookie], savedAt: 'x' });
    const brokenAudit = createTasks({
      drivers: [
        new FakeBankDriver('bci', '016', 'B', {
          failWith: new BankBlocked('bci', 'Mensaje del banco.'),
        }),
      ],
      sessions,
      audit: { record: async () => Promise.reject(new Error('disk full')) },
      clock: new FixedClock(new Date(0)),
    });
    await expect(brokenAudit.cuentas('bci')).rejects.toThrow('Mensaje del banco.');
  });

  it('surfaces a failing audit write after a successful task', async () => {
    const { sessions } = setup();
    await sessions.put({ banco: 'bci', cookies: [cookie], savedAt: 'x' });
    const brokenAudit = createTasks({
      drivers: [new FakeBankDriver('bci', '016', 'B', { saldos })],
      sessions,
      audit: { record: async () => Promise.reject(new Error('disk full')) },
      clock: new FixedClock(new Date(0)),
    });
    await expect(brokenAudit.saldo('bci')).rejects.toThrow('disk full');
  });

  it('logout forgets the session; bancos reports stored sessions', async () => {
    const { tasks } = setup();
    await tasks.login('bci');
    expect((await tasks.bancos()).bancos).toEqual([
      { banco: 'bci', codigo: '016', nombre: 'Banco Ficticio', sesionGuardada: true },
    ]);
    await tasks.logout('bci');
    expect((await tasks.bancos()).bancos[0]?.sesionGuardada).toBe(false);
  });
});

/** A login that ends when the test says so, like a user still typing. */
function deferred() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  return { gate, release };
}

/** Lets the background login's promise chain settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('background login (ADR-013)', () => {
  it('startLogin returns before the user finishes; bancos reports it', async () => {
    const { gate, release } = deferred();
    const { tasks, sessions, audit } = setup({ loginWaitsFor: gate });

    expect(await tasks.startLogin('016')).toEqual({ banco: 'bci', estado: 'ventana-abierta' });
    expect((await tasks.bancos()).bancos[0]).toMatchObject({
      sesionGuardada: false,
      loginEnCurso: true,
    });
    expect(audit.entries).toEqual([]);

    release();
    await settle();
    const [info] = (await tasks.bancos()).bancos;
    expect(info).toEqual({
      banco: 'bci',
      codigo: '016',
      nombre: 'Banco Ficticio',
      sesionGuardada: true,
    });
    expect((await sessions.get('bci'))?.cookies).toEqual([cookie]);
    expect(audit.entries.map((e) => [e.action, e.banco, e.result])).toEqual([
      ['login', 'bci', 'ok'],
    ]);
  });

  it('opens one window per bank: a second start or an awaited login joins it', async () => {
    const { gate, release } = deferred();
    const { tasks, driver, audit } = setup({ loginWaitsFor: gate });

    await tasks.startLogin('bci');
    expect(await tasks.startLogin('bci')).toEqual({ banco: 'bci', estado: 'en-curso' });
    const awaited = tasks.login('bci');
    release();
    expect(await awaited).toMatchObject({ banco: 'bci', sesionGuardada: true });
    expect(driver.calls).toEqual(['login']);
    expect(audit.entries).toHaveLength(1);

    await tasks.startLogin('bci');
    expect(driver.calls).toEqual(['login', 'login']);
  });

  it('keeps a background failure verbatim for bancos until the next login', async () => {
    const { gate, release } = deferred();
    const { tasks, audit } = setup({
      loginWaitsFor: gate,
      failWith: new LoginCancelled('bci', 'closed'),
    });

    await tasks.startLogin('bci');
    release();
    await settle();
    const expected = new LoginCancelled('bci', 'closed');
    expect((await tasks.bancos()).bancos[0]).toMatchObject({
      sesionGuardada: false,
      ultimoLoginFallido: { error: expected.message, code: expected.code },
    });
    expect((await tasks.bancos()).bancos[0]?.loginEnCurso).toBeUndefined();
    expect(audit.entries.at(-1)).toMatchObject({
      action: 'login',
      result: 'error',
      errorCode: expected.code,
    });

    await tasks.startLogin('bci');
    expect((await tasks.bancos()).bancos[0]?.ultimoLoginFallido).toBeUndefined();
  });

  it('never reports an unexpected error beyond its class', async () => {
    const { gate, release } = deferred();
    const { tasks } = setup({
      loginWaitsFor: gate,
      failWith: new TypeError('synthetic-cookie-value in a request header'),
    });
    await tasks.startLogin('bci');
    release();
    await settle();
    expect((await tasks.bancos()).bancos[0]?.ultimoLoginFallido).toEqual({
      error: 'Error inesperado (TypeError)',
      code: 'UNEXPECTED',
    });
  });

  it('logout during a login says the login is still running', async () => {
    const { gate, release } = deferred();
    const { tasks } = setup({ loginWaitsFor: gate });
    await tasks.startLogin('bci');
    expect(await tasks.logout('bci')).toEqual({
      banco: 'bci',
      sesionGuardada: false,
      loginEnCurso: true,
    });
    release();
    await settle();
    expect(await tasks.logout('bci')).toEqual({ banco: 'bci', sesionGuardada: false });
  });

  it('rejects an unknown bank at once and audits it', async () => {
    const { tasks, audit, driver } = setup();
    await expect(tasks.startLogin('nope')).rejects.toBeInstanceOf(UnknownBank);
    expect(driver.calls).toEqual([]);
    expect(audit.entries.at(-1)).toMatchObject({ action: 'login', banco: '-', result: 'error' });
  });
});

describe('movimientos (ADR-014)', () => {
  const mov = (cuenta: string, fecha: string, monto: number) => ({
    banco: 'bci',
    cuenta,
    fecha,
    descripcion: 'Movimiento ficticio',
    monto: money('CLP', monto),
    tipo: monto < 0 ? ('cargo' as const) : ('abono' as const),
  });
  const movimientos = [
    mov('00001111', '2026-01-05', -100),
    mov('00001111', '2026-01-20', 300),
    mov('00002222', '2026-01-10', -50),
  ];

  it('filters to the range and returns the coverage of each account', async () => {
    const { tasks, driver } = setup({ movimientos });
    await tasks.login('bci');
    const out = await tasks.movimientos('bci', { desde: '2026-01-06', hasta: '2026-01-31' });
    expect(out.movimientos.map((m) => [m.cuenta, m.fecha])).toEqual([
      ['00001111', '2026-01-20'],
      ['00002222', '2026-01-10'],
    ]);
    expect(out.cobertura.map((c) => [c.cuenta, c.completo])).toEqual([
      ['00001111', true],
      ['00002222', true],
    ]);
    expect(driver.calls.at(-1)).toBe('movimientos:2026-01-06..2026-01-31:*');
  });

  it('accepts no range and one account by its last 4 digits', async () => {
    const { tasks } = setup({ movimientos });
    await tasks.login('bci');
    const out = await tasks.movimientos('bci', { cuenta: '2222' });
    expect(out.movimientos).toHaveLength(1);
  });

  it('rejects a bad range before any browser opens', async () => {
    const { tasks, driver } = setup({ movimientos });
    await tasks.login('bci');
    await expect(tasks.movimientos('bci', { desde: '2026-02-30' })).rejects.toBeInstanceOf(
      InvalidDateRange,
    );
    await expect(
      tasks.movimientos('bci', { desde: '2026-02-01', hasta: '2026-01-01' }),
    ).rejects.toThrow(/posterior/);
    expect(driver.calls).toEqual(['login']);
  });

  it('never audits the movements themselves', async () => {
    const { tasks, audit } = setup({ movimientos });
    await tasks.login('bci');
    await tasks.movimientos('bci');
    const text = JSON.stringify(audit.entries);
    expect(audit.entries.at(-1)).toMatchObject({ action: 'movimientos', result: 'ok' });
    for (const secret of ['00001111', 'Movimiento ficticio', '-100'])
      expect(text).not.toContain(secret);
  });
});

describe('tasks with an HTTP-mode driver (ADR-015)', () => {
  const grant = {
    banco: 'bci',
    headers: { authorization: 'Bearer synthetic' },
    // 2026-01-02T04:04:05Z — one hour after the fixed clock below
    expiresAt: Date.parse('2026-01-02T04:04:05Z') / 1000,
    cuentas: [{ banco: 'bci', numero: '00001111', tipo: 'Corriente', moneda: 'CLP' as const }],
  };

  function httpSetup(data: ConstructorParameters<typeof FakeBankDriver>[3] = {}) {
    const driver = new FakeBankDriver('bci', '016', 'Banco Ficticio', { grant, saldos, ...data });
    const sessions = new InMemorySessionStore();
    const clock = new FixedClock(new Date('2026-01-02T03:04:05Z'));
    const tasks = createTasks({ drivers: [driver], sessions, audit: new MemoryAuditSink(), clock });
    return { driver, sessions, clock, tasks };
  }

  it('holds the grant in memory, stores nothing, and says until when', async () => {
    const { tasks, sessions } = httpSetup();
    await sessions.put({ banco: 'bci', cookies: [cookie], savedAt: 'older' });
    expect(await tasks.login('bci')).toEqual({
      banco: 'bci',
      sesionGuardada: false,
      guardadaEn: '2026-01-02T03:04:05.000Z',
      sesionHasta: '2026-01-02T04:04:05.000Z',
    });
    expect(await sessions.list()).toEqual([]);
    expect((await tasks.bancos()).bancos[0]).toEqual({
      banco: 'bci',
      codigo: '016',
      nombre: 'Banco Ficticio',
      sesionGuardada: false,
      sesionHasta: '2026-01-02T04:04:05.000Z',
    });
  });

  it('reads with the grant, and needs a login first', async () => {
    const { tasks, driver } = httpSetup();
    await expect(tasks.saldo('bci')).rejects.toBeInstanceOf(NotAuthenticated);
    await tasks.login('bci');
    expect((await tasks.saldo('bci')).saldos).toHaveLength(2);
    expect(driver.auths).toEqual(['grant']);
  });

  it('forgets the grant at exp', async () => {
    const { tasks, clock } = httpSetup();
    await tasks.login('bci');
    clock.advance(60 * 60_000);
    await expect(tasks.saldo('bci')).rejects.toBeInstanceOf(NotAuthenticated);
    expect((await tasks.bancos()).bancos[0]?.sesionHasta).toBeUndefined();
  });

  it('forgets the grant after a blocked read, and on logout', async () => {
    const blocked = httpSetup();
    await blocked.tasks.login('bci');
    Object.assign(blocked.driver, {
      saldos: () => Promise.reject(new BankBlocked('bci', 'Acceso denegado')),
    });
    await expect(blocked.tasks.saldo('bci')).rejects.toBeInstanceOf(BankBlocked);
    expect((await blocked.tasks.bancos()).bancos[0]?.sesionHasta).toBeUndefined();

    const out = httpSetup();
    await out.tasks.login('bci');
    await out.tasks.logout('bci');
    await expect(out.tasks.saldo('bci')).rejects.toBeInstanceOf(NotAuthenticated);
  });
});
