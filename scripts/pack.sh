#!/usr/bin/env bash
# Packs the three packages into <out-dir> and verifies each tarball (ADR-010):
# dist + README.md + LICENSE + package.json only, no tests, no sources, and no
# `workspace:` protocol left (pnpm pack rewrites it; npm publish would not).
# Prints one tarball path per line on stdout, in publish order (core first).
#
# Usage: scripts/pack.sh <out-dir>     (run after `pnpm build`)
set -euo pipefail

out="${1:?usage: scripts/pack.sh <out-dir>}"
mkdir -p "$out"
out="$(cd "$out" && pwd)"
root="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

for pkg in core cli mcp; do
  dir="$root/packages/$pkg"
  [ -d "$dir/dist" ] || { echo "pack: $dir/dist missing — run pnpm build first" >&2; exit 1; }

  tgz="$(cd "$dir" && pnpm pack --pack-destination "$out" | grep -E '\.tgz$' | tail -1)"
  case "$tgz" in /*) ;; *) tgz="$out/$(basename "$tgz")" ;; esac
  [ -f "$tgz" ] || { echo "pack: no tarball produced for $pkg" >&2; exit 1; }

  entries="$(tar -tzf "$tgz")"
  for required in package/package.json package/README.md package/LICENSE; do
    grep -qxF "$required" <<<"$entries" || { echo "pack: $pkg is missing $required" >&2; fail=1; }
  done
  grep -q '^package/dist/.*\.js$' <<<"$entries" || { echo "pack: $pkg has no dist/*.js" >&2; fail=1; }
  if grep -vE '^package/(dist/.*|package\.json|README\.md|LICENSE)$' <<<"$entries"; then
    echo "pack: $pkg ships unexpected files (listed above)" >&2; fail=1
  fi
  if grep -E '\.test\.' <<<"$entries"; then
    echo "pack: $pkg ships test files (listed above)" >&2; fail=1
  fi
  if tar -xzOf "$tgz" package/package.json | grep -q '"workspace:'; then
    echo "pack: $pkg still has a workspace: dependency" >&2; fail=1
  fi

  echo "$tgz"
done

exit $fail
