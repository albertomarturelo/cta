---
name: issue-start
description: "Pick up a Project item CTA-<n> as this session's focus: read it, load its ADRs and one pattern file, create the branch, and state the objective and acceptance checklist. Invoke explicitly with the item ID."
argument-hint: "CTA-<n>"
disable-model-invocation: true
metadata:
  token-budget: "~2,000–4,000"
---

1. `gh project item-list 3 --owner albertomarturelo --format json --limit 500
   --jq '.items[] | select(.iD == "CTA-<n>") | {title, status, body: .content.body}'`.
2. Parse the 6 sections. If a required one is missing, **STOP** and propose
   fixing the issue — do not infer.
3. Read every ADR under "ADRs to load". They are the constraints.
4. Read the "Pattern to mirror" file once, for shape.
5. Do NOT read the Target files yet — they are where work goes, not context.
6. `git switch -c <type>/CTA-<n>-<slug>` (final name; renaming later closes the
   PR), and set the item's `Status` to `In progress`.
7. Summarize: objective (one line), the acceptance checklist verbatim, ADRs
   loaded and what each constrains, target paths, pattern, branch.
8. Ask: **"Ready to start?"** If estimated sessions > 1, propose splitting first.
