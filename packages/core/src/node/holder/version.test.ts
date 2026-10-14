import { describe, expect, it } from 'vitest';

import { compareVersions, holderVersion } from './version.js';

describe('compareVersions', () => {
  it('orders releases and prereleases', () => {
    expect(compareVersions('0.4.0', '0.3.0')).toBeGreaterThan(0);
    expect(compareVersions('0.3.0', '0.10.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.1.0', '0.1.0-rc.2')).toBeGreaterThan(0);
    expect(compareVersions('0.1.0-rc.2', '0.1.0-rc.10')).toBeLessThan(0);
    expect(compareVersions('0.1.0-rc.1', '0.1.0-rc.1.1')).toBeLessThan(0);
  });

  it('does not order what is not a version', () => {
    expect(compareVersions('latest', '0.3.0')).toBeUndefined();
    expect(compareVersions('0.3.0', '')).toBeUndefined();
  });

  it('reads the core package version', () => {
    expect(compareVersions(holderVersion(), '0.0.0')).toBeGreaterThan(0);
  });
});
