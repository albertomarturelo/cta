import { describe, expect, it } from 'vitest';

import { DEMO } from '../../banks/demo/dataset.js';
import { LoginCancelled, NoSuchCard, NotAuthenticated } from '../../errors/errors.js';
import type { ReadAuth } from '../../seams/seams.js';
import { defaultDrivers } from '../../node.js';
import { DemoDriver } from './demo-driver.js';

// Noon, so the local date is the same day in any time zone a test may run in.
const NOW = new Date('2026-10-07T12:00:00');
const driver = (opts: ConstructorParameters<typeof DemoDriver>[0] = {}) =>
  new DemoDriver({ now: () => NOW, loginWindow: async () => undefined, ...opts });

async function loggedIn(d = driver()): Promise<ReadAuth> {
  const outcome = await d.login();
  if (outcome.kind !== 'grant') throw new Error('expected a grant');
  return { kind: 'grant', grant: outcome.grant };
}

describe('DemoDriver (ADR-019)', () => {
  it('is registered only with CTA_DEMO=1', () => {
    expect(defaultDrivers({}).map((d) => d.slug)).toEqual(['bci']);
    expect(defaultDrivers({ CTA_DEMO: '0' }).map((d) => d.slug)).toEqual(['bci']);
    expect(defaultDrivers({ CTA_DEMO: '1' }).map((d) => d.slug)).toEqual(['bci', 'demo']);
  });

  it('logs in through its window and holds a 60-minute grant, like an HTTP-mode bank', async () => {
    let opened = 0;
    const d = driver({ loginWindow: async () => void (opened += 1) });
    const outcome = await d.login();
    expect(opened).toBe(1);
    expect(d.readMode).toBe('http');
    expect(outcome.kind).toBe('grant');
    if (outcome.kind === 'grant') {
      expect(outcome.grant.expiresAt).toBe(Math.floor(NOW.getTime() / 1000) + 3600);
      expect(outcome.grant.cuentas).toHaveLength(2);
    }
  });

  it('passes a closed or timed-out window on as a cancelled login', async () => {
    const d = driver({
      loginWindow: async () => {
        throw new LoginCancelled(DEMO.slug, 'closed');
      },
    });
    await expect(d.login()).rejects.toBeInstanceOf(LoginCancelled);
  });

  it('reads nothing without a login', async () => {
    const cookies: ReadAuth = {
      kind: 'cookies',
      session: { banco: 'demo', cookies: [], savedAt: 'x' },
    };
    await expect(driver().saldos(cookies)).rejects.toBeInstanceOf(NotAuthenticated);
    await expect(driver().tarjetas(cookies, {})).rejects.toBeInstanceOf(NotAuthenticated);
  });

  it('selects an account by its last digits', async () => {
    const auth = await loggedIn();
    const saldos = await driver().saldos(auth, '1937');
    expect(saldos.map((s) => s.cuenta.slice(-4))).toEqual(['1937']);
  });

  it('returns only the latest movements, so a long range reports incomplete coverage', async () => {
    const auth = await loggedIn();
    const week = await driver().movimientos(auth, { desde: '2026-10-01' }, '4821');
    expect(week.cobertura[0]!.completo).toBe(true);
    expect(week.movimientos.every((m) => m.fecha >= '2026-10-01')).toBe(true);
    const long = await driver().movimientos(auth, { desde: '2026-08-01' }, '4821');
    expect(long.cobertura[0]!.completo).toBe(false);
    expect(long.movimientos.length).toBeLessThanOrEqual(DEMO.latestPerAccount);
  });

  it('selects a card account by any of its cards and adds movements only when asked', async () => {
    const auth = await loggedIn();
    const all = await driver().tarjetas(auth, {});
    expect(all.tarjetas).toHaveLength(2);
    expect(all.movimientos).toBeUndefined();
    const additional = all.tarjetas.find((t) => t.adicionales !== undefined)!;
    const one = await driver().tarjetas(auth, {
      tarjeta: additional.adicionales![0]!,
      movimientos: true,
    });
    expect(one.tarjetas.map((t) => t.tarjeta)).toEqual([additional.tarjeta]);
    const plastics = [additional.tarjeta, ...additional.adicionales!];
    expect(one.movimientos!.every((m) => plastics.includes(m.tarjeta))).toBe(true);
    await expect(driver().tarjetas(auth, { tarjeta: '0000' })).rejects.toBeInstanceOf(NoSuchCard);
  });
});
