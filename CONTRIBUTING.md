# Contributing

Thanks for your interest. `cta` is a personal open-source project (MIT). Read the
context layer first — it is how the project stays coherent and safe.

## Read first

- [`CLAUDE.md`](CLAUDE.md) (also [`AGENTS.md`](AGENTS.md), the same file) — the
  critical rules. **Using an agent other than Claude Code? It reads `AGENTS.md`;
  point it there before it writes code.**
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — the source of truth for style,
  bank-driver rules, security and PII.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what exists, what is planned, and where
  new work goes.
- [`docs/decisions/`](docs/decisions/_index.md) — the ADRs. Decisions are written
  *before* code (Context-First Development, ADR-001).

> **Issue references.** `GH-<n>` (and the `#<n>` in the same texts) in ADRs,
> docs and code comments written before this repository went public point to
> the project's pre-publication tracker, which is not public. This repository's
> own issues and pull requests start again at #1.

## Adding a bank

The most valuable contribution. It requires **an account you hold at that bank**:
every driver is built from first-hand observation (ADR-004), and nobody can
observe an account that is not theirs.

1. Open a feature request naming the bank.
2. Run the spike on your own account and write `docs/bank-contract/<slug>.md`
   from [the template](docs/bank-contract/README.md) — **synthetic values only**.
3. If the bank cannot be read without evading a control, stop there and say so
   in the contract. That is a valid outcome.
4. Build the driver under `packages/core/src/banks/<slug>/`, one registry line,
   tests with synthetic fixtures.

## Before your first commit

This repo is public. Enable the sensitive-data hooks once per clone:

```bash
git config core.hooksPath .githooks
```

They block a commit, a commit message or a push that carries a real RUT, an
email, a credential, a cookie or a forbidden file. Before opening a PR, run
`bash scripts/pii-scan.sh --range origin/main..HEAD`, or ask your agent to run
the [`sensitive-data-check`](.claude/skills/sensitive-data-check/SKILL.md) skill
(ADR-009). CI runs the same scanner on your PR's commits, title and body.

## The CFD procedures

`.claude/commands/` holds plain markdown procedures. **You do not need Claude
Code** — follow them by hand or with any agent:

1. `session-start.md` — orient in ~1k tokens.
2. `issue-new.md` — every work unit is an issue with the fixed 6-section body,
   opened before code.
3. `issue-start.md` — load the issue and its ADRs, create the branch.
4. `new-decision.md` — before any decision without an ADR (a dependency, a
   boundary, a new verb, **anything that would change bank state**).
5. `validate-context.md` — before every push.
6. `review-pr.md` — self-review against the context before opening the PR; the
   maintainer runs the same procedure.
7. `session-close.md` — update ROADMAP, CONVENTIONS and the contract doc.

## Workflow rules

- Branch `<type>/GH-<n>-<slug>`, opened under its final name.
- `Closes #<n>` in the PR body. One work unit per PR.
- Conventional Commits, subject ≤72 chars, English everywhere — except the
  README and what `cta` shows the user (help, `--human` output, error messages),
  which are Spanish (CONVENTIONS).
- **No AI attribution** in any commit, PR, issue, branch, comment or doc.
- If a PR says something was live-validated, say which paths ran against a real
  bank, which bank, on what date, and which are covered by fakes only.

## Live probes against your bank

- Probes are throwaway scripts **outside the repo**.
- Catch every error and print only a redacted message. Playwright errors carry
  request headers with live session cookies.
- Never paste raw probe output into an issue, a PR, a commit or a contract doc.
- Redact at the source and scan the output with `scripts/pii-scan.pl` before
  reading it; investigate a scanner hit by its JSON path only, never by printing
  the line (CONVENTIONS, Security & PII).
- Never automate the login form, never retry a failed login, and stop at the
  first block or challenge (ADR-004).

## Releasing (maintainer)

Releases follow ADR-010. Only CI publishes, through npm trusted publishing — there
is no npm token anywhere.

1. Bump `version` in all three `packages/*/package.json` to the same value.
2. Add `## <version> — <YYYY-MM-DD> — <headline>` to `CHANGELOG.md`, moving the
   `Unreleased` items under it. It becomes the GitHub release notes verbatim.
3. Merge the PR, then tag the merge commit and push the tag:
   `git tag v<version> && git push origin v<version>`.
4. `publish.yml` verifies the tag against all three versions, runs typecheck,
   lint, format and tests, packs (`scripts/pack.sh`), publishes with provenance,
   then creates the GitHub release.

**One-time setup per package** on npmjs.com → package → Settings → Trusted
publishing: GitHub Actions, owner `albertomarturelo`, repository `cta`, workflow
`publish.yml`. If npm requires the package to exist first, publish its first
version once from your machine with 2FA, from a clean build so no stale output
ships (`rm -rf packages/*/dist packages/*/tsconfig.tsbuildinfo && pnpm build &&
bash scripts/pack.sh /tmp/cta-pack`, then `npm publish <tarball> --access public`),
then configure the trusted publisher. After that, never publish by hand.

## Security

See [`SECURITY.md`](SECURITY.md). Report vulnerabilities privately.
