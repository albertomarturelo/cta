import { describe, expect, it } from 'vitest';

import { toIsoDate } from './dates.js';

describe('toIsoDate', () => {
  it('normalizes the formats banks use', () => {
    expect(toIsoDate('2026-09-12')).toBe('2026-09-12');
    expect(toIsoDate('2026-09-12T00:00:00')).toBe('2026-09-12');
    expect(toIsoDate('2026-09-12T23:59:59.000-03:00')).toBe('2026-09-12');
    expect(toIsoDate('12-09-2026')).toBe('2026-09-12');
    expect(toIsoDate('12/09/2026')).toBe('2026-09-12');
  });

  it('rejects impossible calendar dates', () => {
    expect(() => toIsoDate('31/02/2026')).toThrow(RangeError);
    expect(() => toIsoDate('2026-13-01')).toThrow(RangeError);
  });

  it('rejects unknown formats', () => {
    for (const bad of ['', '12.09.2026', '2026/09/12', 'ayer', '9/12/2026', '12-09/2026']) {
      expect(() => toIsoDate(bad)).toThrow(SyntaxError);
    }
  });
});
