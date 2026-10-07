import type { Browser, BrowserType } from 'playwright';

import { BrowserMissing } from '../errors/errors.js';

/**
 * Lazy-load Playwright — an optional peer of the core (STACK). Importing `./node`
 * never loads it; a missing install fails here, at first use, with an actionable
 * message. Lineage: sii adapters/node/portal.ts.
 */
export async function loadChromium(): Promise<BrowserType> {
  try {
    return (await import('playwright')).chromium;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') throw new BrowserMissing();
    throw err;
  }
}

/** A normal, visible Chromium: no flags, no plugins, no user-agent change (ADR-004). */
export async function launchVisible(chromium: BrowserType): Promise<Browser> {
  try {
    return await chromium.launch({ headless: false });
  } catch (err) {
    if (err instanceof Error && /Executable doesn't exist|playwright install/i.test(err.message)) {
      throw new BrowserMissing();
    }
    throw err;
  }
}
