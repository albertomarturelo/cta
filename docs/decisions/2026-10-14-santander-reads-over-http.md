# Santander reads over HTTP with the page's own grant, within the bank's session

## Status

Proposed — 2026-10-14. Becomes Accepted when the evidence gate below is met.
Applies ADR-015 to the `santander` driver and amends ADR-018 for this bank
only (where the read headers come from).

## Context

The login spike (CTA-14, `bank-contract/santander.md`) found that Santander's
web app reads accounts on `openbanking.santander.cl` with a JWT bearer issued to
the bank's own app, the same shape that made ADR-015 work for BCI. Four things
differ from BCI:

- **The session lasts 10 minutes.** At the token's `exp` the bank's own page
  revokes it and logs off; while idle it does not refresh. ADR-015 forbids
  refresh and keep-alive, so one login gives about 10 minutes of reads.
- **The read headers are not in a readable bundle.** The app's runtime config
  is deliberately obfuscated and names client credentials. ADR-018 builds BCI's
  headers from public bundles; here cta would have to deobfuscate, and it does
  not read what the bank hides.
- **Some services carry the RUT** (debit cards in the URL, statements in the
  body). ADR-012: cta never builds, reads or sends the RUT.
- **No evidence yet** that a read with the page's own headers answers outside
  the page. ADR-015 makes that evidence the condition for `readMode: 'http'`.

## Decision

- **Read mode `http`, same rails as ADR-015:** the grant lives only in memory,
  in the shared holder, one per bank; only its `exp` claim is read; no refresh,
  no keep-alive, no silent re-login; a block or a challenge raises
  `BankBlocked` with the bank's words and stops, with no browser fallback.
- **The session is what the bank grants.** `bancos` reports `sesionHasta` from
  `exp` (about 10 minutes). The CLI hint and the MCP tool descriptions say that
  Santander reads must happen within that window. A BCI session and a Santander
  session coexist in the holder, each ending at its own `exp`; the holder exits
  when the last one ends.
- **The grant comes from the page's own requests after the landing**
  (ADR-015's original form): the login watches, clicks nothing, and takes the
  `Authorization` bearer and the app's API header **names it allows** from
  calls the page makes by itself. The token endpoint's answer is never parsed:
  it carries the customer's identity and products. No deobfuscation of any
  bank file. If the expected calls do not come within a bounded wait, the login
  fails at once, naming the step.
- **Header allowlist:** `authorization`, `x-santander-client-id`,
  `x-schema-id`, `x-b3-spanid`, `x-client-code`, `x-organization-code`,
  `content-type`. No cookies, no browser headers (`user-agent`, `origin`,
  `referer`, `sec-*`), no bot-manager telemetry headers.
- **Scope:** `cuentas`, `saldo`, `movimientos`. `tarjetas` (credit cards,
  ADR-017) answers `NotYetSupported` until a credit-card service is observed.
  Debit cards and statements have no surface in cta, and their services need
  the RUT. Movements carry `cobertura` (ADR-014) until a range read is observed.
- **Evidence gate.** This ADR becomes Accepted, and the driver's code may be
  written, only once the contract records, with dates:
  1. a read of balances and of movements answering `200` with the page's own
     headers only, from outside the page, before `exp`;
  2. an accounts source that needs no RUT in any request cta builds;
  3. which of the page's own calls after the landing, with no click, carry
     the full header set.

## Alternatives Considered

1. **Read inside the login window** (cta reads while the bank's page is open,
   then closes it). Rejected: it needs clicks after the user's typing
   (ADR-018), the login would not end on capture, and every read would cost a
   new attended login — nothing could be automated.
2. **No Santander driver for now.** Rejected as the default: the contract shows
   a viable path, and the owner wants several banks in one holder. It remains
   the outcome if the evidence gate fails.
3. **Refresh the token to stretch the session.** Rejected: ADR-015 (no
   keep-alive, no refresh); the session is what the bank designed.
4. **Build the headers from the bundles, as ADR-018 does for BCI.** Rejected:
   it requires deobfuscating a file the bank deliberately hides, including
   client credentials.

## Consequences

- Santander serves on-demand reads: log in, read within about 10 minutes.
  Periodic or unattended reads are out of reach by the bank's design.
- No driver code until the gate is met; the gate's evidence lands in
  `bank-contract/santander.md` first.
- A per-bank session length now matters to agents: the MCP descriptions must
  say it, so a model does not plan reads past `exp`.
- If the bank adds checks to `openbanking`, the driver stops with `BankBlocked`
  and a follow-up decides from a new observation (ADR-004).
