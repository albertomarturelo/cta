# Architecture Overview

## The realities of Chilean bank portals

Internalize before writing code. Items marked *hypothesis* are unverified and are
settled by each bank's spike, then recorded in `docs/bank-contract/<slug>.md`.

1. **No public API for the account holder.** Open-finance rails (Ley Fintech,
   CMF's Sistema de Finanzas Abiertas) are for regulated institutions, not for a
   person reading their own cartola. The logged-in web portal is the source of
   truth; any endpoint seen in devtools is internal and may change without
   notice.
2. **Strong authentication.** RUT + clave, plus a second factor on sensitive
   operations and, for some banks, on login itself (app approval, token,
   coordinates card). *Hypothesis:* reads need only the login factor at BCI.
3. **Anti-fraud is aggressive.** Device fingerprinting, bot detection and
   behavioural signals are common. The project never evades them (ADR-004); a
   bank that cannot be read under that rule is documented as unsupported.
4. **Sessions are short.** *Hypothesis:* minutes, not hours. Tasks must fail
   clearly on expiry and never re-login on their own (ADR-006).
5. **Each bank is its own world.** Different stacks (SPA vs server-rendered),
   different formats (`$1.234.567`, `12/09/2026`), different account models
   (cuenta corriente, vista, línea de crédito, USD accounts). Normalization
   happens at the driver boundary (ADR-007).

## Two surfaces, one core

```text
cta/                         # pnpm workspaces, TypeScript project references
├── packages/
│   ├── core/  (@albertomarturelo/cta-core)  # domain, tasks, seams, bank drivers
│   ├── cli/   (@albertomarturelo/cta-cli)   # the `cta` binary; also what an agent drives via shell
│   └── mcp/   (@albertomarturelo/cta-mcp)   # stdio MCP server for Claude Desktop / Claude Code / any MCP client
├── docs/                    # CFD context layer
│   └── bank-contract/       # one observed wire contract per bank
└── .claude/commands/        # CFD procedures (plain markdown)
```

## Core module map

```text
packages/core/src/
├── config/        # (planned) constants; bank hostnames live ONLY inside each driver's config
├── errors/        # CtaError + UnknownBank, NoSuchAccount, AmbiguousAccount (usage, exit 2),
│                  #   NotAuthenticated (no session or expired, 3), BankBlocked (4), BankError (5)
├── money/         # Money in integer minor units; decimal and es-CL parsing (ADR-007)
├── dates/         # ISO date normalization (ADR-007)
├── domain/        # Cuenta, Saldo, Movimiento
├── seams/         # BankDriver, SessionStore, AuditSink, Clock interfaces + in-memory fakes
├── identity/      # resolveBank: validates the required --banco (ADR-011)
├── accounts/      # matchCuenta: --cuenta by full number or last 4 digits
├── banks/         # (planned)
│   ├── registry.ts          # append-only list of drivers
│   └── bci/                 # first driver (ADR-003)
├── tasks/         # createTasks: the public API surfaces call; writes an audit receipt per call
└── node/          # ./node subpath: FileSessionStore (0600), JsonlAuditSink (receipt fields
                   #   only — an allowlist, stricter than dropping secret keys), SystemClock;
                   #   Playwright-backed drivers (lazy; visible browser, ADR-012);
                   #   FetchHttpClient for HTTP-mode reads (ADR-015);
                   #   holder/: the grant holder (ADR-015) — daemon.ts (spawned
                   #   detached, exits when idle), server.ts (Unix socket, 0600),
                   #   client.ts (createRemoteTasks), launch.ts (createHolderTasks:
                   #   what the CLI and the MCP compose)
```

**Dependency direction:** `config`, `errors`, `money`, `dates`, `domain`, `seams` are leaves;
`identity`, `accounts` and `banks/*` depend on leaves and seams; `tasks/` composes
them and is the only thing surfaces import (plus the `./node` adapters). A bank driver never imports another
driver.

## Where an agent plugs in

- **MCP:** `cta-mcp` over stdio; tools mirror the CLI verbs, read tools marked
  `readOnlyHint`. Login opens a visible browser window on the user's machine
  (ADR-006), so an agent's bank access starts in plain sight. Reads open one too
  for `headed` drivers (ADR-012); `http` drivers (BCI) read with the grant the
  local **grant holder** keeps in memory until its `exp` (ADR-015). The holder
  is one daemon per user, on `~/.cta/holder.sock` (`0600`): the first `login`
  from the CLI or the MCP starts it, both surfaces read through it, and it exits
  once it holds no session and no login in flight. With no holder running,
  status and reads answer locally (no live session).
  MCP `login` returns once the window is open; the login ends in the background,
  one per bank at a time, and `bancos` reports how it went (ADR-013).
- **CLI:** an agent with a shell runs `cta … | jq`. JSON is the default output.
- **Embedded:** a host system imports `cta-core` tasks and may inject its own
  `BankDriver` or `SessionStore`.

## Local state

`~/.cta/` — `sessions/<banco>.json` (cookies only, `0600`) and `audit.jsonl`
(receipts, no account data). No pointer or state file (ADR-011). Never inside the
repo.
