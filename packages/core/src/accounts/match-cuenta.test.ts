import { describe, expect, it } from 'vitest';

import { AmbiguousAccount, NoSuchAccount } from '../errors/errors.js';
import { matchCuenta } from './match-cuenta.js';

const numeros = ['00001234', '00005678', '99991234'];

describe('matchCuenta', () => {
  it('matches the full number, ignoring separators', () => {
    expect(matchCuenta('bci', numeros, '00005678')).toBe('00005678');
    expect(matchCuenta('bci', numeros, '0000-5678')).toBe('00005678');
  });

  it('matches the last 4 digits when unique', () => {
    expect(matchCuenta('bci', numeros, '5678')).toBe('00005678');
  });

  it('refuses an ambiguous last-4 selector', () => {
    expect(() => matchCuenta('bci', numeros, '1234')).toThrow(AmbiguousAccount);
    expect(() => matchCuenta('bci', numeros, '1234')).toThrow(/coincide con 2 cuentas/);
  });

  it('reports no match as a usage error', () => {
    for (const bad of ['4321', '', 'abc', '123']) {
      const err = (() => {
        try {
          matchCuenta('bci', numeros, bad);
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(NoSuchAccount);
      expect((err as NoSuchAccount).exitCode).toBe(2);
    }
  });
});
