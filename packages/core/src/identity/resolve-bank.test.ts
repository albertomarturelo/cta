import { describe, expect, it } from 'vitest';

import { UnknownBank } from '../errors/errors.js';
import { FakeBankDriver } from '../seams/fakes.js';
import { resolveBank } from './resolve-bank.js';

const drivers = [
  new FakeBankDriver('bci', '016', 'Banco Ficticio'),
  new FakeBankDriver('otro', '999', 'Otro'),
];

describe('resolveBank', () => {
  it('matches by slug, case-insensitively, or by bank code', () => {
    expect(resolveBank('bci', drivers).slug).toBe('bci');
    expect(resolveBank(' BCI ', drivers).slug).toBe('bci');
    expect(resolveBank('016', drivers).slug).toBe('bci');
  });

  it('requires the bank — never infers it (ADR-011)', () => {
    for (const missing of [undefined, '', '  ']) {
      const err = (() => {
        try {
          resolveBank(missing, drivers);
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(UnknownBank);
      expect((err as UnknownBank).exitCode).toBe(2);
      expect((err as UnknownBank).message).toMatch(
        /--banco es obligatorio\. Soportados: bci, otro/,
      );
    }
  });

  it('names the supported banks when the bank is unknown', () => {
    expect(() => resolveBank('nope', drivers)).toThrow(
      /Banco desconocido 'nope'\. Soportados: bci, otro/,
    );
  });

  it('fails even when only one bank is registered', () => {
    expect(() => resolveBank(undefined, [drivers[0]!])).toThrow(UnknownBank);
  });
});
