<!-- Procedure: /session:start — run at the BEGINNING of every working session.
     Plain markdown: any agent or human can follow it. Token budget: ~500–1,500. -->

Read the following, in order, then produce a brief summary:

1. `docs/CURRENT_STATUS.md` — this developer's session memory (In Progress,
   Recently Completed, Known Issues, Next Priorities). Local and gitignored; if
   absent, create it from the four headings and say so.
2. `docs/decisions/_index.md` — recent decisions that may affect current work.
3. `docs/ROADMAP.md` — what is shipped (✅), in progress (🚧), blocked (🔒),
   planned (📋), and which spike is pending (💭).
4. `git log --oneline -10` and the open work items of the private Project
   (ADR-016): `gh project item-list 3 --owner albertomarturelo --format json
   --limit 500 --jq '.items[] | select(.status != "Done") | [.iD, .status, .title] | @tsv'`
   — what actually moved last, and what is open. (If the GitHub repo does not
   exist yet, say so and skip the issue list.)

Then state:

- What was being worked on at the last session close.
- What is blocked and why.
- What should be the focus of THIS session.

Do **NOT** read source code yet. Orient in O(1k) tokens, not O(50k).
`CURRENT_STATUS.md` is per-developer and may be stale — if it disagrees with
commits or open issues, trust those and say so.
