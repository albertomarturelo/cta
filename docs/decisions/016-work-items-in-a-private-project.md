# ADR-016: Development work items live in a private GitHub Project

## Status

Accepted — 2026-09-28. Changes the work-unit workflow of ADR-001 (issue →
branch → PR) for this repository; ADR-009 still governs every text.

## Context

The repository went public for the first npm release. Its development work units
(features, fixes, spikes, releases) were public issues, and their texts are
where live-bank context gathers: what a probe saw, how a login went, which
products a bank shows. The pre-publication tracker showed how easily that
context turns into personal facts next to a public name (0.1.0-rc.1 prep). Public
issues are also indexed and mirrored, so an edit or a deletion comes too late.

## Decision

- **Work items are draft items in the private Project "@albertomarturelo's cta"**
  (`https://github.com/users/albertomarturelo/projects/3`, visible to its
  collaborators only). They keep the fixed six-section body of `/issue:new`.
- **Each item has a stable ID** in the Project's `ID` text field: `CTA-<n>`,
  the next free number. It replaces the issue number everywhere the workflow
  used one:
  - branch `<type>/CTA-<n>-<slug>`;
  - `Refs CTA-<n>` in commits and in the PR's "Linked work item" section
    (a draft cannot be closed by a keyword; the item's `Status` moves to
    `Done` by hand when the PR merges).
- **Public texts carry no private context.** A PR title and body say what
  changes and why in terms of the code, the ADRs and the contract; anything
  that only makes sense with the item's notes stays in the item.
- **Public issues remain for outside reports only:** the Bug report and Feature
  request templates. Security reports go to private advisories. The maintainer
  work-unit issue template is removed.
- **A private tracker is not a vault.** ADR-009 applies to item texts as it does
  to the repository: no credentials, no account data, no real probe output.
  Privacy here is a second layer, not the first.
- **Procedures follow:** `/issue:new` creates a draft item with
  `gh project item-create` and sets `ID`, `Status` and `Priority`;
  `/issue:start` reads it with `gh project item-list`; `/session:start` lists
  the Project's open items instead of `gh issue list`.

## Alternatives Considered

1. **Public issues with stricter wording.** Rejected: the leak surface is the
   habit of writing context down, and one slip is permanent once indexed.
2. **Issues in the private archive repository, closed cross-repo from public
   PRs.** Rejected: every public PR would carry a link to a private repository,
   and the archive is meant to stay frozen.
3. **Work items as local markdown files.** Rejected: no board, no status, no
   access from other machines. `docs/CURRENT_STATUS.md` already covers
   per-session memory.
4. **Keep the issue number with a private shadow issue.** Rejected: two
   trackers for one unit of work drift apart.

## Consequences

- PRs no longer auto-close their work item. `/session:close` and the merge step
  set the item to `Done`.
- `GH-<n>` references in older texts point to the pre-publication tracker;
  public `#<n>` up to #7 are this repository's first issues and PRs; `CTA-<n>`
  are Project items (CONTRIBUTING, "Issue references").
- Outside contributors see the ROADMAP and the ADRs, not the item notes. A
  contributor who takes on work gets it through a public issue or PR discussion.
- `gh` needs the `project` scope for the procedures.
