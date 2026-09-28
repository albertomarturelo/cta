# ADR-001: Adopt Context-First Development (CFD) for this repo

## Status

Accepted — 2026-09-23. Lineage: `albertomarturelo/sii` ADR-001.
Amended — 2026-09-24: aligned with the current CFD bootstrap (standing rules).

## Context

`cta` repeats a pattern the author already runs in `albertomarturelo/sii`: one
core, a CLI and an MCP server over a portal with no public API for the end user.
That repo stayed coherent across 26 ADRs and absorbed an outside contributor
because decisions were written before code and CI enforced the context layer.
The same discipline is wanted here from the first commit, not retrofitted. The
sii experience also showed a gap: an outside contributor's agent (not Claude
Code) never found the rules, because the repo only exposed `CLAUDE.md`.

## Decision

- **Context layer:** `CLAUDE.md` is an INDEX of plain markdown links to
  `docs/*.md` (≤100 lines). Plain links, not `@imports`, so every agent
  reads it the same way and nothing loads eagerly.
- **`AGENTS.md` ships from day one as a symlink to `CLAUDE.md`**, and CI fails if
  it is missing or diverges. Any agent lands on the same index.
- **ADRs** under `docs/decisions/`, following `TEMPLATE.md`, ≤100 lines, listed
  in `_index.md`, written BEFORE the implementation they govern.
- **Work units:** GitHub Issues with the fixed 6-section body (Context, Target,
  ADRs to load, Acceptance criteria, Reproduction, Estimated sessions).
- **Procedures** in `.claude/commands/` as plain markdown any agent or human can
  follow: `session-start`, `session-close`, `new-decision`, `issue-new`,
  `issue-start`, `review-pr`, `validate-context`.
- **Corrections become conventions:** the first time the user corrects a
  pattern, the fix AND the rule in `CONVENTIONS.md` ship in the same change.
- **Standing rules:** `CLAUDE.md` carries the CFD "Standing rules" section
  VERBATIM from the methodology, so every session and every agent inherits the
  workflow. Repo-specific rules live beside it under "Critical Rules".
- **CI enforces context integrity:** ADR index integrity, ADR completeness, the
  `AGENTS.md` link, and a PII guard run on every PR.
- `docs/ROADMAP.md` is the versioned "are we there yet?"; `CURRENT_STATUS.md`
  (In Progress / Recently Completed / Known Issues / Next Priorities) is a local,
  gitignored working note, read first at session start and refreshed at session
  close (lineage: sii #79). It stays untracked even while there is a single
  maintainer: the repo is public and expects outside contributors, so shared
  in-flight state lives in GitHub Issues.

## Alternatives Considered

1. **Code first, document later.** Rejected — the sii repo's coherence came from
   decisions-before-code; a bank project carries more legal and safety weight,
   not less.
2. **Re-run the CFD bootstrap from scratch (2026-09-24 update).** Rejected — it
   would replace deliberate docs with inferred ones and renumber ADR-001 to
   `initial-architecture`, breaking every citation. The update was applied as a
   reconciliation instead.
3. **Track `CURRENT_STATUS.md`.** Rejected — per-developer session memory
   collides between contributors; the issue tracker is the shared state.
4. **`CLAUDE.md` only, `AGENTS.md` optional.** Rejected — an opt-in cannot help a
   contributor whose agent the maintainer cannot predict (the sii #88 → #90 case,
   and albertomarturelo/context-first-development#6).

## Consequences

- Easier: any session orients in ~1k tokens; decisions keep their rationale;
  reviews check the diff against the context.
- Obligation: write the ADR before the code; keep `ROADMAP.md` honest; ship
  tracked `docs/` changes in the same commit/PR as the code; refresh the local
  `CURRENT_STATUS.md` before the session's final commit.
- Precedence: code is the truth about WHAT, ADRs about WHY; a doc that
  contradicts the code is flagged, never silently trusted or "fixed" into code.
- Methodology: <https://github.com/albertomarturelo/context-first-development>.
