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

**Known limit in 0.1.0-rc.2:** BCI keeps its read session in the memory of the
process that logged in, and each CLI command is a new process, so CLI reads answer
`NotAuthenticated`. The MCP server (`@albertomarturelo/cta-mcp`) works end to
end. The shared session lands in the next release. See the
[roadmap](https://github.com/albertomarturelo/cta/blob/main/docs/ROADMAP.md).
