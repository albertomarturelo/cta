---
name: review-pr
description: "Review a cta PR, or the local branch diff before /session-close, against the context (CONVENTIONS, ADRs, the Project item's acceptance criteria, the PR template), not by reading whole files. Report findings; do not auto-fix. Use when asked to review a pull request or to self-review work before closing."
argument-hint: "[pr-number]"
metadata:
  token-budget: "≤6,000"
---

The user passes a PR number. Without one, take the current branch's PR
(`gh pr status --json number --jq '.currentBranch.number'`). If the branch has
no PR yet, this is a **self-review before `/session-close`**: review the local
branch (local mode below).

## 1. Fetch

PR mode:

```bash
gh pr view <n> --repo albertomarturelo/cta --json baseRefName,headRefName,title,body,labels,commits,closingIssuesReferences
gh pr diff <n> --repo albertomarturelo/cta
```

Local mode (no PR yet):

```bash
git diff origin/main...HEAD     # committed on the branch
git diff HEAD                   # not yet committed
git log origin/main..HEAD --pretty=format:%s
bash scripts/pii-scan.sh --range origin/main..HEAD
```

Take the item from the `CTA-<n>` in the branch name or in
`docs/CURRENT_STATUS.md` "In Progress". Skip the PR-body and PR-template items;
they apply once the PR exists.

## 2. Load context indices only

`CLAUDE.md`, `docs/CONVENTIONS.md`, `docs/decisions/_index.md`, the linked
work item's AC + "ADRs to load" (Project 3, `/issue-start`), and each of those ADRs. No full source reads.

## 3. Checklist

**Workflow** — branch `<type>/CTA-<n>-<slug>`; `Refs CTA-<n>` in the PR body,
and nothing in the public PR text that needs the private item to make sense
(ADR-016); Conventional
Commits ≤72; English; **no AI attribution anywhere** (blocks merge). A new
ADR is `docs/decisions/YYYY-MM-DD-<slug>.md` with a slug no other ADR uses, and
no numbered ADR is renamed (ADR `adr-ids-date-slug`). Procedures change only
under `.agents/skills/` (ADR `procedures-as-agent-skills`).

**Architecture (ADR-002/003)** — surfaces import only the task layer and
`/node`; the core's main barrel imports no `node:*` or Playwright; bank
hostnames only inside the driver's config; drivers never import each other.

**Posture (ADR-004)** — every selector/URL/payload has an observation citation;
no third-party bank library; **no evasion** (stealth plugins, fingerprint or UA
spoofing, CAPTCHA solving, proxies); no retry after a failed login, second
factor or block; bank messages verbatim; contract doc updated.

**Identity & auth (ADR-005/006)** — bank resolution goes through the single
core function; effective bank visible in output; only login mints; no MCP tool
takes a password, clave or second-factor code; nothing persisted but cookies.

**Output (ADR-007)** — money as integer minor units + currency; ISO dates; JSON
default; STDOUT pure.

**Read-only (ADR-008)** — no method or tool that changes bank state unless a
write ADR is accepted and linked. Any hit blocks the merge.

**Sensitive data (ADR-009)** — run `bash scripts/pii-scan.sh --pr <n>`; any
FAIL blocks; review every WARN and any added image. Never quote a flagged value.

**PII** — no real account numbers, balances, movements, names or RUTs in code,
fixtures, comments, commits or the PR body; synthetic Mod-11 RUTs only; nothing
under `.cta/`.

**TypeScript & tests** — strict, no unjustified `any`; vitest with synthetic
fixtures; no test hits a real bank; new error paths exercised.

**Docs (ADR-001)** — a corrected pattern has its rule in `CONVENTIONS.md` in the
same commit; new decision has its ADR in the same PR; ROADMAP bookkeeping in its
own commit; code that contradicts a doc is flagged, not silently reconciled.

## 4. Report

```text
## Critical (must fix)
## Suggestions
## Nits
## Summary — Verdict: BLOCK | APPROVE WITH SUGGESTIONS | APPROVE · AC <m/n>
```

Report only. Do not auto-fix: in a self-review the author fixes the findings
in the same session, before `/session-close`; in a PR review, in the next one.
Name any file you need to read in full, and why, before reading it.
