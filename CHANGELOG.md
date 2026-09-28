# Changelog

Release history of the **cta** monorepo. The three packages —
[`@albertomarturelo/cta-core`](packages/core), [`@albertomarturelo/cta-cli`](packages/cli)
and [`@albertomarturelo/cta-mcp`](packages/mcp) — move in **lockstep**: one version,
one tag, one publish (ADR-010).

Each release is a section headed `## <version> — <YYYY-MM-DD> — <headline>`. A
prerelease version (`0.1.0-rc.1`) publishes under the npm `next` dist-tag and is
marked as a prerelease on GitHub. The
publish workflow lifts that section, verbatim, into the GitHub release notes, so
write it for users. This file is public: no account data, no personal facts
(ADR-009). The project is pre-1.0, so a MINOR bump may carry breaking changes.

## Unreleased

## 0.1.0-rc.2 — 2026-09-28 — The BCI login ends by itself

The first version published by CI through npm trusted publishing, with provenance.

- BCI: the login ends by itself. Once you reach your bank home, the window opens
  *últimos movimientos* through the bank's own menu, takes the read session and
  closes, with no step left to you (#4). If the bank changes that menu, the
  login stops at once and says so, instead of leaving the window open.

## 0.1.0-rc.1 — 2026-09-28 — First prerelease: BCI balances and movements from your AI agent

The first published build, on the npm `next` dist-tag. The MCP server works end to
end for BCI. The CLI logs in, but its reads need the shared session of the next
release.

- **MCP server (`cta-mcp`)** with the tools `bancos`, `login`, `logout`, `cuentas`,
  `saldo` and `movimientos`. No tool accepts a password: `login` opens the bank's
  real page in a visible browser and returns at once. You type your credentials,
  and any second factor, yourself.
- **BCI, read over HTTP after one login.** Once logged in, open *últimos
  movimientos* in that same window. `cta` then holds a read session in memory, never
  on disk, for about an hour, and reads accounts, balances and the latest
  movements without opening a browser again. When it expires, log in again.
  If the bank blocks a read, `cta` stops and shows the bank's message; it never
  retries (ADR-015).
- **Movements** carry signed amounts in integer minor units (cargo negative,
  abono positive), plus a `cobertura` per account that says when the bank
  returned less than the requested range. BCI returns the latest movements of
  each account (50 each), so older ones may be missing (ADR-014).
- **The bank is always explicit:** `--banco` on every bank-scoped command, and
  `banco` on every bank-scoped tool (ADR-011).
- **CLI (`cta`):** `login`, `logout`, `bancos`, `cuentas`, `saldo`,
  `movimientos`, with JSON by default and `--human` for text. In this release a
  CLI command cannot reuse the session of a previous one, so BCI reads from the
  CLI answer `NotAuthenticated`. The next release fixes that.
- Read-only: nothing in this release can move money (ADR-008).
- Requires Node ≥ 20 and Playwright's Chromium (`npx playwright install chromium`).
