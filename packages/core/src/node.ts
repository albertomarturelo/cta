// `./node` subpath: the Node composition root that surfaces import (ADR-003).
export { readPackageVersion } from './node/package-version.js';
export { FileSessionStore, defaultCtaHome } from './node/file-session-store.js';
export { JsonlAuditSink } from './node/jsonl-audit-sink.js';
export { SystemClock } from './node/system-clock.js';
export { startHolderServer } from './node/holder/server.js';
export type { HolderServer, HolderServerOptions } from './node/holder/server.js';
export { createRemoteTasks } from './node/holder/client.js';
export {
  defaultHolderSocket,
  HolderAlreadyRunning,
  HolderError,
  HolderUnavailable,
  HOLDER_METHODS,
} from './node/holder/protocol.js';

import type { BankDriver } from './seams/seams.js';
import { BciDriver } from './node/banks/bci-driver.js';

export { BciDriver } from './node/banks/bci-driver.js';

/** The drivers a real run uses, in registry order (append-only). */
export function defaultDrivers(): readonly BankDriver[] {
  return [new BciDriver()];
}
