# ADR-003: Shared core, thin surfaces, one driver per bank behind a seam

## Status

Accepted — 2026-09-23. Lineage: sii ADR-003 (seams), ADR-007 (modular layout),
ADR-016 (embeddable core).

## Context

Every guardrail — throttling, audit, session handling, the bank selection rule —
must apply identically from the CLI and from the MCP server. Unlike sii (one
portal), `cta` targets many banks, each with its own login flow, second factor
and page structure. Each bank must be addable without touching the others, and
tests must never reach a real bank.

## Decision

- **One core, `@albertomarturelo/cta-core`, holds all domain logic.** CLI
  commands and MCP tools are thin calls into core **tasks**; a surface never
  imports a driver or an internal module. CI enforces it with a boundary grep.
- **`BankDriver` is the per-bank seam.** Each bank is a driver module
  (`packages/core/src/banks/<slug>/`) implementing one interface: interactive
  login (headed), session restore (cookies-only), `listAccounts`, `getBalance`,
  `listMovements`, and logout. Drivers register in one append-only registry;
  `cta bancos` lists them. A driver returns the core's normalized types, never
  the bank's raw shape.
- **Other injectable seams:** `SessionStore` (cookies per bank, default fs under
  `~/.cta/`, mode `0600`), `AuditSink` (JSONL receipt), `Clock`. Tests inject
  in-memory fakes.
- **Embeddable core:** pure main barrel (no `node:*`, no Playwright at import
  time); Node adapters and the default Playwright-based drivers live behind a
  `./node` subpath.
- **First driver: BCI (`bci`).** The order in which banks are added carries no
  meaning beyond sequence. Every other bank arrives as a separate driver,
  contributed by someone able to observe it first-hand (ADR-004).

## Alternatives Considered

1. **One generic scraper configured per bank (selectors in JSON).** Rejected —
   bank flows differ in structure (second factors, iframes, SPA vs server
   pages), not just selectors; config would grow into an untestable DSL.
2. **One package per bank.** Rejected for now — premature; a driver folder with
   its own contract doc is enough. Revisit if a driver needs heavy dependencies.
3. **Surfaces call drivers directly.** Rejected — bypasses the audit and
   throttling rails (the sii rule that stays non-negotiable).

## Consequences

- Easier: adding a bank is a new folder, a contract doc and one registry line.
- Obligation: every driver ships fakes-based tests and a
  `docs/bank-contract/<slug>.md`; normalized types are the stable contract, so
  a driver change never breaks a surface.
