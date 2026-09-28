# ADR-002: TypeScript + Node + pnpm-workspaces monorepo toolchain

## Status

Accepted — 2026-09-23. Ports, as one decision, sii ADR-002 (toolchain), ADR-008
(runtime libraries), ADR-009 (NodeNext) and ADR-011 (zod).

## Context

`cta` ships a CLI and an MCP server over one core, like sii. The sii toolchain is
proven, and reusing it lets the author and contributors move between both repos
without relearning anything. Versions are pinned when first installed.

## Decision

- **Packages:** `@albertomarturelo/cta-core`, `@albertomarturelo/cta-cli`
  (binary `cta`), `@albertomarturelo/cta-mcp` (binary `cta-mcp`), under
  `packages/{core,cli,mcp}`, moving in **lockstep**: one version, one tag.
- **TypeScript** `strict` plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, unused-locals/params.
  ESM only. **NodeNext** module resolution: relative imports end in `.js`, so the
  `tsc -b` output runs on Node without a bundler.
- **Node `>=20`**, **pnpm 10.x workspaces** pinned via `packageManager`,
  TypeScript project references (`tsc -b`).
- **Runtime libraries:** `commander` (CLI, cli package only),
  `@modelcontextprotocol/sdk` (stdio MCP, mcp package only), `zod` (MCP input
  schemas + wire-payload validation), `playwright` (default bank driver; an
  OPTIONAL peer of the core, lazy-loaded — lineage sii ADR-016).
- **Dev tooling:** vitest, ESLint flat config + typescript-eslint, Prettier.

## Alternatives Considered

1. **Different stack from sii (Python, Bun).** Rejected — no gain that outweighs
   losing shared conventions, CI, and contributor familiarity.
2. **Single package (core + CLI + MCP together).** Rejected — embedding the core
   in another system (the sii experience: an outside project consumes the core)
   needs the core free of CLI and MCP dependencies.
3. **Nx / Turborepo.** Rejected at three packages; revisit if builds slow down.

## Consequences

- Easier: one `pnpm build` typechecks the whole graph; conventions and CI copy
  over from sii nearly verbatim.
- Obligation: keep project references correct; keep the strict gate at zero;
  record every pinned version in `docs/STACK.md`.
