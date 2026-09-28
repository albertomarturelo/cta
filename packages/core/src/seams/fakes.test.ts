import { describe, expect, it } from 'vitest';

import { NotAuthenticated } from '../errors/errors.js';
import { money } from '../money/money.js';
import { FakeBankDriver, FixedClock, InMemorySessionStore, MemoryAuditSink } from './fakes.js';

const session = { banco: 'bci', cookies: [], savedAt: '2026-01-01T00:00:00Z' };
const auth = { kind: 'cookies' as const, session };

describe('in-memory seams', () => {
  it('stores sessions per bank', async () => {
    const store = new InMemorySessionStore();
    await store.put(session);
    await store.put({ ...session, banco: 'otro' });
    expect(await store.list()).toEqual(['bci', 'otro']);
    await store.delete('bci');
    expect(await store.get('bci')).toBeUndefined();
  });

  it('records audit receipts and moves a fixed clock', async () => {
    const audit = new MemoryAuditSink();
    await audit.record({ ts: 't', action: 'saldo', banco: 'bci', result: 'ok', durationMs: 1 });
    expect(audit.entries).toHaveLength(1);
    const clock = new FixedClock(new Date('2026-01-01T00:00:00Z'));
    clock.advance(1000);
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:01.000Z');
  });
});

describe('FakeBankDriver', () => {
  const saldos = [
    {
      banco: 'bci',
      cuenta: '00000001',
      disponible: money('CLP', 1000),
      contable: money('CLP', 1000),
    },
    { banco: 'bci', cuenta: '00000002', disponible: money('CLP', 5), contable: money('CLP', 5) },
  ];

  it('filters by account and records calls', async () => {
    const driver = new FakeBankDriver('bci', '016', 'Banco Ficticio', { saldos });
    expect(await driver.saldos(auth)).toHaveLength(2);
    expect(await driver.saldos(auth, '00000002')).toEqual([saldos[1]]);
    expect(driver.calls).toEqual(['saldos:*', 'saldos:00000002']);
  });

  it('propagates the configured failure', async () => {
    const driver = new FakeBankDriver('bci', '016', 'Banco Ficticio', {
      failWith: new NotAuthenticated('bci'),
    });
    await expect(driver.cuentas(auth)).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED',
      exitCode: 3,
    });
  });
});
