# Security Policy

`cta` handles bank sessions and personal financial data. Security and privacy
are the design, not an add-on — see [ADR-004](docs/decisions/004-own-account-posture-no-evasion.md),
[ADR-006](docs/decisions/006-auth-browser-cookies-only.md) and
[`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) § "Security, secrets & PII".

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private vulnerability reporting
(Security tab → "Report a vulnerability") or email **amarturelo@gmail.com** with
a description, impact, reproduction steps and the affected version. This is a
personal open-source project: responses are best-effort, not bound by an SLA.

## Scope

In scope: `cta-core`, `cta-cli` and `cta-mcp` — especially session storage,
anything that could expose a credential or a second factor, PII reaching a log
or the LLM, and any path that could change bank state (v1 must have none,
ADR-008).

Out of scope: the banks' own systems. **Do not test against a bank in a way that
could lock an account, trigger fraud controls or breach its terms.**

## Rules for contributors

- Never commit credentials, cookies, `.env` or anything under `.cta/`.
- Never commit real account numbers, balances, movements, names or RUTs —
  fixtures are synthetic.
- Credentials and second factors never reach `cta`, disk or an LLM: the user
  types them into the bank's real page.
- If you find real data or a secret in the tree or its history, report it
  privately.
