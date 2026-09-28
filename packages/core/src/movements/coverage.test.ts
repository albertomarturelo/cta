import { describe, expect, it } from 'vitest';

import { inRange, latestOnlyCoverage } from './coverage.js';

const on = (...fechas: string[]) => fechas.map((fecha) => ({ fecha }));

describe('movement coverage (ADR-014)', () => {
  it('filters inclusively; a missing end is unbounded', () => {
    expect(inRange('2026-01-10', { desde: '2026-01-10', hasta: '2026-01-10' })).toBe(true);
    expect(inRange('2026-01-09', { desde: '2026-01-10' })).toBe(false);
    expect(inRange('2026-01-11', { hasta: '2026-01-10' })).toBe(false);
    expect(inRange('1999-01-01', {})).toBe(true);
  });

  it('vouches only for a desde strictly after the oldest date returned', () => {
    const returned = on('2026-01-20', '2026-01-05', '2026-01-12');
    expect(latestOnlyCoverage('00001111', returned, { desde: '2026-01-06' })).toEqual({
      cuenta: '00001111',
      desde: '2026-01-05',
      hasta: '2026-01-20',
      completo: true,
    });
    // The oldest day may be cut in half by the cap.
    expect(latestOnlyCoverage('00001111', returned, { desde: '2026-01-05' }).completo).toBe(false);
    expect(latestOnlyCoverage('00001111', returned, { desde: '2026-01-01' }).completo).toBe(false);
  });

  it('is never complete without a desde or without movements', () => {
    expect(latestOnlyCoverage('00001111', on('2026-01-05'), {}).completo).toBe(false);
    expect(latestOnlyCoverage('00001111', [], { desde: '2026-01-01' })).toEqual({
      cuenta: '00001111',
      completo: false,
    });
  });
});
