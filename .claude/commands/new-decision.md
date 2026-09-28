<!-- Procedure: /decision:new — run when a significant decision has no ADR yet.
     Token budget: ~1,000–2,500. -->

1. Ask: **"What decision needs to be made?"**
2. Articulate the **Context**: problem, constraints, why decide now.
3. Propose **2–3 alternatives** with pros and cons. Do not short-circuit to a
   favourite — the user chooses.
4. Write `docs/decisions/<NNN>-<slug>.md` following `TEMPLATE.md` exactly, with
   `<NNN>` one above the highest existing.
5. Add one row to `docs/decisions/_index.md`.

Constraints:

- ≤100 lines. Never skip "Alternatives Considered".
- A rule ported from `albertomarturelo/sii` cites its source ("lineage: sii
  ADR-017") instead of re-deriving it.
- A decision that changes a recurring convention also updates `CONVENTIONS.md`.
- **Any write surface (state change at a bank) must satisfy ADR-008's five
  conditions**, stated explicitly in its Decision section.
- Status starts `Accepted` unless the user asks for `Proposed`.

Stop once the ADR is written. The user reviews it before implementation starts.
