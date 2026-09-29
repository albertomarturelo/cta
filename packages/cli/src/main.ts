#!/usr/bin/env node
import { createTasks } from '@albertomarturelo/cta-core';
import {
  FileSessionStore,
  JsonlAuditSink,
  SystemClock,
  createHolderTasks,
  defaultDrivers,
  readPackageVersion,
} from '@albertomarturelo/cta-core/node';

import { run } from './program.js';

// Composition root: the only place real Node adapters are wired (ADR-003). Tasks
// go through the shared grant holder, the same one the MCP server uses (ADR-015).
const tasks = createHolderTasks({
  local: createTasks({
    drivers: defaultDrivers(),
    sessions: new FileSessionStore(),
    audit: new JsonlAuditSink(),
    clock: new SystemClock(),
  }),
});

process.exitCode = await run(process.argv.slice(2), {
  tasks,
  version: readPackageVersion(new URL('../package.json', import.meta.url)),
  io: {
    stdout: (text) => process.stdout.write(`${text}\n`),
    stderr: (text) => process.stderr.write(`${text}\n`),
  },
});
