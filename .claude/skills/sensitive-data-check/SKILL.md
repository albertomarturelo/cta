---
name: sensitive-data-check
description: Check that no sensitive data (RUTs, emails, credentials, cookies, tokens, account numbers, balances, movements) is about to leak into this PUBLIC repo through a commit, a commit message, a push or a pull request. Use before committing, before pushing, before opening or updating a PR, when reviewing a PR, and whenever the user asks "did anything sensitive slip in?". Implements ADR-009.
---

# Sensitive-data check (ADR-009)

This repository is public. Anything committed, pushed, or written in a PR or
issue is permanent in practice: forks, clones and caches keep it even after a
rewrite. This procedure runs the deterministic scanner and then adds the
judgement a regex cannot.

Decision record: [ADR-009](../../../docs/decisions/009-sensitive-data-gate.md).
Scanner: [`scripts/pii-scan.sh`](../../../scripts/pii-scan.sh).

## 1. Pick the scope

| Moment | Command |
| --- | --- |
| Before a commit | `bash scripts/pii-scan.sh --staged` |
| A commit message | `bash scripts/pii-scan.sh --msg .git/COMMIT_EDITMSG` |
| Before a push | `bash scripts/pii-scan.sh --range origin/main..HEAD` |
| A pull request (diff, title, body, comments) | `bash scripts/pii-scan.sh --pr <n>` |
| Full audit of the tree | `bash scripts/pii-scan.sh --all` |

If unsure, run `--range origin/main..HEAD` and, when a PR exists, `--pr <n>`.

## 2. Read the scanner output

Findings are printed **masked**. Never unmask them, and never copy a value into
the chat, an issue, a PR, a commit or a doc — not even to discuss it.

- **FAIL** — a valid non-synthetic RUT, an email outside the allowlist, a JWT, a
  cookie header, a credential assignment, a private key, or a forbidden file
  (`.cta/`, `.env`, `*.har`, `*.pfx`, `*.p12`). Blocks.
- **WARN** — something that looks like a CLP amount or an account number. Open
  the file at the reported line and decide: synthetic example (fine) or real
  data (treat as FAIL).

## 3. Review what the scanner cannot see

Read the added lines of the diff (and the PR text) for:

- Names of real people, companies or counterparties in fixtures, comments or
  movement descriptions.
- Real-looking movement rows, balances or account formats copied from the bank.
- Bank screenshots or images (any added `.png`/`.jpg`) — check them visually.
- Pasted probe output, stack traces or Playwright errors (they carry cookies).
- Paths or usernames from the author's machine (`/Users/<name>/…`).
- **Personal facts about the author or contributors:** which bank someone uses,
  that someone "holds an account" somewhere, their employer, their location.
  Rationale in ADRs, docs and commits stays about the project, never about a
  person's finances.
- Anything under a fixture folder that was not written by hand as synthetic.

## 4. If something is found

- **Not committed yet:** remove it, restage, rerun `--staged`.
- **Committed, not pushed:** `git commit --amend` or an interactive rebase to
  drop it from every commit, then rerun `--range`.
- **Already pushed or in a PR on this public repo:** treat it as leaked. Tell
  the user plainly. If it is a session cookie or token, the user logs out of that
  bank now (`cta logout <banco>`) so the session dies. Rewriting history is
  still worth doing, but it does not undo the exposure. Edit or delete the PR
  text or comment that carried it.
- **A synthetic value that keeps tripping the scanner:** add it to
  `.pii-allowlist` — only if it is provably synthetic. That file is public.

## 5. Report

End with one line: `sensitive-data-check: CLEAN` or
`sensitive-data-check: <n> issue(s) — <scope>`, without printing any value.
