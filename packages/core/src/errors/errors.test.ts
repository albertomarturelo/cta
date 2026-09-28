import { describe, expect, it } from 'vitest';

import { BankBlocked, BankError, CtaError, NotAuthenticated, UnknownBank } from './errors.js';

describe('errors', () => {
  it('carry a stable code, an exit code and their class name', () => {
    const cases: [CtaError, string, number][] = [
      [new UnknownBank('x', ['bci']), 'UNKNOWN_BANK', 2],
      [new NotAuthenticated('bci'), 'NOT_AUTHENTICATED', 3],
      [new BankBlocked('bci', 'Acceso bloqueado'), 'BANK_BLOCKED', 4],
      [new BankError('bci', 'Error 500--Internal Server Error'), 'BANK_ERROR', 5],
    ];
    for (const [err, code, exit] of cases) {
      expect(err).toBeInstanceOf(CtaError);
      expect(err.code).toBe(code);
      expect(err.exitCode).toBe(exit);
      expect(err.name).toBe(err.constructor.name);
    }
  });

  it('keeps the bank message verbatim', () => {
    expect(new BankBlocked('bci', 'Mensaje exacto del banco.').message).toBe(
      'Mensaje exacto del banco.',
    );
  });

  it('tells the user how to recover from a missing session', () => {
    expect(new NotAuthenticated('bci').message).toContain('cta login bci');
  });
});
