# ADR-008: v1 is read-only; money-moving surfaces are gated behind their own ADR

## Status

Accepted — 2026-09-23. Lineage: sii ADR-017 (first write surface posture) and
ADR-023 (prepare, never emit, when a credential alone would bind the user).

## Context

The long-term idea is an agent that prepares a transfer which only the user can
complete with the bank's second factor. That is the highest-stakes surface this
project could ship: irreversible, and the canonical target of prompt injection
(a document the agent reads could try to redirect a payment). The decision is to
first measure interest with reads only, and add writes later.

## Decision

- **v1 ships no write surface.** No transfer, payment, beneficiary creation or
  any other state-changing bank operation exists in code, in drivers or in
  tools. Drivers expose read methods only.
- **Any future write surface needs its own ADR first**, and that ADR must satisfy
  at minimum:
  1. **The bank's second factor is the only completion path.** `cta` prepares;
     the user approves in the bank's app. `cta` never completes a transfer alone.
  2. **The second-factor screen must show amount and destination**, verified per
     bank and recorded in its contract doc. If it does not, the surface is not
     built for that bank.
  3. **Destination allowlist** kept locally by the user; a destination outside it
     is refused before reaching the bank.
  4. **Preview with amount and destination echoed**, and an explicit confirm
     token, as in sii ADR-017. MCP tool marked `destructiveHint: true`.
  5. **Audit of every attempt** without amounts or counterparties.

## Alternatives Considered

1. **Ship transfers in v1 behind a flag.** Rejected — the safety design needs
   per-bank facts (what the second-factor screen shows) that only the read phase
   and a spike will produce.
2. **Never support writes.** Rejected as a permanent rule — with the bank's
   second factor as the only completion path, a prepare-only flow is defensible;
   it just is not v1.

## Consequences

- Easier: v1 carries no financial-loss risk, only access risk (ADR-004).
- Obligation: CI and review block any driver method that changes bank state
  until the write ADR is accepted.
