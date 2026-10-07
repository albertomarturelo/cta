import { join } from 'node:path';

import { CtaError } from '../../errors/errors.js';
import type { Tasks } from '../../tasks/tasks.js';
import { defaultCtaHome } from '../file-session-store.js';

/**
 * The grant holder's wire protocol (ADR-015): one JSON object per line over a
 * same-user Unix socket, one request per connection.
 *
 *   → {"method": "saldo", "args": ["bci", "1111"]}
 *   ← {"ok": true, "result": {…}}  |  {"ok": false, "error": {…}}
 *
 * Only the task methods below exist: the surfaces' own API, read-only toward
 * the bank (ADR-008). No answer ever carries the grant — tasks never return it.
 */
export const HOLDER_METHODS = [
  'bancos',
  'login',
  'startLogin',
  'logout',
  'cuentas',
  'saldo',
  'movimientos',
  'tarjetas',
] as const satisfies readonly (keyof Tasks)[];

export type HolderMethod = (typeof HOLDER_METHODS)[number];

export interface HolderRequest {
  readonly method: HolderMethod;
  readonly args: readonly unknown[];
}

/** A `CtaError` as it crosses the socket; anything else keeps only its class. */
export interface WireError {
  readonly name: string;
  readonly message: string;
  readonly code: string;
  readonly exitCode: number;
}

export type HolderResponse =
  | { readonly ok: true; readonly result: unknown }
  | { readonly ok: false; readonly error: WireError };

/** Largest request line accepted; task arguments are a few short strings. */
export const MAX_REQUEST_BYTES = 16 * 1024;

/** The holder's socket: `<home>/holder.sock`, in the `0700` state directory. */
export function defaultHolderSocket(home: string = defaultCtaHome()): string {
  return join(home, 'holder.sock');
}

export function isHolderMethod(m: unknown): m is HolderMethod {
  return typeof m === 'string' && (HOLDER_METHODS as readonly string[]).includes(m);
}

export function toWireError(err: unknown): WireError {
  if (err instanceof CtaError) {
    return { name: err.name, message: err.message, code: err.code, exitCode: err.exitCode };
  }
  // Unexpected errors may carry request details (cookies): the class only.
  const name = err instanceof Error ? err.name : 'Error';
  return { name, message: `Error inesperado (${name})`, code: 'UNEXPECTED', exitCode: 1 };
}

/** A holder-side `CtaError` rebuilt on the client: same message, code and exit code. */
export class HolderError extends CtaError {
  constructor(wire: WireError) {
    super(wire.message, wire.code, wire.exitCode);
    this.name = wire.name;
  }
}

/** No holder answers on the socket: none running, or a dead one left the file. */
export class HolderUnavailable extends CtaError {
  constructor(readonly reason: 'absent' | 'refused' | 'broken') {
    super(
      reason === 'broken'
        ? 'La sesión local de cta respondió de forma inesperada.'
        : 'La sesión local de cta no está en ejecución.',
      'HOLDER_UNAVAILABLE',
      1,
    );
  }
}

/** A request the holder does not serve: unknown method, bad arguments or not JSON. */
export class HolderBadRequest extends CtaError {
  constructor() {
    super('La sesión local de cta rechazó una petición no válida.', 'HOLDER_BAD_REQUEST', 2);
  }
}

/** Another holder already serves this socket. */
export class HolderAlreadyRunning extends CtaError {
  constructor() {
    super('Ya hay una sesión local de cta en ejecución.', 'HOLDER_RUNNING', 1);
  }
}
