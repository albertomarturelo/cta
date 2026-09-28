import { readFileSync } from 'node:fs';

/**
 * Reads `version` from a package.json. Surfaces pass the URL of their own
 * manifest so the lockstep version (ADR-002) has a single source per package.
 */
export function readPackageVersion(packageJsonUrl: URL): string {
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(packageJsonUrl, 'utf8'));
  } catch (cause) {
    throw new Error(`Cannot read ${packageJsonUrl.pathname}`, { cause });
  }
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('version' in manifest) ||
    typeof manifest.version !== 'string' ||
    manifest.version === ''
  ) {
    throw new Error(`No version field in ${packageJsonUrl.pathname}`);
  }
  return manifest.version;
}
