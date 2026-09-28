import { appendFile, chmod, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { AuditEntry, AuditSink } from '../seams/seams.js';
import { defaultCtaHome } from './file-session-store.js';

/**
 * Appends one receipt per line to `<home>/audit.jsonl` (`0600`). Only the
 * fixed receipt fields are written — never account data (ADR-004).
 */
export class JsonlAuditSink implements AuditSink {
  private readonly file: string;

  constructor(private readonly home: string = defaultCtaHome()) {
    this.file = join(home, 'audit.jsonl');
  }

  async record(entry: AuditEntry): Promise<void> {
    const line = {
      ts: entry.ts,
      action: entry.action,
      banco: entry.banco,
      result: entry.result,
      durationMs: entry.durationMs,
      ...(entry.errorCode === undefined ? {} : { errorCode: entry.errorCode }),
    };
    await mkdir(this.home, { recursive: true, mode: 0o700 });
    await appendFile(this.file, `${JSON.stringify(line)}\n`, { mode: 0o600 });
    await chmod(this.file, 0o600);
  }
}
