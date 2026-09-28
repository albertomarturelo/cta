import {
  BankBlocked,
  FakeBankDriver,
  FixedClock,
  InMemorySessionStore,
  MemoryAuditSink,
  createTasks,
  money,
} from '@albertomarturelo/cta-core';
import { describe, expect, it } from 'vitest';

import { run } from './program.js';
import { formatMoney } from './render.js';

const cookie = {
  name: 'S',
  value: 'synthetic-cookie',
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
    disponible: money('CLP', 1234567),
    contable: money('CLP', 1234567),
  },
  { banco: 'bci', cuenta: '00002222', disponible: money('CLP', -500), contable: money('CLP', 0) },
];

function cli(driverData: ConstructorParameters<typeof FakeBankDriver>[3] = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const sessions = new InMemorySessionStore();
  const tasks = createTasks({
    drivers: [
      new FakeBankDriver('bci', '016', 'Banco Ficticio', {
        cookies: [cookie],
        saldos,
        ...driverData,
      }),
    ],
    sessions,
    audit: new MemoryAuditSink(),
    clock: new FixedClock(new Date('2026-01-02T03:04:05Z')),
  });
  const exec = (...argv: string[]) =>
    run(argv, {
      tasks,
      version: '9.9.9',
      io: { stdout: (t) => out.push(t), stderr: (t) => err.push(t) },
    });
  return { exec, out, err, sessions };
}

describe('cta CLI', () => {
  it('prints the version', async () => {
    const { exec, out } = cli();
    expect(await exec('--version')).toBe(0);
    expect(out).toEqual(['9.9.9']);
  });

  it('login takes the bank positionally and prints JSON without cookies', async () => {
    const { exec, out } = cli();
    expect(await exec('login', 'bci')).toBe(0);
    expect(JSON.parse(out[0]!)).toEqual({
      banco: 'bci',
      sesionGuardada: true,
      guardadaEn: '2026-01-02T03:04:05.000Z',
    });
    expect(out.join()).not.toContain('synthetic-cookie');
  });

  it('saldo prints JSON with integer minor units by default', async () => {
    const { exec, out } = cli();
    await exec('login', 'bci');
    out.length = 0;
    expect(await exec('saldo', '--banco', 'bci', '--cuenta', '2222')).toBe(0);
    expect(JSON.parse(out[0]!)).toEqual({ banco: 'bci', saldos: [saldos[1]] });
  });

  it('--human prints text on STDOUT and the effective bank on STDERR', async () => {
    const { exec, out, err } = cli();
    await exec('login', 'bci');
    out.length = 0;
    expect(await exec('saldo', '--banco', '016', '--human')).toBe(0);
    expect(err).toContain('banco: bci');
    expect(out[0]).toContain('00001111  disponible $ 1.234.567');
    expect(out[0]).toContain('disponible -$ 500');
  });

  it('accepts --human before the command too', async () => {
    const { exec, out } = cli();
    expect(await exec('--human', 'bancos')).toBe(0);
    expect(out[0]).toBe('bci (016) Banco Ficticio');
  });

  it('a missing or unknown --banco exits 2 and lists the supported banks (ADR-011)', async () => {
    for (const argv of [['saldo'], ['cuentas', '--banco', 'nope']]) {
      const { exec, out, err } = cli();
      expect(await exec(...argv)).toBe(2);
      expect(out).toEqual([]);
      expect(JSON.parse(err[0]!)).toMatchObject({
        code: 'UNKNOWN_BANK',
        error: expect.stringContaining('Soportados: bci'),
      });
    }
  });

  it('reads without a session exit 3 with the recovery hint', async () => {
    const { exec, err } = cli();
    expect(await exec('cuentas', '--banco', 'bci')).toBe(3);
    expect(JSON.parse(err[0]!)).toEqual({
      error: "No hay sesión activa para 'bci'. Ejecuta: cta login bci",
      code: 'NOT_AUTHENTICATED',
      banco: 'bci',
    });
  });

  it('bank blocks keep the bank message verbatim and exit 4', async () => {
    const { exec, err, sessions } = cli({
      failWith: new BankBlocked('bci', 'Mensaje exacto del banco.'),
    });
    await sessions.put({ banco: 'bci', cookies: [cookie], savedAt: 'x' });
    expect(await exec('cuentas', '--banco', 'bci', '--human')).toBe(4);
    expect(err).toEqual(['cta: Mensaje exacto del banco.']);
  });

  it('unexpected errors print the class only, never the message', async () => {
    const { exec, err, sessions } = cli({
      failWith: new TypeError('request failed with internal detail secret-value'),
    });
    await sessions.put({ banco: 'bci', cookies: [cookie], savedAt: 'x' });
    expect(await exec('cuentas', '--banco', 'bci')).toBe(1);
    expect(err.join()).not.toContain('secret-value');
    expect(JSON.parse(err[0]!)).toEqual({
      error: 'Error inesperado (TypeError)',
      code: 'UNEXPECTED',
    });
  });

  it('an unknown command or option is a usage error (exit 2)', async () => {
    expect(await cli().exec('transferir')).toBe(2);
    expect(await cli().exec('saldo', '--nope')).toBe(2);
  });
});

describe('formatMoney', () => {
  it('renders CLP and USD the Chilean way', () => {
    expect(formatMoney(money('CLP', 1234567))).toBe('$ 1.234.567');
    expect(formatMoney(money('CLP', -2500))).toBe('-$ 2.500');
    expect(formatMoney(money('USD', 123456))).toBe('US$ 1.234,56');
    expect(formatMoney(money('USD', 5))).toBe('US$ 0,05');
  });

  it('movimientos prints JSON with coverage, and --human warns on STDERR when incomplete', async () => {
    const movimiento = {
      banco: 'bci',
      cuenta: '00001111',
      fecha: '2026-01-10',
      descripcion: 'Compra ficticia',
      monto: money('CLP', -2500),
      tipo: 'cargo' as const,
    };
    const { exec, out, err } = cli({
      movimientos: [movimiento],
      cobertura: [
        { cuenta: '00001111', desde: '2026-01-10', hasta: '2026-01-10', completo: false },
      ],
    });
    await exec('login', 'bci');
    out.length = 0;
    expect(await exec('movimientos', '--banco', 'bci', '--desde', '2026-01-01')).toBe(0);
    expect(JSON.parse(out.at(-1)!)).toMatchObject({
      movimientos: [{ monto: { moneda: 'CLP', monto: -2500 } }],
      cobertura: [{ completo: false }],
    });
    err.length = 0;
    expect(await exec('movimientos', '--banco', 'bci', '--human')).toBe(0);
    expect(out.at(-1)).toContain('Compra ficticia');
    expect(out.at(-1)).toContain('-$ 2.500');
    expect(err.join('\n')).toMatch(/solo cubre desde 2026-01-10/);
  });

  it('movimientos rejects a bad date as a usage error (exit 2)', async () => {
    const { exec, err } = cli();
    await exec('login', 'bci');
    expect(await exec('movimientos', '--banco', 'bci', '--desde', '2026-13-01')).toBe(2);
    expect(err.at(-1)).toContain('INVALID_DATE_RANGE');
  });
});
