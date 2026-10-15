# Architecture Decision Records

Foundational decisions for `cta`. Rules ported from `albertomarturelo/sii` cite
their lineage inside each record. Numbered ADRs keep their number as ID; ADRs
written from 2026-10-11 on are `YYYY-MM-DD-<slug>.md` and their ID is the slug
(`adr-ids-date-slug`).

| ID  | Title | Status | Date |
| --- | ----- | ------ | ---- |
| 001 | [Adopt Context-First Development (CFD) for this repo](001-adopt-cfd-methodology.md) | Superseded in part by `adr-ids-date-slug`, `procedures-as-agent-skills` | 2026-09-23 |
| 002 | [TypeScript + Node + pnpm-workspaces monorepo toolchain](002-typescript-node-pnpm-monorepo.md) | Accepted | 2026-09-23 |
| 003 | [Shared core, thin surfaces, one driver per bank behind a seam](003-shared-core-bank-driver-seam.md) | Accepted | 2026-09-23 |
| 004 | [Own-account posture, no evasion of bank controls, public MIT release](004-own-account-posture-no-evasion.md) | Accepted | 2026-09-23 |
| 005 | [The bank is a parameter — per-bank sessions, active pointer, explicit override](005-bank-as-parameter-identity.md) | Superseded in part by 011 | 2026-09-23 |
| 006 | [Auth — headed browser, user-typed credentials and second factor, cookies only](006-auth-browser-cookies-only.md) | Accepted | 2026-09-23 |
| 007 | [JSON by default, normalized money and dates, surfaces named by artifact](007-json-output-and-surface-naming.md) | Accepted | 2026-09-23 |
| 008 | [v1 is read-only; money-moving surfaces are gated behind their own ADR](008-read-only-v1-write-gate.md) | Accepted | 2026-09-23 |
| 009 | [Sensitive-data gate — scanner, hooks, CI and an agent skill](009-sensitive-data-gate.md) | Accepted | 2026-09-23 |
| 010 | [Publish the packages to public npm via trusted publishing, on a version tag](010-publish-npm-trusted-publishing.md) | Accepted | 2026-09-24 |
| 011 | [The bank is required on every bank-scoped call — no active pointer](011-bank-required-on-every-call.md) | Accepted | 2026-09-24 |
| 012 | [Reads run in a short-lived, visible browser](012-reads-in-a-short-lived-visible-browser.md) | Superseded in part by 015 | 2026-09-24 |
| 013 | [A login can run in the background — one per bank, tracked in core](013-login-runs-in-the-background.md) | Superseded in part by 015 | 2026-09-25 |
| 014 | [Movements carry their coverage — a bank may return less than the range](014-movements-carry-their-coverage.md) | Accepted | 2026-09-25 |
| 015 | [Reads over HTTP with the bank-issued token, held in memory](015-reads-over-http-with-the-bank-issued-token.md) | Accepted; amended by `newer-cta-replaces-older-holder` | 2026-09-28 |
| 016 | [Development work items live in a private GitHub Project](016-work-items-in-a-private-project.md) | Accepted | 2026-09-28 |
| 017 | [Credit cards — `cta tarjetas`, read with the login's grant and the cards app's own headers](017-credit-cards-surface.md) | Accepted | 2026-09-29 |
| 018 | [The read grant comes from the orchestrator's token call and the apps' own bundles — no menu](018-grant-without-the-menu.md) | Accepted | 2026-10-07 |
| 019 | [A fictitious `demo` bank, enabled with `CTA_DEMO=1`](019-demo-bank.md) | Accepted | 2026-10-07 |
| `adr-ids-date-slug` | [ADR identity is a date-prefixed slug, not a sequence number](2026-10-11-adr-ids-date-slug.md) | Accepted | 2026-10-11 |
| `procedures-as-agent-skills` | [CFD procedures ship as Agent Skills, one copy for every agent](2026-10-11-procedures-as-agent-skills.md) | Accepted | 2026-10-11 |
| `newer-cta-replaces-older-holder` | [A newer `cta` replaces an older grant holder; never the other way round](2026-10-14-newer-cta-replaces-older-holder.md) | Accepted | 2026-10-14 |
| `santander-reads-over-http` | [Santander reads over HTTP with the page's own grant, within the bank's session](2026-10-14-santander-reads-over-http.md) | Accepted; amended by `santander-accounts-from-the-login-answer` | 2026-10-14 |
| `santander-accounts-from-the-login-answer` | [Santander: grant and accounts from the login's answer, headers from the public config](2026-10-14-santander-accounts-from-the-login-answer.md) | Accepted; amended 2026-10-15 | 2026-10-14 |
