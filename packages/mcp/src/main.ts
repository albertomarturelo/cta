#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createTasks } from '@albertomarturelo/cta-core';
import {
  FileSessionStore,
  JsonlAuditSink,
  SystemClock,
  defaultDrivers,
  readPackageVersion,
} from '@albertomarturelo/cta-core/node';

import { buildServer } from './server.js';

const version = readPackageVersion(new URL('../package.json', import.meta.url));

if (process.argv.includes('--version') || process.argv.includes('-V')) {
  process.stdout.write(`${version}\n`);
} else {
  // Composition root (ADR-003). STDOUT belongs to the MCP protocol from here on.
  const tasks = createTasks({
    drivers: defaultDrivers(),
    sessions: new FileSessionStore(),
    audit: new JsonlAuditSink(),
    clock: new SystemClock(),
  });
  await buildServer(tasks, version).connect(new StdioServerTransport());
}
