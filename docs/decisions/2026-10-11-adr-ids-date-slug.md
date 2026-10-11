# ADR identity is a date-prefixed slug, not a sequence number

## Status

Accepted — 2026-10-11. Supersedes in part ADR-001 (the `NNN-<slug>.md` naming
of new ADRs). Lineage: CFD catalog `adrs/process/adr-ids-date-slug.md`.

## Context

`/new-decision` named an ADR "one above the highest existing" number. That
counter is computed per branch: two branches that each write a decision both
create the same number, and the clash surfaces at merge, or worse, both merge
and the number becomes ambiguous in every later citation. The methodology this
repo follows (ADR-001) moved to slug identities on 2026-10-10 for that reason.
`cta` has one maintainer today, but a spike branch and a fix branch already run
side by side (CTA-3, CTA-4), and outside contributors are expected (ADR-001).

## Decision

- **New ADRs:** `docs/decisions/YYYY-MM-DD-<slug>.md`, dated the day written.
  The date orders them; no coordination between branches is needed.
- **Identity:** the slug, unique across `docs/decisions/` whatever the date.
  Cite it as `ADR <slug>` in prose, code comments and commits, or as a markdown
  link to the file. Supersession reads `Superseded by <slug>`.
- **Legacy:** ADR-001 … ADR-019 keep their numbers and files forever. Code
  comments, commits, CHANGELOG entries, the private Project and closed PRs cite
  them by number; that history cannot be rewritten.
- **Index:** one table in `_index.md`, ordered by date; numbered rows keep the
  number as ID, new rows carry the slug.
- **CI:** the index check accepts both shapes, and a step fails when two
  date-prefixed ADRs share a slug: two branches decided the same thing in
  parallel, and a human reconciles them.

## Alternatives Considered

1. **Keep sequence numbers.** Rejected: any ad-hoc decision on a branch reopens
   the race; reserving numbers only works while one person plans all work.
2. **Rename ADR-001 … ADR-019 to the new scheme.** Rejected: over 470 `ADR-0NN`
   citations in tracked files, plus commits, the Project and closed PRs, would
   dangle, and
   aliases to fix them would make the rename pointless.
3. **Timestamp as the whole identity.** Rejected: a mistyped number looks as
   valid as a correct one; a mistyped slug breaks a link a check can catch.

## Consequences

- Two ID shapes coexist in the index; the cost is cosmetic.
- A slug must be specific: a vague slug is as useless as a number.
- `git log --diff-filter=R -- docs/decisions/` must show no rename of a
  numbered ADR.
- `/new-decision` checks that no file already ends in `-<slug>.md` before it
  writes one.
