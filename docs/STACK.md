# Tech Stack

Choices per ADR-002. Exact versions below are what `pnpm-lock.yaml` resolves;
every install or upgrade updates this file in the same commit. Runtime libraries
are installed by the first unit that uses them, not before (GH-2).

## Runtime & toolchain

- **TypeScript** `^5.9.3` (installed 5.9.3) — `strict` + `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`. **NodeNext** modules:
  relative imports end in `.js`.
- **Node.js** `>=20` in `engines`; CI runs 20 (the floor) and 24 (current LTS).
  `@types/node` `^20.19.43` (installed 20.19.43), matching the floor.
- **pnpm** `10.33.2` workspaces, pinned via `packageManager` (the single source of
  truth CI reads). `tsc -b` project references.
- macOS `aarch64` dev machine; portable to Linux.

## Infrastructure libraries (general-purpose, NOT bank-specific — ADR-004)

_Each lands with the first unit that uses it._

- **`@modelcontextprotocol/sdk`** `^1.30.1` (installed 1.30.1) — stdio MCP server.
  `cta-mcp` only.
- **`playwright`** `^1.63.0` (installed 1.63.0) — the default driver engine: a normal headed Chromium
  for login, and for reads of `headed` drivers (cookies-only restore in a
  short-lived visible window per command; headless only where a driver's
  contract shows it works — ADR-012). `http` drivers read with Node's built-in
  `fetch` and the grant from the login (ADR-015); no HTTP library is added.
  The grant holder uses only Node built-ins (`node:net` Unix socket,
  `node:child_process` to spawn it detached); no IPC library is added.
  **An optional peer of
  `cta-core`**, lazy-loaded by the `./node` subpath; the CLI and MCP packages
  depend on it directly. No stealth plugins, ever (ADR-004).
- **`commander`** `^14.0.3` (installed 14.0.3) — CLI framework. `cta-cli` only.
  Held at 14.x: 15 requires Node `>=22.12`, above the ADR-002 floor.
- **`zod`** `^4.6.5` (installed 4.6.5) — MCP tool input schemas + wire-payload
  validation. Within the MCP SDK's peer range (`^3.25 || ^4.0`). `cta-mcp` only.

## Dev tooling

- **vitest** `^4.1.11` (installed 4.1.11) — tests never touch a real bank;
  synthetic fixtures only. Held at 4.x: vitest 5 requires Node `>=22.12`,
  above the ADR-002 floor.
- **ESLint** `^9.39.5` (installed 9.39.5) flat config + **typescript-eslint**
  `^8.70.1` (installed 8.70.1).
- **Prettier** `^3.9.9` (installed 3.9.9).

## Explicitly not used

- Any third-party bank-scraping or open-banking client library (ADR-004).
- `puppeteer-extra-plugin-stealth`, fingerprint spoofers, CAPTCHA solvers,
  proxy rotators (ADR-004).
