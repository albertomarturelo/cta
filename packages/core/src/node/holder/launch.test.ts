import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NotAuthenticated } from '../../errors/errors.js';
import { money } from '../../money/money.js';
import {
  FakeBankDriver,
  FixedClock,
  InMemorySessionStore,
  MemoryAuditSink,
} from '../../seams/fakes.js';
import { createTasks } from '../../tasks/tasks.js';
import { createHolderTasks } from './launch.js';
import { startHolderServer, type HolderServer } from './server.js';

// Synthetic grant and data only.
const grant = {
  banco: 'bci',
  headers: { authorization: 'Bearer synthetic' },
  expiresAt: Date.parse('2026-01-02T04:04:05Z') / 1000,
  cuentas: [{ banco: 'bci', numero: '00001111', tipo: 'Corriente', moneda: 'CLP' as const }],
};
const saldos = [
  { banco: 'bci', cuenta: '00001111', disponible: money('CLP', 10), contable: money('CLP', 10) },
];

function tasksWith() {
  const driver = new FakeBankDriver('bci', '016', 'Banco Ficticio', { grant, saldos });
  const tasks = createTasks({
    drivers: [driver],
    sessions: new InMemorySessionStore(),
    audit: new MemoryAuditSink(),
    clock: new FixedClock(new Date('2026-01-02T03:04:05Z')),
  });
  return { driver, tasks };
}

let dir: string;
let socketPath: string;
let servers: HolderServer[] = [];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cta-l-'));
  socketPath = join(dir, 'holder.sock');
  servers = [];
});

afterEach(async () => {
  for (const s of servers) await s.close();
  await rm(dir, { recursive: true, force: true });
});

/** Two surfaces over one holder, like the CLI and the MCP; the holder starts on demand. */
function surfaces() {
  const holder = tasksWith();
  let starts = 0;
  const startHolder = async (path: string) => {
    starts += 1;
    servers.push(await startHolderServer({ tasks: holder.tasks, socketPath: path }));
  };
  const cli = createHolderTasks({ local: tasksWith().tasks, socketPath, startHolder });
  const mcp = createHolderTasks({ local: tasksWith().tasks, socketPath, startHolder });
  return { holder, cli, mcp, starts: () => starts };
}

describe('holder-backed tasks for the surfaces (ADR-015)', () => {
  it('a login from one surface serves the reads of the other', async () => {
    const { holder, cli, mcp, starts } = surfaces();
    await mcp.login('bci');
    expect(starts()).toBe(1);
    expect((await cli.saldo('bci')).saldos).toHaveLength(1);
    expect((await cli.bancos()).bancos[0]?.sesionHasta).toBe('2026-01-02T04:04:05.000Z');
    expect(holder.driver.calls).toEqual(['login', 'saldos:*']);
  });

  it('starts no holder for status or reads: no holder means no session', async () => {
    const { cli, starts } = surfaces();
    expect((await cli.bancos()).bancos[0]).toMatchObject({ banco: 'bci', sesionGuardada: false });
    await expect(cli.saldo('bci')).rejects.toBeInstanceOf(NotAuthenticated);
    expect(starts()).toBe(0);
  });

  it('a logout from either surface ends the session for both', async () => {
    const { cli, mcp } = surfaces();
    await cli.login('bci');
    await mcp.logout('bci');
    await expect(cli.saldo('bci')).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
  });

  it('starts the holder only once for a background login from the MCP', async () => {
    const { mcp, cli, starts } = surfaces();
    expect(await mcp.startLogin('bci')).toMatchObject({ banco: 'bci' });
    await cli.login('bci');
    expect(starts()).toBe(1);
  });
});
