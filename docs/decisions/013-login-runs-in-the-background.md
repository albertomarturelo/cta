# ADR-013: A login can run in the background — one per bank, tracked in core

## Status

Accepted — 2026-09-25. Refines ADR-006 (login flow) for surfaces that cannot
wait; GH-24. **Superseded in part by ADR-015** (2026-09-28): the in-flight login
and its state move to the shared grant holder, reachable from both surfaces.

## Context

The `login` task awaits the whole login: the user types RUT, clave and any second
factor in the bank's page, which can take minutes (the BCI driver waits up to
five). MCP clients usually time out a tool call after about a minute, so the
agent saw an error while the browser stayed open and the cookies still got
saved. A surface that returns early needs to know whether a login is already
running, or a second call opens a second window at the bank. "One login per bank
at a time" is a guardrail, and guardrails live in the core (ADR-003).

## Decision

- **A new task, `startLogin(banco)`,** resolves the bank (an unknown bank fails
  at once), starts the SAME login flow as `login` — same driver call, same
  cookie store, same audit receipt — and returns without waiting:
  `{ banco, estado: 'ventana-abierta' }`, or `{ banco, estado: 'en-curso' }`
  when a login of that bank is already running (no new window).
- **The core keeps the in-flight logins per bank in memory,** inside the tasks
  instance. `login` joins an in-flight login instead of opening another window.
  The state lives only as long as the process; nothing is written to disk.
- **The outcome is audited** by the same receipt as an awaited login (`action:
  login`, ok or the error code). A background failure never becomes an unhandled
  rejection.
- **`bancos` reports what the process knows:** `loginEnCurso: true` while a
  login runs; after a failed one, `ultimoLoginFallido: { error, code }` with the
  bank's message verbatim (ADR-004) until the next login starts. `sesionGuardada`
  turns true once the cookies are stored.
- **MCP `login` calls `startLogin`** and tells the agent to let the user finish
  in the browser and then call `bancos`. The CLI keeps the awaited `login`: a
  terminal can wait.
- **Nothing outlives the login:** the driver's own timeout closes the window
  (ADR-012); no daemon, no detached process, no retry after a failure (ADR-004).

## Alternatives Considered

1. **Track in-flight logins in the MCP server.** Rejected — a guardrail in a
   surface; the next surface to need it would re-implement it (ADR-003).
2. **Keep the call open and send MCP progress notifications.** Rejected — not
   every client resets its timeout on progress, and the agent stays blocked for
   minutes either way.
3. **Spawn a detached `cta login` process.** Rejected — a process that can
   outlive the server while holding a bank window; one-per-bank would need a
   lock file, and the outcome would reach the agent only through the disk.
4. **A separate `login_estado` tool.** Rejected — `bancos` already reports
   sessions per bank; one more field is cheaper than one more tool.

## Consequences

- Easier: MCP login never times out; a repeated call is harmless.
- Harder: the tasks instance holds state (one entry per bank at most); tests use
  a fake driver whose login resolves later.
- `loginEnCurso` and `ultimoLoginFallido` are per process: the CLI never sees an
  MCP server's login in flight. Two processes can still each open a window;
  accepted, since both are started by the same person on the same machine.
- `logout` does not cancel a login in flight (the window is the user's to close);
  it reports `loginEnCurso: true` so the agent can say the session will be saved
  again when the user finishes.
