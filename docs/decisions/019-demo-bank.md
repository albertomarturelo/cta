# ADR-019: A fictitious `demo` bank, enabled with `CTA_DEMO=1`

## Status

Accepted — 2026-10-07. Extends ADR-003 (one more driver behind the seam) and
ADR-011 (the bank stays explicit). CTA-10.

## Context

Trying `cta` today needs an account at a supported bank and a real login, and
every answer is the user's own PII (ADR-009). There is no way to run the CLI or
an MCP client end to end — login window, accounts, coverage, cards — with data
that is safe to show, share or put in an issue. Fakes exist only inside unit
tests (`seams/fakes.ts`), below the surfaces and the holder.

## Decision

- **A driver like any other:** slug `demo`, code `000`, name «Banco Demo (datos
  ficticios)», `readMode: 'http'`. It goes through the same tasks, holder, audit
  and output schemas as a real bank (ADR-003, ADR-007, ADR-015); surfaces gain
  no demo code. The bank stays explicit: `--banco demo`, `banco: "demo"`
  (ADR-011) — data shown under a real bank's name is never fictitious.
- **Off by default.** `defaultDrivers()` registers it only when the process sees
  `CTA_DEMO=1` (a terminal, or `env` in an MCP client's config). The holder
  inherits the variable from the surface that spawns it; a holder started
  without it does not know `demo`, and asking for `demo` then says how to
  enable it. Without the flag nothing changes: `bancos`, help and schemas are
  as before.
- **The login looks and behaves like a real one, with no bank involved.** The
  same visible Chromium (ADR-006) opens a local page, clearly marked as
  fictitious, with RUT and clave fields that `cta` never reads; submitting it
  (anything typed) ends the login and closes the window. Closing it or waiting
  out the timeout is a `LoginCancelled`, as with a bank. The grant lasts 60
  minutes; after it, reads raise `NotAuthenticated`, as with a bank.
- **Synthetic data, dated relative to today.** A pure, deterministic generator
  (fixed seed; no randomness at run time) builds two accounts, about six weeks
  of movements (salary, transfers, utilities, insurance, groceries, fuel,
  subscriptions, a card payment) and two credit card accounts — one with an
  additional card, CLP and USD quotas, billed and unbilled movements,
  installments. Like a real bank, a read returns only the latest movements per
  account, so a long range reports incomplete coverage (ADR-014).
- **Nothing real, nothing persisted.** No person, company or bank brand in the
  data: invented merchants, invented numbers, synthetic RUT-free accounts. The
  demo stores no cookie and writes nothing but the usual audit receipt.
- No bank contract applies: no endpoint or selector is observed (ADR-004 does
  not apply); the generator is the contract and is unit-tested.

## Alternatives Considered

1. **A mock switch on a real bank (`bci` answers fictitious data when
   `CTA_MOCK=1`).** Rejected: fictitious data would appear under a real bank's
   name and code, and one forgotten variable would make real-looking answers
   false. A separate slug makes every demo answer say so.
2. **Always registered.** Rejected for now: it would add a bank to `bancos`,
   help and the MCP descriptions for everyone. The flag keeps the default
   surface unchanged; it can be revisited.
3. **Instant login with no window.** Rejected: the login window and its privacy
   property are what a demo most needs to show; a test can still drive the
   driver's read methods with a grant directly.
4. **A static fixture file.** Rejected: fixed dates go stale, and "this month"
   questions stop working; a generator keyed on today stays current.

## Consequences

- Anyone can try both surfaces, and an issue can carry demo output verbatim.
- One more driver to keep in step with the schemas; the shared Playwright launch
  moves to `node/browser.ts` so both drivers use one.
- The holder/flag interaction is a known edge: after enabling `CTA_DEMO` in an
  MCP client, a holder already running from a terminal without it must end
  (`cta logout <banco>`) before `demo` appears.
