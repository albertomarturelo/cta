<!-- Keep these sections — /review-pr parses them. English only. -->

## Summary

<!-- 1–3 sentences: what changes and why. -->

## Linked work item

Refs CTA-<!-- N --> <!-- private Project item (ADR-016); outside contributors: Closes #N of your public issue -->

## Acceptance criteria

<!-- From the work item. Tick as items land. -->

- [ ] <!-- behavior -->
- [ ] <!-- tests -->
- [ ] <!-- documentation -->

## ADRs touched

- ADR-NNN

## Test plan

```bash
pnpm install
pnpm build
pnpm lint
pnpm test       # synthetic fixtures only — no real bank
pnpm format:check
```

## Live validation

<!-- If anything ran against a real bank: which paths, which bank, on what date.
     Which paths are covered by fakes only. NEVER paste real output or data. -->

## Sensitive data (ADR-009)

- [ ] `bash scripts/pii-scan.sh --range origin/main..HEAD` is clean (or every WARN reviewed)
- [ ] No real data in this PR's title, body or screenshots

## Notes for the reviewer
