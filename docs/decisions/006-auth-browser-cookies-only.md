# ADR-006: Auth — headed browser, user-typed credentials and second factor, cookies only

## Status

Accepted — 2026-09-23. Lineage: sii ADR-006 (browser cookies-only default) and
ADR-026 (the user completes challenges on the provider's own page).

## Context

Bank credentials are the user's most sensitive secret, and most Chilean banks
add a second factor (an app approval, a token, a coordinates card). The MCP
server sits next to an LLM and must never carry a credential. The sii project
proved that a cookies-only session captured after the user logs in on the real
page is enough for reads.

## Decision

- **The only login in v1: headed browser at the bank's real page.** The user
  types RUT, clave and any second factor there. `cta` never fills the form,
  never reads the credential, never persists it. Only the resulting cookies are
  stored, per bank, mode `0600` under `~/.cta/sessions/`.
- **The second factor stays with the user**, in the bank's own app or device.
  `cta` never stores, generates or relays a second factor.
- **MCP login delegates to the same browser flow.** No MCP tool accepts a
  password, a RUT-and-clave pair, or a second-factor code.
- **Only the login task mints a session.** Read tasks consume a valid session or
  raise `NotAuthenticated`; they never log in as a side effect. Session
  expiration is detected by each driver (observed, documented in its contract)
  and reported with the action to take.
- **No keyring and no console login in v1.** Both existed in sii as later
  additions (ADR-010, ADR-025); for banks they would put the clave within reach
  of automation. Revisit only with a new ADR.

## Alternatives Considered

1. **Console login (typed in the terminal, headless form fill).** Rejected for
   v1 — a headless form fill looks like a bot to bank anti-fraud systems and
   invites the evasion ADR-004 forbids.
2. **Store the clave in the OS keyring for unattended re-login.** Rejected for
   v1 — unattended bank logins are the highest-risk pattern (lockouts, fraud
   flags) and the second factor defeats them anyway.

## Consequences

- Easier: the credential never touches `cta`, disk or the LLM; one login flow for
  both surfaces.
- Obligation: sessions expire (bank sessions are short); tasks must fail clearly
  and point to `cta login <banco>`. Unattended/server use is not supported in v1.
