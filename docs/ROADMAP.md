# Roadmap — cta

The versioned source of truth for "are we there yet?". Every user-facing surface
(CLI verb + MCP tool) gets a row; tick it ✅ when the work merges.

## Where we're going

One `@albertomarturelo/cta-core`, two surfaces (`cta` CLI, `cta-mcp`), one driver
per bank. **v1 = read-only, BCI first.** Interest in v1 decides whether a write
surface (a transfer the user completes in the bank's app) is designed next, under
its own ADR (ADR-008).

**Non-goals:** hosted or multi-tenant service; custody of anyone's credentials;
evasion of any bank control (ADR-004); unattended/server login in v1 (ADR-006);
money-moving operations in v1 (ADR-008).

## Status legend

✅ shipped · 🚧 in progress · 📋 planned · 💭 spike pending · 🔒 blocked (needs an ADR or a spike)

## Foundations

| Status | Item | Notes | ADR |
| --- | --- | --- | --- |
| ✅ | CFD scaffolding | docs, ADRs 001–009, procedures, CI context gate, `AGENTS.md` | 001 |
| ✅ | Sensitive-data gate | `scripts/pii-scan.sh`, git hooks, CI step, `sensitive-data-check` skill | 009 |
| ✅ | Monorepo skeleton | pnpm workspaces + `tsc -b`; core/cli/mcp stubs; versions pinned in STACK; CI build job (GH-2) | 002 |
| ✅ | Release pipeline | `publish.yml` on `v*` tag, trusted publishing + provenance, GitHub release from `CHANGELOG.md`, package metadata (GH-4) | 010 |
| ✅ | Seams spine | interfaces + in-memory fakes (GH-14); Node defaults: fs `SessionStore` (0600), JSONL `AuditSink`, `SystemClock` (GH-19) | 003 |
| ✅ | Money + dates | minor-unit conversion, es-CL and decimal parsing, ISO dates, tests (GH-14) | 007 |
| 📋 | Output contract | shared `emit(data, humanFn)`, JSON default, structured errors | 007 |
| ✅ | Bank resolution | required `--banco` validated against the registry, in one function (`resolveBank`, GH-14) | 011 |
| ✅ | Shared grant holder | CTA-2: local daemon, `0600` Unix socket; started by `cta login` or the MCP `login`; one session for both surfaces; exits when idle (after `exp`, logout or a block); grant in memory only; live-verified 2026-09-28 (each CLI command a separate process) | 015 |

## BCI driver (first bank)

| Status | Item | Notes | ADR |
| --- | --- | --- | --- |
| ✅ | **Spike: BCI login + session** | Observed 2026-09-24 (GH-6): form POST login, trusted-device step, JSF cookies + bearer token via `TokenAutorizacion` for `apilocal` APIs; no CAPTCHA, anti-bot telemetry present. See `bank-contract/bci.md`. Idle lifetime reported (~15 min), not observed. | 004, 006 |
| ✅ | **Spike: BCI reads** | Observed 2026-09-24/25 (GH-8, GH-10, GH-15): accounts (RUT-free: the app's own `por-rut` answer, or `SolicitarClienteCuentas`), balances (integer pesos), latest 50 movements (no range; `tipo` `C`/`A` *inferred*), statements index, expired-session redirect; headless blocked. Idle lifetime, `tipo` confirmation and the JSF date search moved to a follow-up. | 004, 006, 007, 012 |
| ✅ | `bci` driver: login + restore | headed login (GH-23: watch-only, bank cookies only; login 500 and cancel handled; challenges left to the user); cookies-only restore in a visible browser and expiry detection (redirect to `cierresesion` → `NotAuthenticated`, GH-28). The post-login landing moved on 2026-09-28 (orchestrator, `__Host-SESSIONID`): detection fixed in #36 | 003, 006, 012 |
| ✅ | `bci` driver: cuentas + saldo | normalized accounts and balances; the bank's own "Ir a últimos Movimientos" link into the app iframe; accounts from the app's own answer, never the RUT; expired session → `NotAuthenticated`; live-verified 2026-09-25 (GH-28) | 007, 012 |
| ✅ | `bci` driver: movimientos | latest movements per account (50 seen) filtered to the range, with `cobertura` (ADR-014); `tipo` `C`/`A` sign confirmed against the bank's app 2026-09-28; JSF date search later (#27) | 007, 014 |
| ✅ | **Spike: BCI reads over HTTP** | Observed 2026-09-28 (GH-37): after one attended login, balance reads from a Node `fetch` with only the app's own headers answered `200` for 46 min and `401` past `exp`; Cloudflare on `apilocal`, no challenge; token `exp` ≈ 60 min, claims carry personal identifiers | 004, 015 |
| ✅ | `bci` driver: HTTP reads | #38: capture the read grant at login, `readMode: 'http'`, reads from Node; entry via the orchestrator's embedded saldos app (`/modernizacion/…`, GH-36); the login opens "Mi Cuenta" → "Últimos Movimientos" itself and closes (#4); live-verified 2026-09-28 (cuentas, saldo, movimientos) | 012, 015 |
| 🚧 | `bci` driver: grant without the menu | ADR-018: the login closes on the orchestrator's own `connectors/td` token; each app's headers from its public bundle; accounts via `SolicitarClienteCuentas` (no RUT); no menu clicks. Probe 2026-10-07: every read `200` from Node; driver live run pending | 015, 018 |

## Surfaces

| Status | CLI | MCP | Notes |
| --- | --- | --- | --- |
| ✅ | `cta login <banco>` / `cta logout <banco>` | `login` (no password arg) / `logout` | headed browser; cookies only; surfaces (GH-21), BCI headed login (GH-23); MCP `login` returns at once and finishes in the background, one per bank (GH-24, ADR-013) |
| ✅ | `cta bancos` | `bancos` | supported drivers + stored sessions (GH-21), BCI registered (GH-23); MCP also reports a login in flight or its last failure (GH-24) |
| ✅ | `cta cuentas --banco <b>` | `cuentas` | accounts of a bank; `banco` required; surfaces (GH-21), BCI (GH-28) |
| ✅ | `cta saldo --banco <b> [--cuenta]` | `saldo` | `readOnlyHint`; `banco` required; surfaces (GH-21), BCI (GH-28) |
| ✅ | `cta movimientos --banco <b> [--cuenta] [--desde] [--hasta]` | `movimientos` | `readOnlyHint`; `banco` required; `cobertura` per account, `--human` warns on STDERR (GH-29, ADR-014) |
| 💭 | `cta importar <archivo>` (a cartola the user exported, e.g. Excel) | — | Automation without a browser or a session: parse a file the user downloads; reuses the movement normalization. Needs an ADR (input formats, dedup) |
| 🚧 | `cta tarjetas --banco <b> [--tarjeta] [--movimientos]` | `tarjetas` | `readOnlyHint`; ADR-017, ADR-018; BCI paths observed 2026-09-29 (CTA-8): cards app "Mis movimientos", same bearer, its own headers; driver done, live check pending |
| 🔒 | `cta transferir …` | — | **Needs its own ADR** meeting ADR-008's five conditions |

## Where a new surface goes

| Kind of work | Where | Needs |
| --- | --- | --- |
| A new bank | `packages/core/src/banks/<slug>/` + one registry line + `bank-contract/<slug>.md` | a spike on an account the contributor holds |
| A new read of an existing bank | a driver method + a task + CLI command + MCP tool | contract doc updated |
| A new verb | task + both surfaces in the same PR | a row here; an ADR if the name or scope is new |
| Anything that changes bank state | — | **an accepted write ADR first** (ADR-008) |
