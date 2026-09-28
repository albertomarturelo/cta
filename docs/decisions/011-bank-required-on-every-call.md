# ADR-011: The bank is required on every bank-scoped call — no active pointer

## Status

Accepted — 2026-09-24. Supersedes in part ADR-005 (the active pointer, `cta usar`
and the single-session default); ADR-005's per-bank sessions, identifiers,
`--cuenta` and visibility rules stand.

## Context

ADR-005 let a command omit the bank: `--banco` beat an active pointer set by
`cta usar`, which beat "the only bank logged in". It rejected a mandatory
`--banco` as friction. The owner reversed that call before any identity code
landed. The reasons: an implicit bank is the exact selection hazard ADR-005 was
written to avoid, and it gets worse with an agent. A pointer is hidden state that
changes the meaning of a command typed earlier. The single-session default makes
a script's meaning depend on which logins happen to be alive. Deciding now costs
nothing to migrate.

## Decision

- **CLI:** every bank-scoped command requires `--banco <slug|code>`:
  `cta cuentas --banco bci`, `cta saldo --banco bci [--cuenta <alias|last-4>]`,
  `cta movimientos --banco bci --desde … --hasta …`. Missing `--banco` is a usage
  error (exit code 2) listing the supported banks; the command never guesses.
- **Session commands take the bank positionally:** `cta login <banco>`,
  `cta logout <banco>`. There is no "log out of everything" form in v1.
- **MCP:** every bank-scoped tool — including `login` and `logout` — has a
  **required** `banco` argument in its input schema. No default, no inference
  from stored sessions.
- **No pointer:** `cta usar` and the `usar` MCP tool are withdrawn; nothing like
  `~/.cta/state.json` exists. `cta bancos` still lists supported drivers and
  which have a **stored** session (cookies on disk — not checked against the
  bank, which would be a read, ADR-012); it informs, it never selects.
- **Resolution stays in one core function**, now trivial: validate the given
  slug or code against the driver registry and return the driver, or fail. Tasks
  never receive an optional bank.
- Unchanged from ADR-005: one session per bank, several banks at once; slug plus
  Chilean bank code as alias (`bci` / `016`); `--cuenta` optional (all accounts
  when absent); JSON output carries `banco` (and `cuenta`).

## Alternatives Considered

1. **Keep ADR-005 (pointer + single-session default).** Rejected by the owner —
   hidden state decides which bank a command touches; for an agent, the bank
   must be in the call it makes, not in state it cannot see.
2. **Bank as a positional argument on reads too (`cta saldo bci`).** Rejected —
   a named flag reads unambiguously in scripts and agent transcripts and lets
   flags go in any order; login/logout stay positional because the bank is
   their only operand.
3. **Required only when more than one session exists.** Rejected — the same
   command would be valid today and an error tomorrow, depending on other logins.

## Consequences

- Easier: every command and tool call is self-describing; no state file to read,
  migrate or corrupt; the identity module shrinks to validation.
- Harder: `--banco bci` on every call. Accepted: explicitness is the point.
- Obligation: CLI parsers and MCP schemas mark the bank required; tests cover
  the missing-bank error; ADR-007's surface list drops `usar`.
