# ADR-009: Sensitive-data gate — scanner, hooks, CI and an agent skill

## Status

Accepted — 2026-09-23. Extends ADR-004 (PII hygiene) for a public repo.

## Context

`cta` is public from day one, and it is built by observing real bank
portals. The riskiest moment is not runtime but authorship: a RUT in a
fixture, a real balance in a contract doc, a cookie in a pasted Playwright error,
an email in a commit message or a PR body. On a public repo a leak is effectively
permanent — forks and caches keep it after a history rewrite. The sii project
relied on a CI denylist held in a secret, which only catches values someone
already listed and skips on forks.

## Decision

- **One deterministic scanner,** `scripts/pii-scan.pl` behind
  `scripts/pii-scan.sh`, that scans only what is about to become public: staged
  changes, commit messages, a commit range, a PR's diff and text, or the whole
  tree. It prints findings **masked** and exits 1 on any FAIL.
  - **FAIL:** Chilean RUTs with a valid Mod-11 check digit that are not in the
    synthetic allowlist; emails outside the allowlist; JWTs; cookie headers;
    credential assignments; private keys; forbidden files (`.cta/`, `.env`,
    `*.har`, `*.pfx`, `*.p12`).
  - **WARN:** CLP-formatted amounts and account-number-like digit runs — a human
    decides.
  - **Allowlist:** built-in synthetic RUTs (`11111111-1`, `12345670-K`,
    `20000042-0`) and project contacts, plus `.pii-allowlist` for provably
    synthetic values.
- **Three places run it:**
  1. **Git hooks** in `.githooks/` (`pre-commit`, `commit-msg`, `pre-push`),
     enabled once per clone with `git config core.hooksPath .githooks`.
  2. **CI** on every PR and push: the commit range and, on PRs, the PR title and
     body. Unlike a secret denylist, it also runs on forks.
  3. **The agent skill** [`sensitive-data-check`](../../.claude/skills/sensitive-data-check/SKILL.md),
     which runs the scanner and adds the human-judgement pass a regex cannot do
     (names, screenshots, pasted probe output), and says what to do on a leak.
- The secret-held denylist from sii stays as an optional extra CI step.

## Alternatives Considered

1. **CI denylist only (the sii approach).** Rejected as the sole gate — it
   catches only known values, skips on forks, and runs after the push, when the
   data is already public.
2. **A third-party secret scanner (gitleaks, trufflehog).** Rejected for now —
   good at API keys, blind to Chilean RUTs and CLP amounts, and one more tool to
   install. Can be added alongside later.
3. **Skill only, no script.** Rejected — an agent's judgement is not
   deterministic; the script is the floor, the skill is the second pass.

## Consequences

- Easier: a leak is stopped on the author's machine before it exists anywhere
  else; contributors get the same gate in CI.
- Obligation: keep the patterns and the allowlist current; a new kind of bank
  data (a new identifier format) gets a pattern in the same PR that introduces it.
- Risk: false positives on synthetic examples — handled with WARN for fuzzy
  patterns and an explicit, public allowlist.
