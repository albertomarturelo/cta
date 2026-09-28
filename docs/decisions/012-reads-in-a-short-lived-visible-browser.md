# ADR-012: Reads run in a short-lived, visible browser

## Status

Accepted — 2026-09-24. Refines ADR-006 (restore) and replaces the "headless
cookies-only restore for reads" assumption in STACK.md. **Superseded in part by
ADR-015** (2026-09-28): drivers whose contract records an HTTP read use it, and
the "no daemon" rule gives way to the shared grant holder.

## Context

ADR-006 persists cookies only and restores them for reads; STACK.md assumed that
restore would run headless. The BCI spike (GH-10, `bank-contract/bci.md`) showed
otherwise: one headless restore got a bot challenge (`307` → `403`) on the first
page and no API call went through, while the same restore in a visible Chromium
succeeded. ADR-004 forbids working around a bank control, so "make headless pass"
is not an option. Other banks may behave differently, so the choice must be per
driver, grounded in each contract.

## Decision

- **One visible browser per read command.** `cta saldo --banco bci` (or the MCP
  `saldo` tool) launches a normal, visible Playwright Chromium, adds the bank's
  stored cookies, reaches the data through the bank's own pages and hops (for BCI:
  JSF home → `TokenAutorizacion` → app token), reads, and closes the browser. The
  user sees when `cta` is inside their bank.
- **Requests originate from the page**, never from a Node HTTP client: API calls
  run inside the bank's own page context, with the headers the bank's app uses,
  so the bank sees the same browser it already checked.
- **No concealment, no persistence:** the window is not moved off-screen,
  minimized or made transparent; no background browser daemon; nothing keeps a
  session alive between commands (the bank's idle policy applies as designed).
- **Per-driver read mode**, declared by the driver and justified in its contract:
  `headed` (the default, and BCI's) or `headless` only when the contract records
  a headless read that passed. A failed headless read is never retried headed or
  vice versa within a command; the mode is static.
- **Failure handling unchanged:** a challenge, `403`, login wall or error page
  stops the command with the bank's message verbatim (ADR-004); an expired session
  raises `NotAuthenticated` with the action `cta login <banco>` (ADR-006).
- **Account listing must not need the RUT from the user.** `cta` never asks for,
  reads from the environment, or stores the RUT. How BCI lists accounts without
  it (a no-body endpoint, or a claim of the bank-issued token held in memory) is
  open in GH-15 and settled in the driver's contract before the driver ships.

## Alternatives Considered

1. **Headless reads.** Rejected for BCI — observed blocked; flags or plugins to
   pass would be evasion (ADR-004).
2. **Hidden window** (off-screen, minimized, zero-size). Rejected — conceals
   automation from both the user and the bank's checks; it is headless by other
   means.
3. **Persistent browser daemon** reused across commands. Rejected — faster for
   bursts, but a long-lived process holding a live bank session, plus the
   temptation to keep it alive past the bank's idle timeout.
4. **Drive the user's own Chrome (CDP to their profile).** Rejected — gives `cta`
   reach into every site the user is logged into.
5. **Node HTTP client with the stored cookies.** Rejected — a different client
   from the one the bank checked; likely challenged, and replaying bot-check
   cookies outside the browser that earned them is evasion-adjacent.

## Consequences

- Every read costs a browser launch (seconds) and shows a window briefly —
  accepted as the honest price of reading a bank without an API.
- Scripts and agents cannot run reads on a headless server; `cta` stays a
  local, attended tool (consistent with ADR-004/006).
- Drivers expose `readMode`; tests stay on fakes; STACK and ARCHITECTURE follow.
