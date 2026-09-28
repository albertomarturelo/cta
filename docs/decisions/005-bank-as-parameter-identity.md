# ADR-005: The bank is a parameter — per-bank sessions, active pointer, explicit override

## Status

Accepted — 2026-09-23. Lineage: sii ADR-005 (operate-centric pointer + per-call
override, same value-domain). **Superseded in part by ADR-011 (2026-09-24):** the
active pointer, `cta usar` and the single-session default are withdrawn; `--banco`
is required on every bank-scoped call.

## Context

The binary is `cta` (short for *cuenta*), deliberately not named after a bank.
Every command therefore needs to know which bank it acts on. A person may hold
accounts in several banks and several accounts in one bank. For an LLM, an
implicit or invisible bank choice is a selection hazard.

## Decision

- **One session per bank, several banks at once.** `cta login <banco>` opens the
  bank's real login page, headed, and stores that bank's cookies only.
  `cta logout [<banco>]` closes one bank (or all).
- **Active bank pointer.** `cta usar <banco>` selects the active bank among those
  with a live session. **With exactly one bank logged in, it is the active one by
  default** — no pointer needed.
- **`--banco <slug>` is the per-call override**, from the same value-domain.
  Precedence: `--banco` > active pointer > the single session. With several
  sessions and no pointer, the command fails with an actionable message.
- **Accounts:** `--cuenta <alias|last-4>` selects an account within a bank;
  without it, reads cover all accounts of that bank.
- **Bank identifiers:** a lowercase slug (`bci`) plus the Chilean bank code as an
  alias (`016` for BCI). The table grows only when a driver lands.
- **Always visible:** JSON output carries `banco` (and `cuenta`) fields; human
  output prints the effective bank on STDERR. `cta bancos` lists supported
  drivers and which have a live session.
- **MCP:** every bank-scoped tool takes an optional `banco` argument with the
  same default rules, so the model always sees which bank it acts on.

## Alternatives Considered

1. **Bank in the binary name (`cta-bci`, `bci-cli`).** Rejected — a bank's trademark
   in the name, and every new bank would need a new tool.
2. **Mandatory `--banco` on every call.** Rejected — friction for the common case
   of one bank; the single-session default removes it safely.
3. **One global session (logout → login to switch), like sii.** Rejected — unlike
   SII identities, bank sessions are independent; forcing a switch adds logins,
   and every login is a risk (ADR-004).

## Consequences

- Easier: `cta login bci && cta saldo` just works; scripts and agents stay
  explicit with `--banco`.
- Obligation: `SessionStore` is keyed by bank; the resolution rule lives in ONE
  core function used by every task; the effective bank is never implicit in
  output.
