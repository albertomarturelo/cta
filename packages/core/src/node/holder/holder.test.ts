import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CtaError } from '../../errors/errors.js';
import { money } from '../../money/money.js';
import {
  FakeBankDriver,
  FixedClock,
  InMemorySessionStore,
  MemoryAuditSink,
} from '../../seams/fakes.js';
import { createTasks } from '../../tasks/tasks.js';
import { createRemoteTasks } from './client.js';
import { HolderAlreadyRunning, HolderError, HolderUnavailable } from './protocol.js';
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

let dir: string;
let socketPath: string;
const servers: HolderServer[] = [];

beforeEach(async () => {
  // Short: Unix socket paths are limited to ~104 bytes on macOS.
  dir = await mkdtemp(join(tmpdir(), 'cta-h-'));
  socketPath = join(dir, 'state', 'holder.sock');
});

afterEach(async () => {
  while (servers.length) await servers.pop()?.close();
  await rm(dir, { recursive: true, force: true });
});

function holder(data: ConstructorParameters<typeof FakeBankDriver>[3] = {}) {
  const driver = new FakeBankDriver('bci', '016', 'Banco Ficticio', { grant, saldos, ...data });
  const tasks = createTasks({
    drivers: [driver],
    sessions: new InMemorySessionStore(),
    audit: new MemoryAuditSink(),
    clock: new FixedClock(new Date('2026-01-02T03:04:05Z')),
  });
  return { driver, tasks };
}

async function serve(
  tasks: ReturnType<typeof createTasks>,
  extra: { onIdle?: () => void; idleGraceMs?: number } = {},
) {
  const s = await startHolderServer({ tasks, socketPath, checkEveryMs: 10, ...extra });
  servers.push(s);
  return s;
}

/** Sends one raw line and returns the parsed answer. */
function raw(line: string): Promise<{ ok: boolean; error?: { code: string } }> {
  return new Promise((resolve, reject) => {
    const s = createConnection(socketPath);
    let buf = '';
    s.setEncoding('utf8');
    s.once('connect', () => s.write(`${line}\n`));
    s.on('data', (c: string) => (buf += c));
    s.once('end', () => resolve(JSON.parse(buf) as { ok: boolean; error?: { code: string } }));
    s.once('error', reject);
  });
}

describe('grant holder (ADR-015)', () => {
  it('serves the tasks API: login once, then reads through the same grant', async () => {
    const { tasks, driver } = holder();
    await serve(tasks);
    const cli = createRemoteTasks(socketPath);
    const mcp = createRemoteTasks(socketPath);

    const login = await cli.login('bci');
    expect(login).toMatchObject({ banco: 'bci', sesionGuardada: false });
    expect((await mcp.saldo('bci', '1111')).saldos).toHaveLength(1);
    expect(driver.calls).toEqual(['login', 'saldos:1111']);
    expect(driver.auths).toEqual(['grant']);
    // No answer ever carries the grant.
    expect(JSON.stringify([login, await mcp.bancos()])).not.toContain('synthetic');
  });

  it('rebuilds the holder-side error with its message, code and exit code', async () => {
    const { tasks } = holder();
    await serve(tasks);
    const err = await createRemoteTasks(socketPath)
      .saldo('bci')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HolderError);
    expect(err).toBeInstanceOf(CtaError);
    expect(err).toMatchObject({ code: 'NOT_AUTHENTICATED', exitCode: 3 });
    expect((err as Error).message).toContain('cta login bci');
  });

  it('joins a second login to the running one, from either surface (ADR-013)', async () => {
    let finish!: () => void;
    const { tasks, driver } = holder({ loginWaitsFor: new Promise<void>((r) => (finish = r)) });
    await serve(tasks);
    const mcp = createRemoteTasks(socketPath);
    const cli = createRemoteTasks(socketPath);

    expect(await mcp.startLogin('bci')).toEqual({ banco: 'bci', estado: 'ventana-abierta' });
    expect((await cli.bancos()).bancos[0]).toMatchObject({ loginEnCurso: true });
    const joined = cli.login('bci');
    // Let the second request reach the holder while the first login still runs.
    await new Promise((r) => setTimeout(r, 50));
    finish();
    await joined;
    expect(driver.calls.filter((c) => c === 'login')).toHaveLength(1);
    expect((await mcp.bancos()).bancos[0]?.sesionHasta).toBe('2026-01-02T04:04:05.000Z');
  });

  it('keeps its socket 0600 in a 0700 directory', async () => {
    await serve(holder().tasks);
    expect((await stat(socketPath)).mode & 0o777).toBe(0o600);
    expect((await stat(join(dir, 'state'))).mode & 0o777).toBe(0o700);
  });

  it('accepts only the task methods, with plain arguments', async () => {
    await serve(holder().tasks);
    expect(await raw(JSON.stringify({ method: 'transferir', args: [] }))).toMatchObject({
      ok: false,
      error: { code: 'HOLDER_BAD_REQUEST' },
    });
    expect(
      await raw(JSON.stringify({ method: 'saldo', args: [{ nested: { deep: 1 } }] })),
    ).toMatchObject({ ok: false });
    expect(await raw('not json')).toMatchObject({ ok: false });
  });

  it('replaces a stale socket file but never a live holder', async () => {
    await serve(holder().tasks);
    await expect(startHolderServer({ tasks: holder().tasks, socketPath })).rejects.toBeInstanceOf(
      HolderAlreadyRunning,
    );

    await servers.pop()?.close();
    await writeFile(socketPath, 'left by a dead holder');
    await serve(holder().tasks);
    expect((await createRemoteTasks(socketPath).bancos()).bancos).toHaveLength(1);
  });

  it('reports a missing holder as unavailable', async () => {
    const err = await createRemoteTasks(join(dir, 'none.sock'))
      .bancos()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HolderUnavailable);
    expect(err).toMatchObject({ reason: 'absent' });
  });

  it('reports idle once nothing is held: after logout, not while a session lives', async () => {
    const { tasks } = holder();
    let idle = 0;
    await serve(tasks, { onIdle: () => (idle += 1), idleGraceMs: 30 });
    const remote = createRemoteTasks(socketPath);
    await remote.login('bci');
    await new Promise((r) => setTimeout(r, 80));
    expect(idle).toBe(0);

    await remote.logout('bci');
    await new Promise((r) => setTimeout(r, 250));
    expect(idle).toBe(1);
  });
});
