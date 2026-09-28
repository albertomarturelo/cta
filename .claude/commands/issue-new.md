<!-- Procedure: /issue:new — create a self-sufficient work unit on GitHub.
     Token budget: ~1,500–3,000. Be thorough HERE so the next session is cheap. -->

Guide the user through a new issue on `albertomarturelo/cta` with the fixed
6-section body. Ask in order, confirming each answer:

1. **Type:** `feature` | `fix` | `chore` | `docs` | `spike`.
2. **Title:** imperative, ≤80 chars, English.
3. **Context:** 2–4 sentences — trigger and user-visible outcome.
4. **Target:** concrete paths (mark `new file` when net-new).
5. **Pattern to mirror:** an existing module (in this repo, or in
   `albertomarturelo/sii` when nothing here fits yet — name the file).
6. **ADRs to load:** at minimum ADR-003 for anything crossing the core boundary,
   ADR-004 for any bank-facing code, ADR-005 for bank selection, ADR-006 for
   auth, ADR-007 for output shapes, ADR-008 for anything near a write.
   **If a needed decision has no ADR, STOP and run `/decision:new` first.**
7. **Acceptance criteria:** `[ ]` items covering behavior, tests (synthetic
   fixtures, no real bank) and documentation (which docs or contract file).
8. **Reproduction:** fixes only.
9. **Estimated sessions:** `1` | `2–3` | `4+` — if >1, split first.
10. **Labels:** type + scope (`core`, `cli`, `mcp`, `auth`, `driver`, `bci`, `docs`, `tests`).

Body (do not rename or reorder — `/issue:start` parses by header):

```markdown
## Context
## Target
- Files / dirs:
- Pattern to mirror:
## ADRs to load
## Acceptance criteria
## Reproduction (fixes only)
## Estimated sessions
```

```bash
gh issue create --repo albertomarturelo/cta --title "<title>" --body "<body>" --label "<type>,<scopes>"
```

English only. Output the issue URL.
