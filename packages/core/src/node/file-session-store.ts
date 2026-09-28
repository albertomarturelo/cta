import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { NotAuthenticated } from '../errors/errors.js';
import type { SessionStore, StoredCookie, StoredSession } from '../seams/seams.js';

const SLUG = /^[a-z0-9][a-z0-9-]{0,31}$/;
const SAME_SITE = new Set(['Strict', 'Lax', 'None']);

/** Default state directory. Never inside the repo (ADR-006). */
export function defaultCtaHome(): string {
  return join(homedir(), '.cta');
}

function isCookie(c: unknown): c is StoredCookie {
  if (typeof c !== 'object' || c === null) return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.name === 'string' &&
    typeof o.value === 'string' &&
    typeof o.domain === 'string' &&
    typeof o.path === 'string' &&
    typeof o.expires === 'number' &&
    typeof o.httpOnly === 'boolean' &&
    typeof o.secure === 'boolean' &&
    typeof o.sameSite === 'string' &&
    SAME_SITE.has(o.sameSite)
  );
}

/**
 * Cookies per bank at `<home>/sessions/<banco>.json` — directory `0700`, file
 * `0600`, written atomically. Only `{banco, cookies, savedAt}` is ever stored;
 * credentials never reach this layer (ADR-006).
 */
export class FileSessionStore implements SessionStore {
  private readonly dir: string;

  constructor(home: string = defaultCtaHome()) {
    this.dir = join(home, 'sessions');
  }

  private file(banco: string): string {
    // The slug becomes a file name: refuse anything that could leave the directory.
    if (!SLUG.test(banco)) throw new RangeError(`Invalid bank slug '${banco}'`);
    return join(this.dir, `${banco}.json`);
  }

  async get(banco: string): Promise<StoredSession | undefined> {
    let text: string;
    try {
      text = await readFile(this.file(banco), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw err;
    }
    try {
      const data: unknown = JSON.parse(text);
      const o = data as Record<string, unknown>;
      if (
        typeof o === 'object' &&
        o !== null &&
        o.banco === banco &&
        typeof o.savedAt === 'string' &&
        Array.isArray(o.cookies) &&
        o.cookies.every(isCookie)
      ) {
        return { banco, cookies: o.cookies, savedAt: o.savedAt };
      }
    } catch {
      /* fall through: unreadable is the same as absent, but said out loud */
    }
    throw new NotAuthenticated(banco);
  }

  async put(session: StoredSession): Promise<void> {
    const target = this.file(session.banco);
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    await chmod(this.dir, 0o700);
    const tmp = `${target}.${process.pid}.tmp`;
    const body = JSON.stringify({
      banco: session.banco,
      cookies: session.cookies,
      savedAt: session.savedAt,
    });
    try {
      await writeFile(tmp, body, { mode: 0o600 });
      await rename(tmp, target);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    await chmod(target, 0o600);
  }

  async delete(banco: string): Promise<void> {
    await rm(this.file(banco), { force: true });
  }

  async list(): Promise<readonly string[]> {
    try {
      return (await readdir(this.dir))
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -'.json'.length))
        .filter((s) => SLUG.test(s))
        .sort();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }
}
