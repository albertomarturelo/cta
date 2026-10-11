<!-- INDEX, not an encyclopedia: ≤100 lines. AGENTS.md is a symlink to this file. -->

# Project: cta — TypeScript core + CLI + MCP for Chilean bank accounts

## What This Project Does

A TypeScript monorepo that lets a person read their OWN Chilean bank accounts —
balances and movements (the *cartola*) — from the terminal or from an AI agent,
running locally, with credentials typed only into the bank's real login page.
One shared core (`@albertomarturelo/cta-core`) backs two surfaces: a human
**CLI** (`cta`) and an **MCP** server. Each bank is a driver behind a seam; the
first one is **BCI**. v1 is **read-only**; writes need their own ADR (ADR-008).

Sibling project and pattern source: `albertomarturelo/sii` (same author, same
method). Rules proven there are PORTED and cited, not re-derived.

## Context map (read on demand, not all at once)

- Session memory (local, gitignored): [docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md)
- Architecture and the realities of bank portals: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Stack and pinned versions: [docs/STACK.md](docs/STACK.md)
- Conventions (source of truth for style, security, naming): [docs/CONVENTIONS.md](docs/CONVENTIONS.md)
- Roadmap — what is shipped, in progress, planned: [docs/ROADMAP.md](docs/ROADMAP.md)
- Decisions (ADRs): [docs/decisions/_index.md](docs/decisions/_index.md)
- Observed bank wire contracts: [docs/bank-contract/](docs/bank-contract/README.md)
- Procedures as Agent Skills (`/name`, `$name` in Codex):
  [.agents/skills/](.agents/skills/), linked from `.claude/skills`
- How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md)

## Build & Run

`pnpm install` · `pnpm build` (`tsc -b`) · `pnpm typecheck` (+ tests) · `pnpm test`
(vitest) · `pnpm lint` · `pnpm format` / `pnpm format:check`. Binaries:
`node packages/cli/dist/main.js` (`cta`, e.g. `saldo --banco bci [--human]`),
`node packages/mcp/dist/main.js` (`cta-mcp`, stdio). Runs write to `~/.cta/`; set
`HOME` to a temp dir to try them.

## Critical Rules

- **Own account only; never evade a bank control.** No CAPTCHA solving, no
  device-fingerprint spoofing, no bot-detection evasion, no IP rotation, no
  retry after a block or a failed login. If the bank blocks automation, stop and
  surface its message verbatim. (ADR-004)
- **Credentials never reach the LLM and never land on disk.** The user types the
  RUT/clave and any second factor into the bank's real page (headed browser);
  only session cookies persist. No MCP tool accepts a password. (ADR-006)
- **Read-only until an ADR says otherwise.** No transfer, payment or any
  money-moving call exists in v1. (ADR-008)
- **Surfaces call `cta-core` tasks only**, never a bank driver directly — that
  bypasses throttling, audit and credential rails. (ADR-003)
- **Every bank selector/endpoint is first-hand observed and cited**
  (`// observed at <URL> on <YYYY-MM-DD>`) and documented under
  `docs/bank-contract/`. No third-party bank-scraping libraries. (ADR-004)
- **The bank is always explicit:** `--banco` on every bank-scoped command, `banco`
  on every bank-scoped MCP tool; no pointer, no default. (ADR-005, ADR-011)
- **Account data is PII.** Account numbers, balances, movements, counterparties
  never reach the audit log or a tracked file; tests use synthetic data only.
- **This repo is PUBLIC. Scan before it leaves the machine:** run the
  `sensitive-data-check` skill (or `bash scripts/pii-scan.sh`) before every
  commit, push and PR; hooks once: `git config core.hooksPath .githooks`. (ADR-009)
- **No AI attribution anywhere** — commits, PRs, issues, branches, code, docs.

## Standing rules

- Session start: read docs/CURRENT_STATUS.md and docs/decisions/_index.md first
  (~1k tokens). Never scan source code just to orient yourself.
- Work in one tracker issue at a time, sized to one session, with the sections
  Context / Target / ADRs to load / Acceptance criteria / Estimated sessions. If
  it needs more than one session, split it before starting. The issue body is
  the spec.
- Before writing code: read docs/CONVENTIONS.md.
- Before modifying an existing file: read it. Never edit unread code.
- When a significant decision surfaces (new dependency, new pattern, new
  strategy): STOP. Write docs/decisions/YYYY-MM-DD-<slug>.md FIRST (the slug is
  its ID; never a sequence number) — including the alternatives you rejected and
  why — update _index.md, then implement.
- When the user corrects a pattern: fix the code AND append the rule to
  docs/CONVENTIONS.md in the same change. A correction that is not documented
  will be repeated.
- Review before close when the user reviews alone: check the diff against the
  issue's acceptance criteria, docs/CONVENTIONS.md and the ADRs it lists, and
  fix the findings in this session. When a teammate reviews the PR, close first;
  their findings open the next session.
- Session close, before the session's final commit: update
  docs/CURRENT_STATUS.md (move finished items to Recently Completed, re-rank
  Next Priorities, refresh the date) and ship tracked docs/ changes in the SAME
  commit/PR as the code.
- Keep sessions short: when you drift from these rules or the context fills with
  tool output, close and restart at the next acceptance criterion. State lives
  in docs/, so nothing is lost.
- Precedence: code is the truth about WHAT the system does; ADRs are the truth
  about WHY. If a doc contradicts the code, stop and flag it — do not silently
  trust the doc, and do not "fix" correct code to match a stale doc.
- All of these context files are written in English.
- Teams of 2+ developers, or parallel agents in git worktrees: add
  docs/CURRENT_STATUS.md to .gitignore. It is per-session memory; shared
  in-flight state lives in the issue tracker.
- Parallel agents in worktrees: one issue per worktree, no two issues touching
  the same paths. A new ADR lands on main as its own PR before work continues;
  the other worktrees rebase onto it.
