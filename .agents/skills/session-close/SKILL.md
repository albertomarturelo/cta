---
name: session-close
description: "Close a cta session: update docs/CURRENT_STATUS.md and ROADMAP, capture corrections in CONVENTIONS and observations in the bank contract, propose ADRs for informal decisions, move the Project item, and ship docs in the same commit/PR as the code. Invoke explicitly before ending every working session."
disable-model-invocation: true
metadata:
  token-budget: "~500–1,000"
---

**Review first when you review alone.** If the work's acceptance criteria are
done and the maintainer is the reviewer, run `/review-pr` BEFORE this skill: with
no PR yet it reviews the local branch diff. Fix its findings now, while the
context is loaded; this close then records the reviewed state, commits, and the
PR opens afterwards. A PR an outside contributor or teammate reviews: close
first; their findings open the next session. Closing early because the context
filled up: no review, no PR — resume next session.

Do ALL of the following, before the session's final commit:

0. **Update `docs/CURRENT_STATUS.md`** (local, gitignored): move finished items
   to Recently Completed, record Known Issues, re-rank Next Priorities, refresh
   the date.
1. **Update `docs/ROADMAP.md`** if anything changed state (tick ✅ on merge, flip
   🚧/🔒/💭, add rows for newly planned work). Bookkeeping goes in its OWN commit, in the same PR.
2. **If the user corrected a pattern or clarified a convention**, append the rule
   to `docs/CONVENTIONS.md` in the same change as the fix — the first time, not
   the second. Corrections left in chat are repeated.
3. **If a bank was observed this session**, update `docs/bank-contract/<slug>.md`
   with what was seen and the date — synthetic values only, never real data.
4. **If a significant decision was made informally**, propose an ADR via
   `/new-decision` before closing.
5. **Ship tracked `docs/` changes in the SAME commit/PR as the code** — context
   ships with code.
6. **Move the Project item** (`CTA-<n>`) to `In review` when its PR opens and to
   `Done` when it merges — no keyword closes a draft item (ADR-016).

Then output a one-paragraph session summary suitable for a PR description.
