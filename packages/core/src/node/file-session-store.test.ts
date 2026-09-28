import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NotAuthenticated } from '../errors/errors.js';
import { FileSessionStore } from './file-session-store.js';
import { JsonlAuditSink } from './jsonl-audit-sink.js';

const cookie = {
  name: 'SESSION',
  value: 'synthetic',
  domain: 'banco.example',
  path: '/',
  expires: -1,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax' as const,
};

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'cta-home-'));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const mode = (p: string) => statSync(p).mode & 0o777;

describe('FileSessionStore', () => {
  it('round-trips a session with 0700 dir and 0600 file', async () => {
    const store = new FileSessionStore(home);
    await store.put({ banco: 'bci', cookies: [cookie], savedAt: '2026-01-01T00:00:00Z' });
    expect(await store.get('bci')).toEqual({
      banco: 'bci',
      cookies: [cookie],
      savedAt: '2026-01-01T00:00:00Z',
    });
    expect(mode(join(home, 'sessions'))).toBe(0o700);
    expect(mode(join(home, 'sessions', 'bci.json'))).toBe(0o600);
    expect(await store.list()).toEqual(['bci']);
  });

  it('stores nothing but banco, cookies and savedAt', async () => {
    const store = new FileSessionStore(home);
    const extra = { banco: 'bci', cookies: [cookie], savedAt: 'x', rut: '11111111-1' };
    await store.put(extra);
    expect(
      Object.keys(JSON.parse(readFileSync(join(home, 'sessions', 'bci.json'), 'utf8'))),
    ).toEqual(['banco', 'cookies', 'savedAt']);
  });

  it('returns undefined when there is no session and forgets on delete', async () => {
    const store = new FileSessionStore(home);
    expect(await store.get('bci')).toBeUndefined();
    await store.put({ banco: 'bci', cookies: [], savedAt: 'x' });
    await store.delete('bci');
    expect(await store.get('bci')).toBeUndefined();
    expect(await store.list()).toEqual([]);
  });

  it('treats an unreadable file as not authenticated', async () => {
    const store = new FileSessionStore(home);
    await store.put({ banco: 'bci', cookies: [], savedAt: 'x' });
    writeFileSync(join(home, 'sessions', 'bci.json'), '{not json');
    await expect(store.get('bci')).rejects.toBeInstanceOf(NotAuthenticated);
  });

  it('refuses slugs that could escape the directory', async () => {
    const store = new FileSessionStore(home);
    for (const bad of ['../x', 'a/b', 'BCI', '', '.hidden']) {
      await expect(store.get(bad)).rejects.toThrow(RangeError);
    }
  });
});

describe('JsonlAuditSink', () => {
  it('appends receipts at 0600 with only the receipt fields', async () => {
    const sink = new JsonlAuditSink(home);
    await sink.record({ ts: 't1', action: 'saldo', banco: 'bci', result: 'ok', durationMs: 3 });
    await sink.record({
      ts: 't2',
      action: 'saldo',
      banco: 'bci',
      result: 'error',
      durationMs: 4,
      errorCode: 'NOT_AUTHENTICATED',
      ...({ saldo: 1500 } as object),
    });
    const file = join(home, 'audit.jsonl');
    const lines = readFileSync(file, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({
      ts: 't2',
      action: 'saldo',
      banco: 'bci',
      result: 'error',
      durationMs: 4,
      errorCode: 'NOT_AUTHENTICATED',
    });
    expect(mode(file)).toBe(0o600);
  });
});
