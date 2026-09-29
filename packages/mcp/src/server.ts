import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CtaError, type Tasks } from '@albertomarturelo/cta-core';
import { z } from 'zod';

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

/** Runs one task; results and errors come back as JSON text (ADR-007). */
async function toolJson(call: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await call(), null, 2) }] };
  } catch (err) {
    const body =
      err instanceof CtaError
        ? {
            error: err.message,
            code: err.code,
            ...('banco' in err && typeof err.banco === 'string' ? { banco: err.banco } : {}),
          }
        : // Unexpected errors may carry request details (cookies): the class only.
          {
            error: `Error inesperado (${err instanceof Error ? err.name : 'Error'})`,
            code: 'UNEXPECTED',
          };
    return { content: [{ type: 'text', text: JSON.stringify(body) }], isError: true };
  }
}

// ADR-011: every bank-scoped tool takes a REQUIRED bank; never a default.
const banco = z
  .string()
  .min(1)
  .describe('Bank slug or Chilean bank code, e.g. "bci" or "016". Required; see the bancos tool.');

const SIGUIENTE_PASO =
  'Se abrió una ventana del navegador de cta con la página del banco (en macOS se llama ' +
  '«Google Chrome for Testing»; si no la ves, búscala con Cmd+Tab). Inicia sesión ahí, con tu ' +
  'clave y el segundo factor si lo pide. Al llegar a tu inicio, la ventana se cierra sola. ' +
  'Luego consulta bancos: sesionGuardada será true, o sesionHasta dirá hasta cuándo dura la sesión.';

/**
 * The `cta-mcp` server: each tool is a thin call into a core task (ADR-003). No
 * tool accepts a password, clave, RUT or second-factor code (ADR-006); login opens
 * a visible browser on the user's machine, and reads do too unless the bank's
 * driver reads over HTTP with the session the local holder keeps (ADR-012, ADR-015).
 */
export function buildServer(tasks: Tasks, version: string): McpServer {
  const server = new McpServer({ name: 'cta', version });

  server.registerTool(
    'bancos',
    {
      title: 'Supported banks',
      description:
        'Lists supported banks and which have a stored session on this machine (not checked against the bank).',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => toolJson(() => tasks.bancos()),
  );

  server.registerTool(
    'login',
    {
      title: 'Log in to a bank',
      description:
        "Opens a visible browser at the bank's real login page on the user's machine and returns at once, without waiting for the login. The USER types their credentials and any second factor there; never ask for them and never pass them. Once the user says they are done, call bancos: on success sesionGuardada is true (cookies stored) or sesionHasta is set (a session held in memory by cta's local session holder until that time, shared with the cta CLI on this machine; reads need no browser until then); loginEnCurso while it runs, ultimoLoginFallido with the bank's message if it failed. Calling login again while one runs opens no new window. Never stores a password; stores session cookies only, or nothing.",
      inputSchema: { banco },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    // ADR-013: returns before the user finishes, so no client tool timeout hits it.
    ({ banco }) =>
      toolJson(async () => ({ ...(await tasks.startLogin(banco)), siguientePaso: SIGUIENTE_PASO })),
  );

  server.registerTool(
    'logout',
    {
      title: 'Forget a bank session',
      description:
        'Deletes the stored session cookies of one bank on this machine and ends a session held in memory, for the cta CLI too. It does not sign out at the bank, nor cancel a login still open (loginEnCurso: true); that one saves its session when the user finishes.',
      inputSchema: { banco },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    ({ banco }) => toolJson(() => tasks.logout(banco)),
  );

  server.registerTool(
    'cuentas',
    {
      title: 'Accounts of a bank',
      description:
        'Lists the accounts of one bank. Uses the bank session; for banks read in a browser it opens a visible one briefly.',
      inputSchema: { banco },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ banco }) => toolJson(() => tasks.cuentas(banco)),
  );

  server.registerTool(
    'saldo',
    {
      title: 'Balances',
      description:
        'Balances of the accounts of one bank, or of one account. Amounts are integer minor units ({moneda, monto}). Uses the bank session; for banks read in a browser it opens a visible one briefly.',
      inputSchema: {
        banco,
        cuenta: z.string().min(1).optional().describe('Full account number or its last 4 digits.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ banco, cuenta }) => toolJson(() => tasks.saldo(banco, cuenta)),
  );

  const fecha = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional();

  server.registerTool(
    'movimientos',
    {
      title: 'Account movements',
      description:
        "Movements of one bank's accounts, or of one account, filtered to an optional inclusive date range. Amounts are signed integer minor units (cargo negative, abono positive). A bank may return less than the range: check `cobertura` — for each account, `completo: false` means movements before `cobertura.desde` may be missing; tell the user instead of presenting totals as covering the whole range. Uses the bank session; for banks read in a browser it opens a visible one briefly.",
      inputSchema: {
        banco,
        cuenta: z.string().min(1).optional().describe('Full account number or its last 4 digits.'),
        desde: fecha.describe('First day, YYYY-MM-DD, inclusive.'),
        hasta: fecha.describe('Last day, YYYY-MM-DD, inclusive.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ banco, cuenta, desde, hasta }) =>
      toolJson(() =>
        tasks.movimientos(banco, {
          ...(cuenta === undefined ? {} : { cuenta }),
          ...(desde === undefined ? {} : { desde }),
          ...(hasta === undefined ? {} : { hasta }),
        }),
      ),
  );

  return server;
}
