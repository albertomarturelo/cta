# CFD procedures ship as Agent Skills, one copy for every agent

## Status

Accepted — 2026-10-11. Supersedes in part ADR-001 (procedures in
`.claude/commands/`). Lineage: CFD catalog
`adrs/ai-workflow/agent-skills-as-procedures.md`.

## Context

ADR-001 kept the procedures as plain markdown in `.claude/commands/` so any
agent or human could follow them. Only Claude Code discovers that folder; every
other agent needs a person to point at the file. Agent Skills (a folder with a
`SKILL.md` carrying `name` + `description` frontmatter) became an open standard
read by Claude Code, Codex, Copilot and Gemini CLI. Codex, Copilot and Gemini
CLI read `.agents/skills/`; Claude Code reads `.claude/skills/`, and treats a
command and a skill the same (`/name`). The repo already ships one skill,
`sensitive-data-check`, under `.claude/skills/`. The methodology moved its
procedures to skills on 2026-10-10, and added a self-review before the session
close for a solo reviewer, which is this repo's case (one maintainer).

## Decision

- **Canonical location:** `.agents/skills/<name>/SKILL.md`, `name` equal to the
  folder. `.claude/skills` is a symlink to `../.agents/skills`. Never a copy;
  no `.claude/commands/` folder.
- **Names drop the colon:** `/session-start`, `/session-close`,
  `/new-decision`, `/issue-new`, `/issue-start`, `/review-pr`,
  `/validate-context`, `/sensitive-data-check` (`$name` in Codex). Bodies keep
  this repo's rules (Project 3, ADR-004, ADR-008, ADR-009 checks).
- **Rituals run only when invoked:** `session-start`, `session-close`,
  `issue-new` and `issue-start` set `disable-model-invocation: true` and ship
  `agents/openai.yaml` with `policy.allow_implicit_invocation: false` (Codex).
  `new-decision`, `review-pr`, `validate-context` and `sensitive-data-check`
  stay model-invocable; their description says when.
- **Token budget** moves to `metadata.token-budget` in the frontmatter.
- **Self-review before close (solo):** when the maintainer is the reviewer,
  `/review-pr` runs on the local branch diff BEFORE `/session-close`, its
  findings are fixed in the same session, and the PR opens after. A PR from an
  outside contributor is reviewed on the PR as before.
- **Standing rules** in `CLAUDE.md` are refreshed verbatim from the methodology
  (one issue per session, review before close, short sessions, worktrees).
- **CI** fails when `.claude/skills` is not the symlink, when
  `.claude/commands/` exists, when a `name` differs from its folder, or when a
  manual-only skill lacks its `agents/openai.yaml`.

## Alternatives Considered

1. **Keep `.claude/commands/`.** Rejected: no command format is shared across
   agents; a Codex or Copilot contributor (the sii #88 case behind ADR-001)
   would again not find the procedures.
2. **Canonical `.claude/skills/`, symlink `.agents/skills`.** Rejected: three
   of four target agents read `.agents/`, and it is the layout `npx skills`
   installs; the neutral path is the one to keep.
3. **Strict spec only (no `disable-model-invocation`).** Rejected: the session
   rituals would fire on the model's judgement and could be skipped or run
   twice; the reference validator's complaint about the field is cosmetic.
4. **Adopt parallel loops in worktrees as well** (catalog
   `parallel-loops-in-worktrees`). Not now: one maintainer, one loop, and the
   open items (CTA-3, CTA-4) are not yet both ready with disjoint targets. The
   slug ADR IDs and the untracked status file already remove its blockers.

## Consequences

- Any agent lists the same procedures; a fix lands in one file.
- Older texts (ADR-016, CHANGELOG, closed PRs) cite `/issue:new`-style names;
  they are history and stay as written.
- Copilot may list a skill twice through the symlink; cosmetic.
- Gemini CLI has no manual-only flag; CI and the git hooks stay the enforcement
  layer.
