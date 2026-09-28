# Conventions

Grows as real work surfaces patterns (corrections become conventions). Starts
with the rules proven in `albertomarturelo/sii`, adapted to banks. **This file is
the source of truth; where another doc summarizes a rule and they disagree, this
one wins.**

## Exit codes

The CLI maps `CtaError.exitCode` (ADR-007 "documented exit code"):

| Code | Error | Meaning |
| --- | --- | --- |
| 0 | — | success |
| 1 | unexpected | a bug or an unclassified failure |
| 2 | `UnknownBank`, `InvalidDateRange` / usage | `--banco` missing or unknown, a bad or reversed `--desde`/`--hasta`, bad arguments |
| 3 | `NotAuthenticated`, `LoginCancelled` | no session, it expired, or the login window was closed / timed out — run `cta login <banco>` |
| 4 | `BankBlocked` | the bank blocked or challenged; message verbatim, never retried |
| 5 | `BankError` | the bank's error page or an unexpected shape; message verbatim |
| 6 | `NotYetSupported` | the bank's driver does not implement that read yet |
| 7 | `BrowserMissing` | Playwright's Chromium is not installed — `npx playwright install chromium` |

## Code style

- TypeScript `strict` everywhere, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. No `any` without an inline justification; prefer
  `unknown` + narrowing at boundaries.
- ESM only, named exports. NodeNext: relative imports end in `.js`.
- ESLint + Prettier are authoritative. Format before commit.
- Comments explain WHY — bank quirks, non-obvious invariants — never WHAT.
- No `console.log` in `cta-core`; output belongs to the surfaces.

## Architecture patterns

- **The core's main barrel imports no `node:*` and no Playwright** — ESLint
  `no-restricted-imports` enforces it outside `node.ts` and `node/**` (ADR-003).
- **Surfaces call core tasks only** (ADR-003). CLI and MCP import the task layer
  and the `./node` composition root, nothing else.
- **The core is the data layer; surfaces present.** JSON by default, `--human`
  for text, STDOUT only for the result (ADR-007).
- **Money is integer minor units + currency code; dates are ISO.** Never floats,
  never formatted strings in a result (ADR-007).
- **The bank is required, never inferred** (ADR-011): `--banco` on every
  bank-scoped CLI command, a required `banco` in every bank-scoped MCP schema.
  ONE core function validates it against the registry; tasks never receive an
  optional bank.
- **A driver declares its `readMode`, justified in its contract.** `headed`
  (ADR-012): reads run in a short-lived, visible browser; requests originate from
  the bank's page; never hide the window, never keep a session alive between
  commands. `http` (ADR-015, BCI): the login captures the read grant from the
  bank's own app; reads go through the `HttpClient` seam with the grant's
  headers only — no cookies, no browser headers made up, no retry, no browser
  fallback.
- **The read grant never leaves memory** (ADR-015): not in the session store,
  the audit sink, logs, errors or any output. Only its `exp` claim is decoded;
  tests build token-shaped strings at run time, never as literals (ADR-009).
- **`cta` never asks for, reads from the environment, or stores the RUT** (ADR-012).
- **Only the login flow mints a session** — `login` (awaited, CLI) or
  `startLogin` (background, MCP), both through one in-flight login per bank
  (ADR-013). Read tasks consume or raise `NotAuthenticated` (ADR-006).
- **A seam only one surface may use is wired in that surface's composition root,**
  never as a runtime default (lineage: sii CONVENTIONS, keyring rule).

## Bank driver rules

- **Every selector, URL and payload constant carries an observation citation:**
  `// observed at <URL> on <YYYY-MM-DD>`. Missing = blocked in review.
- **Each driver has a contract doc** `docs/bank-contract/<slug>.md` recording
  login flow, second factor, session lifetime, read endpoints or pages, formats,
  and what the bank shows on errors — with observation dates.
- **Hostnames live only in the driver's own config module** (`banks/<slug>/config.ts`);
  detection logic is pure (`banks/<slug>/*.ts`, unit-tested); the Playwright glue
  lives in `node/banks/` and loads Playwright lazily.
- **A login only watches until the landing:** the driver opens the bank's page
  and waits for a decisive signal; it never fills, clicks or submits anything
  where the user types credentials or a second factor (ADR-006). After the
  landing, an HTTP-mode driver may follow the bank's own menu, by exact
  accessible names observed in a probe, to reach the app that hands out the read
  grant (ADR-015). Never a guessed link: one hit a bank error page (GH-38). If
  the observed menu is missing, the login fails at once and says so; it never
  leaves the user waiting on a window.
- **Store only the bank's own cookies;** drop third-party cookies at login.
- **Never retry** a login, a second factor, or a request the bank rejected.
  Surface the bank's message verbatim and stop (ADR-004).
- **Success is decided by content, not by HTTP status** — banks answer 200 with
  an error page or a login wall (lineage: sii ADR-022).
- **Normalize at the boundary:** a driver returns core types; the bank's raw
  shape never crosses into tasks.
- **Read-only:** a driver exposes no method that changes bank state (ADR-008).

## Security, secrets & PII

- **Credentials and second factors never reach `cta`, disk or the LLM** (ADR-006).
- **Account data is PII:** account numbers, balances, movements, counterparties,
  names, RUTs. It never lands in a tracked file, an issue, a PR, a commit, a log
  line or the audit sink.
- **Tests use synthetic data only:** synthetic Mod-11-valid RUTs (`11111111-1`,
  `12345670-K`), invented account numbers, invented amounts.
- **Live probes are throwaway scripts outside the repo.** Catch every error and
  print only a redacted message — Playwright errors carry request headers with
  live cookies (lineage: sii CONTRIBUTING). Never paste raw probe output anywhere.
- **Probe output is redacted at the source and scanned before anyone reads it.**
  Parse a body only when its content type DECLARES JSON or form, keep only
  identifier-shaped names, and pass the file through `scripts/pii-scan.pl` first
  (lineage: GH-6, where a binary beacon mis-read as a form leaked fragments).
- **Investigate a scanner hit by its JSON path only** — never print the flagged
  line or its neighbours, not even to locate it.
- Never commit `.env` or anything under `.cta/`.
- **Public repo: scan before anything leaves the machine** (ADR-009). Hooks in
  `.githooks/` (enable with `git config core.hooksPath .githooks`), the
  `sensitive-data-check` skill before a push or PR, and CI on every PR. Findings
  are masked — never paste a flagged value anywhere, not even to discuss it.
- `.pii-allowlist` holds only provably synthetic values. It is public.
- **No personal facts in project artifacts.** ADRs, docs, commits and PRs never
  say which bank a person uses or that someone holds an account somewhere —
  rationale is about the project, never about someone's finances. That includes
  attributions next to a bank's observations ("confirmed by the account holder",
  "the owner's movements"): write what was observed and against what ("confirmed
  against the bank's app"), not who holds the account (GH-43).

## Testing

- Tests never hit a real bank. Drivers are tested against recorded, synthetic
  fixtures; tasks against in-memory fakes of every seam.
- Any live check is gated behind an explicit env var and never runs in CI.
- **Synthetic strings never mimic a sensitive shape** — no `Cookie:` headers, no
  `name@domain`, no JWT-looking tokens, even fake. The scanner blocks them
  (ADR-009); compare structured values instead (`[name, domain]`, not
  `` `${name}@${domain}` ``). Fixed twice in GH-21 and GH-23.
- Test files are typechecked too: `pnpm typecheck` (`tsc -b` + `tsconfig.test.json`)
  runs in CI, because package builds exclude `*.test.ts` and vitest strips types.

## Naming

- Files: kebab-case `.ts`. Tests: `<module>.test.ts`.
- **User-facing text is Spanish:** CLI help, `--human` output and error
  messages (owner decision, GH-21). MCP tool descriptions stay English (the model
  reads them); code, comments, commits and docs stay English; a bank's own
  message is always verbatim.
- CLI verbs and MCP tools use the entrenched Spanish banking term (`saldo`,
  `movimientos`, `cuentas`, `cartola`); generic verbs stay English where no
  Spanish term is entrenched (`login`, `logout`). Bank slugs are lowercase
  (`bci`), with the Chilean bank code as alias (`016`).

## Commits & PRs

- Conventional Commits, subject ≤72 chars, one topic per commit, English.
- Branch `<type>/GH-<n>-<slug>`, open under its final name (renaming closes the PR).
- `Closes #<n>` in the PR body. One work unit per PR.
- **Stacked PRs** (a PR based on another's branch): merge the bottom one
  **without** `--delete-branch`, rebase the next onto `main` from its old base
  commit (`git rebase --onto origin/main <old-base-sha>`), retarget it to `main`,
  and only then delete the merged branch. Deleting a base branch closes the PR
  on top, and a force-pushed PR cannot be reopened (GH-31 → GH-33). CI runs only
  on PRs into `main`: run the CI-equivalent checks locally until then.
- Tracked `docs/` updates ship in the same commit/PR as the code; `ROADMAP.md`
  bookkeeping in its own commit, same PR.
- A user correction becomes a rule here in the same change as the fix — the
  first time, not the second (ADR-001).
- `docs/CURRENT_STATUS.md` is local session memory: gitignored, never committed.
- Squash-merge subjects carry `(#N)`.
- **No AI attribution anywhere.**

## Releases

- The three packages share one version; a release is: bump all three
  `package.json`, add the `## <version> — <YYYY-MM-DD> — <headline>` section to
  `CHANGELOG.md`, merge, push tag `v<version>` (ADR-010).
- GitHub Actions are pinned by commit SHA with a `# vX.Y.Z` comment, never by a
  movable tag — the publish job holds `id-token: write` (ADR-010).
- Only CI publishes, via npm trusted publishing — no npm token in the repo or in
  a secret. Never `npm publish` by hand, except the one-time bootstrap in ADR-010.
