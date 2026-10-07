// `./node` subpath: the Node composition root that surfaces import (ADR-003).
export { readPackageVersion } from './node/package-version.js';
export { FileSessionStore, defaultCtaHome } from './node/file-session-store.js';
export { JsonlAuditSink } from './node/jsonl-audit-sink.js';
export { SystemClock } from './node/system-clock.js';
export { startHolderServer } from './node/holder/server.js';
export type { HolderServer, HolderServerOptions } from './node/holder/server.js';
export { createRemoteTasks } from './node/holder/client.js';
export { createHolderTasks, spawnHolder } from './node/holder/launch.js';
export type { HolderTasksOptions } from './node/holder/launch.js';
export {
  defaultHolderSocket,
  HolderAlreadyRunning,
  HolderBadRequest,
  HolderError,
  HolderUnavailable,
  HOLDER_METHODS,
} from './node/holder/protocol.js';

import type { BankDriver } from './seams/seams.js';
import { BciDriver } from './node/banks/bci-driver.js';
import { DemoDriver } from './node/banks/demo-driver.js';

export { BciDriver } from './node/banks/bci-driver.js';
export { DemoDriver } from './node/banks/demo-driver.js';

/**
 * The drivers a real run uses, in registry order (append-only). The fictitious
 * `demo` bank joins only when the process sees `CTA_DEMO=1` (ADR-019); a holder
 * inherits it from the surface that spawns it.
 */
export function defaultDrivers(
  env: Readonly<Record<string, string | undefined>> = process.env,
): readonly BankDriver[] {
  return env['CTA_DEMO'] === '1' ? [new BciDriver(), new DemoDriver()] : [new BciDriver()];
}
