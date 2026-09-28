# ADR-015: Reads over HTTP with the bank-issued token, held in memory

## Status

Accepted — 2026-09-28. Supersedes in part ADR-012 (reads for drivers whose
contract records an HTTP read; its "no daemon" rule) and ADR-013 (the in-flight
login moves from the MCP process to the shared holder), and amends ADR-006
(what an HTTP-mode driver persists).

## Context

ADR-012 opens a visible browser for every read, because a headless restore was
challenged on `www.bci.cl`. That keeps `cta` attended: no periodic reads, no
agent working on its own. The GH-37 spike (2026-09-28, `bank-contract/bci.md`,
"Reads from a Node HTTP client") showed that the reads themselves live on a
separate API gateway authorized by a bearer token the bank hands its own app:
after one attended login, a plain Node `fetch` carrying only the app's own
headers read a balance with `200` at 0, 5, 16, 31 and 46 minutes, with
Cloudflare in front and no challenge, and got `401` at 62 minutes, once the
token had expired. The token expires about 60 minutes after
the login and its claims carry the customer's identifiers (RUT, name).

## Decision

- **Login is unchanged (ADR-006, ADR-013):** a visible browser at the bank's real
  page; the user types everything. Before the window closes, the driver opens
  the bank's own balances app the way the bank does (its link or embedded route,
  no URL building) and takes, from the app's own API request, the bearer token
  and the app's own headers — the **read grant**. Then the browser closes.
- **The grant lives only in memory.** Never on disk, in a log, the audit sink,
  an error message, CLI output or an MCP result; never sent to the LLM. `cta`
  reads only its `exp` claim; the other claims (personal identifiers) are never
  decoded, logged or used.
- **HTTP reads:** a driver with `readMode: 'http'` sends its reads from Node
  (`fetch`) to the bank's API with the grant's headers only. No cookies, and no
  browser headers made up (`user-agent`, `origin`, `referer`, `sec-*`), no
  Cloudflare cookies replayed. The bank sees an honest non-browser client.
- **One shared holder, started by either surface:** a local daemon holds the
  grant per bank and serves read tasks over a Unix socket (`0600`, under
  `~/.cta/`, same user only). Whichever surface asks for a login first starts
  it: `cta login <banco>` in a terminal, or the MCP `login` tool from Claude
  Desktop or any other MCP client, with no terminal involved. Both then read
  through the same grant, so one login serves both. The daemon also owns the
  one-login-in-flight-per-bank rule (ADR-013), so a second login request joins
  the running one. It exits at `exp`, on `logout` from either surface, or on
  the first expired or blocked answer. It exposes read tasks only (ADR-008).
- **No keep-alive, no refresh, no silent re-login.** At `exp` or on a `401` the
  read raises `NotAuthenticated` ("run `cta login <banco>`"). Nothing pings the
  bank to stretch a session.
- **A block stops the read, with no fallback:** a challenge, a `403` or a
  non-JSON answer raises `BankBlocked` with the bank's words verbatim. The mode
  is static per driver; a failed HTTP read never retries in a browser (ADR-004,
  ADR-012).
- **HTTP mode needs evidence:** a driver declares `readMode: 'http'` only when its
  contract records an HTTP read that passed. Other drivers stay `headed`
  (ADR-012). An HTTP-mode driver persists no cookies: the grant in memory is
  its whole session.

## Alternatives Considered

1. **Keep a browser per read (ADR-012 as is).** Rejected: it rules out the
   periodic and agent reads the project exists for, and the spike shows the API
   answers the app's own token from Node.
2. **Store the token (file or macOS Keychain).** Rejected: a bearer that carries
   the RUT and name would land on disk, against ADR-006 and "`cta` never stores
   the RUT" (ADR-012).
3. **One holder per surface (the grant inside the MCP process, a daemon only
   for the CLI).** Rejected: the same person would log in twice per hour, once
   in the terminal and once in Claude Desktop. The requirement is that either
   surface can *start* a session on its own, not that each needs its own.
4. **Fall back to a browser when HTTP is blocked.** Rejected: a retry after a
   block (ADR-004).
5. **Keep-alive or token refresh.** Rejected: it stretches a session past what
   the bank designed. An hour of reads per attended login is the contract.
6. **Node client with the stored cookies on `www.bci.cl`** (ADR-012's
   alternative 5). Still rejected: those pages run bot checks, and replaying
   cookies the browser earned would be evasion-adjacent. The API gateway takes a
   bearer by design.
7. **Typing the credentials into the CLI and logging in over HTTP.** Rejected:
   ADR-006. The credential stays in the bank's page, and that login is also
   behind the same bot checks.

## Consequences

- One attended login, from the terminal or from Claude Desktop, gives about an
  hour of window-free reads to both surfaces.
- New code: a grant capture in the driver's login, an HTTP read path, a
  grant-holder daemon that either surface starts and reaches, and
  `readMode: 'http'`. CONVENTIONS ("Reads run
  in a short-lived, visible browser", "never a Node HTTP client"), ARCHITECTURE
  and STACK change when it ships.
- The daemon is a new local surface. Mitigations: a same-user `0600` socket,
  read tasks only, exit at `exp`, and no grant in any answer. A logout from
  either surface ends the session for both, which is the intended meaning of
  "one session".
- The bank may add checks to the gateway at any time. The driver then stops with
  `BankBlocked` and a follow-up decides, from a new observation, whether the
  driver goes back to `headed`.
- Reads past the hour, or with nobody at the machine to log in, stay out of
  reach by design (ADR-004, ADR-006).
