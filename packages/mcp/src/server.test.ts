import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  FakeBankDriver,
  FixedClock,
  InMemorySessionStore,
  MemoryAuditSink,
  createTasks,
  money,
} from '@albertomarturelo/cta-core';
import { describe, expect, it } from 'vitest';

import { buildServer } from './server.js';

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
    disponible: money('CLP', 1500),
    contable: money('CLP', 1500),
  },
];

async function connect(loginWaitsFor?: Promise<unknown>) {
  const tasks = createTasks({
    drivers: [
      new FakeBankDriver('bci', '016', 'Banco Ficticio', {
        cookies: [cookie],
        saldos,
        ...(loginWaitsFor === undefined ? {} : { loginWaitsFor }),
      }),
    ],
    sessions: new InMemorySessionStore(),
    audit: new MemoryAuditSink(),
    clock: new FixedClock(new Date('2026-01-02T03:04:05Z')),
  });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await buildServer(tasks, '9.9.9').connect(serverT);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientT);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as {
      content: { type: string; text: string }[];
      isError?: boolean;
    };
    return {
      isError: r.isError === true,
      json: JSON.parse(r.content[0]!.text) as Record<string, unknown>,
    };
  };
  return { client, call };
}

describe('cta-mcp', () => {
  it('exposes the six tools; banco is required on every bank-scoped one (ADR-011)', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'bancos',
      'cuentas',
      'login',
      'logout',
      'movimientos',
      'saldo',
    ]);
    for (const t of tools.filter((t) => t.name !== 'bancos')) {
      expect(t.inputSchema.required).toContain('banco');
    }
  });

  it('accepts no credential of any kind (ADR-006)', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const fields = tools.flatMap((t) => Object.keys(t.inputSchema.properties ?? {}));
    for (const f of fields) expect(f).not.toMatch(/pass|clave|rut|otp|codigo|token|segundo/i);
  });

  it('marks the reads read-only', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const hint = (n: string) => tools.find((t) => t.name === n)?.annotations?.readOnlyHint;
    expect([hint('bancos'), hint('cuentas'), hint('saldo'), hint('movimientos')]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(hint('login')).toBe(false);
  });

  it('login returns at once and finishes in the background (ADR-013)', async () => {
    let release!: () => void;
    const { call } = await connect(new Promise<void>((resolve) => (release = resolve)));

    const first = await call('login', { banco: 'bci' });
    expect(first.isError).toBe(false);
    expect(first.json).toMatchObject({ banco: 'bci', estado: 'ventana-abierta' });
    expect(first.json['siguientePaso']).toContain('bancos');
    expect((await call('login', { banco: 'bci' })).json).toMatchObject({ estado: 'en-curso' });
    expect((await call('bancos')).json).toMatchObject({
      bancos: [{ banco: 'bci', sesionGuardada: false, loginEnCurso: true }],
    });

    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await call('bancos')).json).toEqual({
      bancos: [{ banco: 'bci', codigo: '016', nombre: 'Banco Ficticio', sesionGuardada: true }],
    });
  });

  it('logs in and reads balances as JSON with integer minor units', async () => {
    const { call } = await connect();
    const login = await call('login', { banco: 'bci' });
    expect(login.isError).toBe(false);
    expect(JSON.stringify(login.json)).not.toContain('synthetic-cookie');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const saldo = await call('saldo', { banco: 'bci', cuenta: '1111' });
    expect(saldo.json).toEqual({ banco: 'bci', saldos });
  });

  it('returns structured errors, e.g. a read without a session', async () => {
    const { call } = await connect();
    const r = await call('cuentas', { banco: 'bci' });
    expect(r).toEqual({
      isError: true,
      json: {
        error: "No hay sesión activa para 'bci'. Ejecuta: cta login bci",
        code: 'NOT_AUTHENTICATED',
        banco: 'bci',
      },
    });
  });

  it('rejects a call without banco at the schema', async () => {
    const { client } = await connect();
    const r = (await client.callTool({ name: 'saldo', arguments: {} })) as { isError?: boolean };
    expect(r.isError).toBe(true);
  });

  it('movimientos returns signed amounts and the coverage the agent must report (ADR-014)', async () => {
    const tasks = createTasks({
      drivers: [
        new FakeBankDriver('bci', '016', 'Banco Ficticio', {
          movimientos: [
            {
              banco: 'bci',
              cuenta: '00001111',
              fecha: '2026-01-10',
              descripcion: 'Compra ficticia',
              monto: money('CLP', -2500),
              tipo: 'cargo',
            },
          ],
          cobertura: [
            { cuenta: '00001111', desde: '2026-01-10', hasta: '2026-01-10', completo: false },
          ],
        }),
      ],
      sessions: new InMemorySessionStore(),
      audit: new MemoryAuditSink(),
      clock: new FixedClock(new Date('2026-01-02T03:04:05Z')),
    });
    await tasks.login('bci');
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await buildServer(tasks, '9.9.9').connect(serverT);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(clientT);
    const r = (await client.callTool({
      name: 'movimientos',
      arguments: { banco: 'bci', desde: '2026-01-01', hasta: '2026-01-31' },
    })) as { content: { text: string }[]; isError?: boolean };
    expect(r.isError).not.toBe(true);
    expect(JSON.parse(r.content[0]!.text)).toMatchObject({
      banco: 'bci',
      movimientos: [{ fecha: '2026-01-10', monto: { moneda: 'CLP', monto: -2500 }, tipo: 'cargo' }],
      cobertura: [{ cuenta: '00001111', completo: false }],
    });
    const bad = (await client.callTool({
      name: 'movimientos',
      arguments: { banco: 'bci', desde: '10-01-2026' },
    })) as { isError?: boolean };
    expect(bad.isError).toBe(true);
  });
});
