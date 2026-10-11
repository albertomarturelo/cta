---
name: new-decision
description: "Guide the user through a new ADR (≤100 lines, date-slug file name) with real alternatives, then update the decisions index. Use when a significant decision surfaces without an ADR: a new dependency, pattern, boundary, verb, or anything that would change bank state."
metadata:
  token-budget: "~1,000–2,500"
---

1. Ask: **"What decision needs to be made?"**
2. Articulate the **Context**: problem, constraints, why decide now.
3. Propose **2–3 alternatives** with pros and cons. Do not short-circuit to a
   favourite — the user chooses.
4. Write `docs/decisions/YYYY-MM-DD-<slug>.md` (today's date) following
   `TEMPLATE.md` exactly. The slug is the ADR's ID: short, specific,
   kebab-case. First check that no file in `docs/decisions/` already ends in
   `-<slug>.md`; if one does, pick another slug or ask whether this supersedes
   it. Never compute a sequence number — parallel branches collide. Numbered
   ADRs (`NNN-*.md`) keep their numbers; never rename them (ADR
   `adr-ids-date-slug`).
5. Add one row to `docs/decisions/_index.md`, the slug in the ID column (in
   backticks), at the end of the table.

Constraints:

- ≤100 lines. Never skip "Alternatives Considered".
- Cite ADRs as `ADR-0NN` (numbered) or `ADR <slug>` (date-slug).
- A rule ported from `albertomarturelo/sii` cites its source ("lineage: sii
  ADR-017") instead of re-deriving it.
- A decision that changes a recurring convention also updates `CONVENTIONS.md`.
- **Any write surface (state change at a bank) must satisfy ADR-008's five
  conditions**, stated explicitly in its Decision section.
- Status starts `Accepted` unless the user asks for `Proposed`.

Stop once the ADR is written. The user reviews it before implementation starts.
