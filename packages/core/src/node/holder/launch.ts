import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';

import type { Tasks } from '../../tasks/tasks.js';
import { createRemoteTasks } from './client.js';
import {
  defaultHolderSocket,
  HolderReplaced,
  HolderUnavailable,
  SessionEndedByUpgrade,
  type HolderMethod,
} from './protocol.js';
import { holderVersion } from './version.js';

export interface HolderTasksOptions {
  /** Answers when no holder runs: status and reads that need no live grant. */
  readonly local: Tasks;
  readonly socketPath?: string;
  /** Starts a holder and resolves once it answers; the default spawns the daemon. */
  readonly startHolder?: (socketPath: string) => Promise<void>;
  /** This side's package version; a holder older than it is replaced (ADR newer-cta-replaces-older-holder). */
  readonly version?: string;
}

const STARTS_SESSION: readonly HolderMethod[] = ['login', 'startLogin'];

function answers(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createConnection(socketPath);
    probe.once('connect', () => {
      probe.destroy();
      resolve(true);
    });
    probe.once('error', () => resolve(false));
  });
}

/**
 * Spawns the holder daemon detached from this process — it outlives a CLI
 * command or an MCP client restart — and waits until its socket answers. Two
 * surfaces starting at once end with one holder: the second daemon finds the
 * first alive and exits (HolderAlreadyRunning).
 */
export async function spawnHolder(socketPath: string, timeoutMs = 10_000): Promise<void> {
  const daemon = fileURLToPath(new URL('./daemon.js', import.meta.url));
  const child = spawn(process.execPath, [daemon, socketPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await answers(socketPath)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new HolderUnavailable('absent');
}

const unavailable = (err: unknown) => err instanceof HolderUnavailable && err.reason !== 'broken';

/**
 * Waits, bounded, for a replaced holder to remove its socket. A new holder
 * started earlier would take the leftover path and lose it when the old one
 * finishes closing (Node unlinks a Unix socket's path on close).
 */
export async function gone(socketPath: string, timeoutMs = 5_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (!(await stat(socketPath).catch(() => undefined))) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * The tasks API the surfaces use (ADR-003, ADR-015): every call goes to the
 * shared holder. A login starts the holder when none runs; anything else falls
 * back to `local` then — no holder means no live grant, so a daemon is never
 * spawned just to answer "not logged in". A holder older than this side stops
 * on the first call and is handled like an absent one; a read on a bank whose
 * session it held says that session ended with the upgrade (ADR newer-cta-replaces-older-holder).
 */
export function createHolderTasks(options: HolderTasksOptions): Tasks {
  const socketPath = options.socketPath ?? defaultHolderSocket();
  const start = options.startHolder ?? spawnHolder;
  const remote = createRemoteTasks(socketPath, options.version ?? holderVersion());

  const via =
    <M extends HolderMethod>(method: M) =>
    async (...args: Parameters<Tasks[M]>): Promise<Awaited<ReturnType<Tasks[M]>>> => {
      const call = () =>
        (remote[method] as (...a: unknown[]) => Promise<Awaited<ReturnType<Tasks[M]>>>)(...args);
      let replaced: HolderReplaced | undefined;
      try {
        return await call();
      } catch (err) {
        if (err instanceof HolderReplaced) {
          replaced = err;
          await gone(socketPath);
        } else if (!unavailable(err)) throw err;
      }
      if (STARTS_SESSION.includes(method)) {
        await start(socketPath);
        return call();
      }
      const banco = args[0];
      if (method !== 'logout' && typeof banco === 'string' && replaced?.sesiones.includes(banco)) {
        throw new SessionEndedByUpgrade(banco);
      }
      return (options.local[method] as (...a: unknown[]) => Promise<Awaited<ReturnType<Tasks[M]>>>)(
        ...args,
      );
    };

  return {
    bancos: via('bancos'),
    login: via('login'),
    startLogin: via('startLogin'),
    logout: via('logout'),
    cuentas: via('cuentas'),
    saldo: via('saldo'),
    movimientos: via('movimientos'),
    tarjetas: via('tarjetas'),
  };
}
