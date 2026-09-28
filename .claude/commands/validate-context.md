<!-- Procedure: /context:validate — run before every push and weekly. Token budget: ~2,000–5,000. -->

Check, in order, and output PASS / WARN / FAIL per item:

1. **`CLAUDE.md` size:** FAIL if >100 lines.
2. **`CLAUDE.md` shape:** an index of plain markdown LINKS to `docs/*.md`, not
   prose. FAIL if a section inlines >10 lines where a link would do. WARN on any
   `@docs/...` import (eager load, and invisible to non-Claude agents).
3. **Standing rules:** `CLAUDE.md` has a `## Standing rules` section copied
   verbatim from the CFD methodology. FAIL if missing or edited.
4. **`AGENTS.md`:** must exist and be a symlink resolving to `CLAUDE.md`
   (`git ls-files -s AGENTS.md` shows mode `120000`). FAIL otherwise.
5. **ADR index integrity:** every `docs/decisions/[0-9]*.md` is listed in
   `_index.md` and every row points to an existing file. FAIL on mismatch.
6. **ADR completeness:** each ADR has Status, Context, Decision, Alternatives
   Considered, Consequences, and is ≤100 lines. FAIL on a miss.
7. **ROADMAP freshness:** WARN if `docs/ROADMAP.md` predates the last feature
   commit on `main`.
8. **Surface boundary (ADR-003):** `packages/cli` and `packages/mcp` import only
   `@albertomarturelo/cta-core` (task layer) and `@albertomarturelo/cta-core/node`.
   Flag any other subpath. (Skip if `packages/` does not exist yet.)
9. **Read-only (ADR-008):** grep drivers for verbs that suggest state changes
   (`transfer`, `pay`, `beneficiar`, `submit`) until a write ADR exists. WARN per hit.
10. **Bank contracts:** every folder under `packages/core/src/banks/` has a
   matching `docs/bank-contract/<slug>.md`. FAIL on a miss.
11. **Sensitive data (ADR-009):** run `bash scripts/pii-scan.sh --all`. FAIL on
    any FAIL; list WARNs for review. Check `git config core.hooksPath` is
    `.githooks`; WARN if not.
12. **Language:** WARN per `docs/**/*.md` file not in English.
13. **Session memory:** `docs/CURRENT_STATUS.md` is gitignored and NOT tracked
    (`git ls-files docs/CURRENT_STATUS.md` is empty). FAIL if tracked.

Propose concrete fixes. Do NOT auto-apply — the user reviews first.
