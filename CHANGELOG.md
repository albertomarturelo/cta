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

- New `cta tarjetas --banco bci` and MCP `tarjetas`: your BCI credit cards —
  national (CLP) and international (USD) quotas, last billed amount, minimum
  payment and billing dates, one entry per card account, with additional cards
  listed under it. `--movimientos` (`movimientos: true`) adds the billed and
  unbilled movements. Cards are named by their last 4 digits only.
- The BCI login no longer goes through the bank's menu: once you have typed
  your credentials, it closes as soon as the bank hands out its read token
  (seconds after your home loads), and a change to the bank's menu can no
  longer break it (ADR-018).
- BCI account `tipo` is now the bank's product code (`CCT`, `CPR`, …) instead
  of a word such as `Corriente`: accounts now come from the bank's own account
  listing, which takes no RUT.

## 0.1.1 — 2026-09-29 — A BCI login you can find, that finishes on its own

- The login window now comes to the front, and the terminal and the agent say
  which window to look for (on macOS, «Google Chrome for Testing»; Cmd+Tab if
  you do not see it) and that it closes by itself.
- BCI: the login opens *últimos movimientos* reliably. It waits for your home to
  finish loading, opens the "Mi Cuenta" section from its arrow when the text
  alone does not open it, and checks that the page really moved on before
  taking the session. Before, the window could stay on your home until the
  login timed out.

## 0.1.0 — 2026-09-28 — First stable: one BCI session for your terminal and your AI agent

The first version on the npm `latest` dist-tag. Log in to BCI once, from the
terminal or from Claude Desktop; the window closes by itself, and for about an
hour both the CLI and the MCP read accounts, balances and movements without a
browser. Everything stays on your machine, and nothing but the bank's page ever
sees your credentials.

- **The CLI reads BCI too, and shares the session with the MCP.** A small local
  `cta` process keeps the read session in memory and serves both surfaces over a
  private socket (`~/.cta/holder.sock`, owner-only). Log in from Claude Desktop
  and `cta saldo --banco bci` works in the terminal, or the other way around.
  It starts with the first login and exits on its own when the session ends,
  after `cta logout`, or after a blocked read (ADR-015).
- Known limit: after upgrading `cta`, a session process started by the old
  version keeps running until it ends (about two minutes after the session
  does). Run `cta logout bci` and wait that long, or log in again after it
  exits, to get the new version's behavior.

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
