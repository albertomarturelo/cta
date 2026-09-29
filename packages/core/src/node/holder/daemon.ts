// The grant holder daemon (ADR-015): spawned detached by `spawnHolder`, it keeps
// one tasks instance — and so each bank's read grant and in-flight login — in
// memory, serves it on the Unix socket, and exits once it holds nothing.
// No output: stdio is ignored by the spawner, and nothing here may log data.
import { createTasks } from '../../tasks/tasks.js';
import { defaultDrivers } from '../../node.js';
import { FileSessionStore } from '../file-session-store.js';
import { JsonlAuditSink } from '../jsonl-audit-sink.js';
import { SystemClock } from '../system-clock.js';
import { HolderAlreadyRunning, defaultHolderSocket } from './protocol.js';
import { startHolderServer } from './server.js';

// A failed login's message stays readable by `bancos` this long before exit.
const IDLE_GRACE_MS = 2 * 60_000;

const socketPath = process.argv[2] ?? defaultHolderSocket();

const tasks = createTasks({
  drivers: defaultDrivers(),
  sessions: new FileSessionStore(),
  audit: new JsonlAuditSink(),
  clock: new SystemClock(),
});

try {
  const server = await startHolderServer({
    tasks,
    socketPath,
    idleGraceMs: IDLE_GRACE_MS,
    onIdle: () => void server.close().finally(() => process.exit(0)),
  });
  const stop = () => void server.close().finally(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} catch (err) {
  // Another holder won the race: it serves both surfaces; this one leaves.
  process.exit(err instanceof HolderAlreadyRunning ? 0 : 1);
}
