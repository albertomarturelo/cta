import { createConnection } from 'node:net';

import type { Tasks } from '../../tasks/tasks.js';
import {
  defaultHolderSocket,
  HolderError,
  HolderUnavailable,
  type HolderMethod,
  type HolderResponse,
} from './protocol.js';

/** One request on its own connection; the answer, or the holder's error rebuilt. */
function call(
  socketPath: string,
  method: HolderMethod,
  args: readonly unknown[],
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let buf = '';
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn();
    };
    socket.setEncoding('utf8');
    socket.once('connect', () => socket.write(`${JSON.stringify({ method, args })}\n`));
    socket.on('data', (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf('\n');
      if (nl < 0) return;
      let res: HolderResponse;
      try {
        res = JSON.parse(buf.slice(0, nl)) as HolderResponse;
      } catch {
        settle(() => reject(new HolderUnavailable('broken')));
        return;
      }
      settle(() => (res.ok ? resolve(res.result) : reject(new HolderError(res.error))));
    });
    socket.once('error', (err: NodeJS.ErrnoException) => {
      const reason =
        err.code === 'ENOENT' ? 'absent' : err.code === 'ECONNREFUSED' ? 'refused' : 'broken';
      settle(() => reject(new HolderUnavailable(reason)));
    });
    // Closed with no answer: the holder died mid-request.
    socket.once('close', () => settle(() => reject(new HolderUnavailable('broken'))));
  });
}

/**
 * The tasks API served by the grant holder (ADR-015): the same shape surfaces
 * already call (ADR-003), so a surface swaps its composition root, nothing else.
 */
export function createRemoteTasks(socketPath: string = defaultHolderSocket()): Tasks {
  const remote =
    <M extends HolderMethod>(method: M) =>
    (...args: Parameters<Tasks[M]>) =>
      call(socketPath, method, args) as ReturnType<Tasks[M]>;
  return {
    bancos: remote('bancos'),
    login: remote('login'),
    startLogin: remote('startLogin'),
    logout: remote('logout'),
    cuentas: remote('cuentas'),
    saldo: remote('saldo'),
    movimientos: remote('movimientos'),
  };
}
