import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { readPackageVersion } from './package-version.js';

describe('readPackageVersion', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function manifest(content: string): URL {
    dir = mkdtempSync(join(tmpdir(), 'cta-core-'));
    const file = join(dir, 'package.json');
    writeFileSync(file, content);
    return pathToFileURL(file);
  }

  it('returns the version field', () => {
    expect(readPackageVersion(manifest('{"name":"x","version":"1.2.3"}'))).toBe('1.2.3');
  });

  it('names the file when the manifest is not JSON', () => {
    expect(() => readPackageVersion(manifest('{not json'))).toThrow(/Cannot read .*package\.json/);
  });

  it('throws when the version is missing', () => {
    expect(() => readPackageVersion(manifest('{"name":"x"}'))).toThrow(/No version field/);
  });
});
