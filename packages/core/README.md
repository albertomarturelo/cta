# @albertomarturelo/cta-core

Shared core of [`cta`](https://github.com/albertomarturelo/cta): read your **own**
Chilean bank accounts — balances and movements (the *cartola*) — locally, with
credentials typed only into the bank's real login page. Holds the domain, the
tasks and one driver per bank; the CLI and the MCP server are thin surfaces over it.

> ⚠️ **Pre-alpha and unofficial.** Not affiliated with, sponsored or endorsed by
> any bank. Automating access to your own account may breach your bank's terms,
> and **the bank may block your access or your device**. Provided "as is", without
> warranty (MIT). Read-only: it never moves money.

## Entry points

- `@albertomarturelo/cta-core` — the pure, embeddable API (no Node built-ins at
  import time).
- `@albertomarturelo/cta-core/node` — Node adapters and the bank drivers (Playwright
  for the login; HTTP-mode reads with the login's grant, ADR-015).

Requires **Node ≥ 20**. Design and decisions:
[docs/decisions](https://github.com/albertomarturelo/cta/blob/main/docs/decisions/_index.md).
