<!-- Procedure: /session:close — run BEFORE ending a session. Token budget: ~500–1,000. -->

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
   `/decision:new` before closing.
5. **Ship tracked `docs/` changes in the SAME commit/PR as the code** — context
   ships with code.

Then output a one-paragraph session summary suitable for a PR description.
