# @albertomarturelo/cta-mcp

`cta-mcp`: a stdio [MCP](https://modelcontextprotocol.io) server that lets an AI
agent (Claude Desktop, Claude Code, any MCP client) read your **own** Chilean bank
accounts — balances and movements. A thin surface over
[`@albertomarturelo/cta-core`](https://www.npmjs.com/package/@albertomarturelo/cta-core).

> ⚠️ **0.x and unofficial.** Not affiliated with, sponsored or endorsed by
> any bank. Automating access to your own account may breach your bank's terms,
> and **the bank may block your access or your device**. Provided "as is", without
> warranty (MIT). Read-only: it never moves money.

No tool accepts a password: login happens in a browser window where you type your
credentials yourself. The `login` tool returns as soon as the window opens.

## Install

```bash
npm i -g @albertomarturelo/cta-mcp
npx playwright install chromium
cta-mcp --version
```

Requires **Node ≥ 20**. Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cta": { "command": "cta-mcp" }
  }
}
```

## Tools

`bancos`, `login`, `logout`, `cuentas`, `saldo`, `movimientos`, `tarjetas`. Every bank-scoped
tool takes a required `banco`, e.g. `"bci"`.

## BCI flow

1. `login` with `banco: "bci"` opens the bank's page. Log in there.
2. Once you reach your bank home, the window opens "últimos movimientos" and
   the credit cards' "mis movimientos" by itself, takes the read session and
   closes. The server holds that session in
   memory, never on disk, for about an hour.
3. `bancos` shows `sesionHasta`. Until then, `cuentas`, `saldo`, `movimientos`
   and `tarjetas` read over HTTP, with no browser. After it, log in again.

If the bank blocks a read, the tool returns the bank's message and nothing is
retried. See the [roadmap](https://github.com/albertomarturelo/cta/blob/main/docs/ROADMAP.md).
