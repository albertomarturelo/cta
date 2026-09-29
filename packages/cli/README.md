# @albertomarturelo/cta-cli

The `cta` command: read your **own** Chilean bank accounts — balances and
movements (the *cartola*) — from the terminal, as JSON by default. A thin surface
over [`@albertomarturelo/cta-core`](https://www.npmjs.com/package/@albertomarturelo/cta-core).

> ⚠️ **Pre-alpha and unofficial.** Not affiliated with, sponsored or endorsed by
> any bank. Automating access to your own account may breach your bank's terms,
> and **the bank may block your access or your device**. Provided "as is", without
> warranty (MIT). Read-only: it never moves money.

## Install

```bash
npm i -g @albertomarturelo/cta-cli@next
npx playwright install chromium
cta --version
```

Requires **Node ≥ 20**. You type your credentials, and any second factor, into
the bank's real page; `cta` never sees or stores them.

```bash
cta login bci                     # log in; the window closes by itself
cta bancos --human
cta saldo --banco bci --human
cta movimientos --banco bci --desde 2026-09-01
```

The read session is shared with the MCP server (`@albertomarturelo/cta-mcp`): a
small local `cta` process keeps it in memory, never on disk, and serves both
over a private socket. It starts with the first login and exits once the
session ends (`exp`, `cta logout bci`, or a block). See the
[roadmap](https://github.com/albertomarturelo/cta/blob/main/docs/ROADMAP.md).
