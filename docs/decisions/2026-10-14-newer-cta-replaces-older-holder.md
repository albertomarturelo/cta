# A newer `cta` replaces an older grant holder; never the other way round

## Status

Accepted — 2026-10-14. Amends ADR-015 (when the shared holder exits).

## Context

The grant holder (ADR-015) is a daemon that outlives the command that started
it: it keeps serving the code it was spawned with until it holds nothing and
idles out, up to an hour after a login. After an upgrade, the CLI and the MCP
keep talking to the old code, so a fix looks absent (CTA-4). The CLI and the
MCP are installed separately (a global `cta`, an MCP client's own `npx` line),
so two versions talking to one holder is a normal state, not an edge case. A
holder also holds the only copy of a session: replacing it costs the user a
new attended login, and the bank's tolerance for logins per day is limited.

## Decision

- **Every request carries the caller's package version.** The holder knows its
  own (the core's `package.json`).
- **Only a caller newer than the holder replaces it.** The holder answers
  `replaced` with the slugs of the banks it held a session for, instead of
  serving, frees its socket path at once and exits. A newer or equal holder
  serves an older caller as is. Versions that do not parse replace nothing.
- **Never during a login:** a holder with a login in flight serves the request
  as is; the user is typing into the bank's page. It is replaced on a later call.
- **The loss is said, not hidden:** after a replacement the caller behaves as
  with no holder (a login starts a fresh one), and a read on a bank whose
  session ended says so and asks for `cta login <banco>` (exit 3).
- **The caller waits, bounded, for the old socket to be gone** before starting
  a holder, so the new one never shares the path with a closing one.
- **The environment is not compared.** `CTA_DEMO` (ADR-019) exists for
  recordings; `demo` already tells the user how to reset the session.
- Holders from 0.3.0 or earlier ignore the version and keep today's behavior.

## Alternatives Considered

1. **Replace on any difference (version or environment).** Rejected: a CLI and
   an MCP of different versions, or with different `CTA_DEMO`, would take turns
   killing each other's session, one attended login each time.
2. **Replace only an idle holder.** Rejected: the old code keeps serving for up
   to an hour after an upgrade, which is the bug being fixed.
3. **Make the surfaces warn and let the user run `cta logout`.** Rejected: the
   MCP has no terminal to warn in, and a logout from the old holder still
   leaves it running for its idle grace.
4. **Fingerprint the build (mtime or hash of `dist/`).** Rejected for now: it
   only matters while developing, where `cta logout` is enough, and it cannot
   be ordered, so it brings back alternative 1's ping-pong.

## Consequences

- An upgrade takes effect on the first command after it, from either surface.
  The price is one new login when the old holder held a session.
- A user who keeps an older surface installed next to a newer one is served by
  the newer holder; the older surface never downgrades it.
- New protocol surface: an optional `version` field in the request and a
  `replaced` answer. Neither carries the grant or account data.
- A narrow race stays: a login an older caller starts on the old holder after
  it decided to stop, and before it exits, ends with the process and its
  window closes. It needs two versions acting within milliseconds; the user
  logs in again.
