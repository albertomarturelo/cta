# ADR-004: Own-account posture, no evasion of bank controls, public MIT release

## Status

Accepted — 2026-09-23. Lineage: sii ADR-004 (guardrails and ToS posture) and
ADR-018 (MIT release), hardened for banks.

## Context

A bank is not a tax authority. Its terms of service usually forbid automated
access, its anti-fraud systems are more aggressive than the SII's, and a blocked
account hurts a user more than a failed SII read. Aggregators like Floid absorb
that risk as companies; the user of an open-source tool has no one behind them.
The project must be defensible as "a person reading their own data with their
own credentials" and nothing more.

## Decision

These are repo invariants:

- **Own account only.** The user operates accounts they hold, with credentials
  they type. The project never custodies a third party's credentials, never
  offers multi-tenant hosting, and never ships a server mode for others.
- **Never evade a bank control.** No CAPTCHA solving, no device-fingerprint or
  user-agent spoofing, no stealth plugins, no bot-detection evasion, no proxy or
  IP rotation. The browser is a normal headed browser the user can see. If the
  bank shows a challenge, the user resolves it; if the bank blocks, the task
  stops.
- **One attempt, never retry** after a failed login, a second-factor rejection,
  a lock or a rate-limit response. The bank's message surfaces verbatim.
- **First-hand observation only.** Every selector, endpoint and payload shape is
  observed on the live bank by an account holder, cited in code
  (`// observed at <URL> on <YYYY-MM-DD>`), and documented in
  `docs/bank-contract/<slug>.md`. No third-party bank-scraping libraries.
- **Paced reads.** Fan-outs (many accounts, long movement ranges) run at a
  conservative configurable rate.
- **Audit is a receipt of actions, never of data:** `{ts, action, banco, result,
  durationMs}`; account numbers, balances, movements and counterparties never
  enter it; keys matching `password|clave|cookie|secret|token|pass` are dropped.
- **Public release under MIT**, with an explicit notice in the README: no
  affiliation with any bank, provided "as is", and **the bank may block the
  user's access or device**.

## Alternatives Considered

1. **Stealth automation to survive bot detection.** Rejected — it turns "reading
   my own account" into "evading a security control", which is the line between
   defensible and not.
2. **Hosted service (like commercial aggregators).** Rejected — requires
   custody of third-party credentials and regulated operation; out of scope and
   against the project's thesis ("your data, your machine").
3. **Silent retries for flaky pages.** Rejected — a retry on a login can lock
   the account; the cost asymmetry is total.

## Consequences

- Easier: a clear public line to point at, in the README and in reviews.
- Obligation: some banks may be unautomatable under these rules; that is an
  accepted outcome, documented in the bank's contract doc, never a reason to
  relax the rules.
