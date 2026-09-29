<!-- Procedure: /issue:new — create a self-sufficient work unit in the private Project.
     Token budget: ~1,500–3,000. Be thorough HERE so the next session is cheap. -->

Work units are **draft items in the private Project** "@albertomarturelo's cta"
(`https://github.com/users/albertomarturelo/projects/3`), never public issues
(ADR-016). Guide the user through one with the fixed 6-section body. Ask in
order, confirming each answer:

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
10. **Priority** (`P0`–`P2`) and **Size** (`XS`–`XL`), the Project's fields.

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

The title starts with the type, e.g. `fix: <imperative>`. Next ID: the highest
`CTA-<n>` in the Project's `ID` field, plus one.

```bash
P=3; O=albertomarturelo
next=$(gh project item-list $P --owner $O --format json --limit 500 \
  --jq '[.items[].iD // empty | ltrimstr("CTA-") | tonumber] | (max // 0) + 1')
item=$(gh project item-create $P --owner $O --title "<type>: <title>" --body "<body>" \
  --format json --jq .id)
proj=$(gh project view $P --owner $O --format json --jq .id)
fields=$(gh project field-list $P --owner $O --format json)
fid() { jq -r --arg n "$1" '.fields[] | select(.name==$n) | .id' <<<"$fields"; }
oid() { jq -r --arg n "$1" --arg o "$2" '.fields[] | select(.name==$n) | .options[] | select(.name==$o) | .id' <<<"$fields"; }
gh project item-edit --project-id "$proj" --id "$item" --field-id "$(fid ID)" --text "CTA-$next"
gh project item-edit --project-id "$proj" --id "$item" --field-id "$(fid Status)" --single-select-option-id "$(oid Status Backlog)"
gh project item-edit --project-id "$proj" --id "$item" --field-id "$(fid Priority)" --single-select-option-id "$(oid Priority <P>)"
```

English only. The body follows ADR-009 like any text: private is a second
layer, not permission to paste real data. Output `CTA-<n>` and the Project URL.
