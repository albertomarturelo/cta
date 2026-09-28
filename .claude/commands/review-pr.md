<!-- Procedure: /review-pr <n> — review a PR against the CONTEXT, not by reading
     whole files. Token budget: ≤6,000. English output. Repo: albertomarturelo/cta. -->

## 1. Fetch

```bash
gh pr view <n> --repo albertomarturelo/cta --json baseRefName,headRefName,title,body,labels,commits,closingIssuesReferences
gh pr diff <n> --repo albertomarturelo/cta
```

## 2. Load context indices only

`CLAUDE.md`, `docs/CONVENTIONS.md`, `docs/decisions/_index.md`, the linked
issue's AC + "ADRs to load", and each of those ADRs. No full source reads.

## 3. Checklist

**Workflow** — branch `<type>/GH-<n>-<slug>`; `Closes #<n>`; Conventional
Commits ≤72; English; **no AI attribution anywhere** (blocks merge).

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

Report only. Do not auto-fix. Name any file you need to read in full, and why,
before reading it.
