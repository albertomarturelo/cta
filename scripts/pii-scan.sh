#!/usr/bin/env bash
# Sensitive-data gate (ADR-009). Scans only what is about to become public.
#   pii-scan.sh --staged            staged changes (pre-commit)
#   pii-scan.sh --msg <file>        a commit message file (commit-msg hook)
#   pii-scan.sh --range A..B        diffs AND messages of a commit range (pre-push, CI)
#   pii-scan.sh --pr <n>            a PR's diff, title, body and comments (needs gh)
#   pii-scan.sh --all               every tracked file (audit)
# Findings are printed MASKED. Exit 1 on any FAIL.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
SCAN="perl scripts/pii-scan.pl"
rc=0
run() { "$@" || rc=1; }

case "${1:-}" in
  --staged) run bash -c "git diff --cached -U0 --no-color | $SCAN --label=staged" ;;
  --msg)    run bash -c "grep -v '^#' '$2' | $SCAN --plain --label=commit-message" ;;
  --range)
    run bash -c "git diff -U0 --no-color '$2' | $SCAN --label=diff"
    run bash -c "git log --format='%B' '$2' | $SCAN --plain --label=commit-messages" ;;
  --pr)
    run bash -c "gh pr diff '$2' | $SCAN --label=pr-diff"
    run bash -c "gh pr view '$2' --json title,body,comments --jq '.title, .body, (.comments[].body)' | $SCAN --plain --label=pr-text" ;;
  --all)
    # One --no-index diff per file (it takes exactly two paths); symlinks skipped.
    run bash -c "git ls-files | while IFS= read -r f; do [ -L \"\$f\" ] || git diff --no-index -U0 --no-color /dev/null \"\$f\" || true; done | $SCAN --label=tree" ;;
  *) sed -n '2,9p' "$0"; exit 2 ;;
esac
exit $rc
