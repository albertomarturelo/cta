import { readPackageVersion } from '../package-version.js';

/** The core's own version: the holder's identity across an upgrade (ADR newer-cta-replaces-older-holder). */
export function holderVersion(): string {
  return readPackageVersion(new URL('../../../package.json', import.meta.url));
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function comparePre(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  // A release sorts after its prereleases.
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  const as = a.split('.');
  const bs = b.split('.');
  for (let i = 0; i < Math.min(as.length, bs.length); i++) {
    const x = as[i] as string;
    const y = bs[i] as string;
    if (x === y) continue;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) return Number(x) - Number(y);
    if (xn !== yn) return xn ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return as.length - bs.length;
}

/**
 * Orders two package versions (`1.2.3`, `1.2.3-rc.1`): negative, zero or
 * positive; `undefined` when either is not a version, so nothing is replaced on
 * a guess.
 */
export function compareVersions(a: string, b: string): number | undefined {
  const pa = SEMVER.exec(a);
  const pb = SEMVER.exec(b);
  if (!pa || !pb) return undefined;
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d !== 0) return d;
  }
  return comparePre(pa[4], pb[4]);
}
