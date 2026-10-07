import { chmod, mkdir, rm } from 'node:fs/promises';
import { createConnection, createServer, type Server, type Socket } from 'node:net';
import { dirname } from 'node:path';

import type { Tasks } from '../../tasks/tasks.js';
import {
  HolderAlreadyRunning,
  HolderBadRequest,
  isHolderMethod,
  MAX_REQUEST_BYTES,
  toWireError,
  type HolderResponse,
} from './protocol.js';

export interface HolderServerOptions {
  /** The one tasks instance whose grants and logins both surfaces share (ADR-015). */
  readonly tasks: Tasks;
  readonly socketPath: string;
  /**
   * Called once when the holder has had nothing to hold — no live session and
   * no login in flight — for `idleGraceMs`: after `exp`, a logout, or an
   * expired or blocked read (ADR-015). The daemon exits on it.
   */
  readonly onIdle?: () => void;
  /** Keeps a just-failed login's message readable by `bancos` for a while. */
  readonly idleGraceMs?: number;
  readonly checkEveryMs?: number;
}

export interface HolderServer {
  close(): Promise<void>;
}

/** Arguments are what the task API takes: short strings or a flat query of strings and flags. */
function validArgs(args: unknown): args is unknown[] {
  if (!Array.isArray(args) || args.length > 3) return false;
  return args.every(
    (a) =>
      a === null ||
      typeof a === 'string' ||
      (typeof a === 'object' &&
        !Array.isArray(a) &&
        Object.values(a as object).every(
          (v) => v === null || typeof v === 'string' || typeof v === 'boolean',
        )),
  );
}

/** JSON has no `undefined`: a `null` argument or query value means "absent". */
function fromWire(a: unknown): unknown {
  if (a === null) return undefined;
  if (typeof a === 'object') {
    return Object.fromEntries(Object.entries(a as object).filter(([, v]) => v !== null));
  }
  return a;
}

async function answer(tasks: Tasks, line: string): Promise<HolderResponse> {
  let req: unknown;
  try {
    req = JSON.parse(line);
  } catch {
    return { ok: false, error: toWireError(new HolderBadRequest()) };
  }
  const { method, args } = (req ?? {}) as { method?: unknown; args?: unknown };
  if (!isHolderMethod(method) || !validArgs(args)) {
    return { ok: false, error: toWireError(new HolderBadRequest()) };
  }
  try {
    const fn = tasks[method] as (...a: unknown[]) => Promise<unknown>;
    return { ok: true, result: await fn(...args.map(fromWire)) };
  } catch (err) {
    return { ok: false, error: toWireError(err) };
  }
}

function serve(tasks: Tasks, socket: Socket, done: () => void): void {
  let buf = '';
  let handled = false;
  socket.setEncoding('utf8');
  socket.on('data', (chunk: string) => {
    if (handled) return;
    buf += chunk;
    const nl = buf.indexOf('\n');
    if (nl < 0) {
      if (buf.length > MAX_REQUEST_BYTES) socket.destroy();
      return;
    }
    handled = true;
    void answer(tasks, buf.slice(0, nl)).then((res) => {
      socket.end(`${JSON.stringify(res)}\n`);
      done();
    });
  });
  socket.on('error', () => socket.destroy());
}

/** Whether something answers on the socket (a live holder) or it is a leftover file. */
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

function listen(server: Server, socketPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

/**
 * Serves the tasks API on a same-user Unix socket (ADR-015): the directory is
 * `0700` and the socket `0600`. A stale socket left by a dead holder is replaced;
 * a live one is never taken over.
 */
export async function startHolderServer(options: HolderServerOptions): Promise<HolderServer> {
  const { tasks, socketPath } = options;
  const dir = dirname(socketPath);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);

  let idleSince: number | undefined;
  let reported = false;
  const check = async () => {
    if (reported || !options.onIdle) return;
    let bancos: Awaited<ReturnType<Tasks['bancos']>>['bancos'];
    try {
      ({ bancos } = await tasks.bancos());
    } catch {
      return; // a failing status read proves nothing; the next check decides
    }
    const holding = bancos.some((b) => b.loginEnCurso || b.sesionHasta !== undefined);
    if (holding) {
      idleSince = undefined;
      return;
    }
    idleSince ??= Date.now();
    if (Date.now() - idleSince >= (options.idleGraceMs ?? 60_000)) {
      reported = true;
      options.onIdle();
    }
  };

  const server = createServer((socket) => serve(tasks, socket, () => void check()));
  try {
    await listen(server, socketPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw err;
    if (await answers(socketPath)) throw new HolderAlreadyRunning();
    await rm(socketPath, { force: true });
    await listen(server, socketPath);
  }
  await chmod(socketPath, 0o600);

  const timer = setInterval(() => void check(), options.checkEveryMs ?? 5_000);
  timer.unref();
  void check();

  return {
    close: async () => {
      clearInterval(timer);
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(socketPath, { force: true });
    },
  };
}
