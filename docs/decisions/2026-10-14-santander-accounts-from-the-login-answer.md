# Santander: grant and accounts from the login's answer, headers from the public config

## Status

Accepted — 2026-10-14; amended 2026-10-15 (exact fields, product types).
Amends ADR `santander-reads-over-http`: replaces "the
grant comes from the page's own requests after the landing" and "the token
endpoint's answer is never parsed", and restates its evidence-gate items 2
and 3. The field mapping below was recorded on 2026-10-15 (equality probe +
the accounts app's bundle), which made ADR `santander-reads-over-http`
Accepted.

## Context

Two attended probes on 2026-10-14 (`bank-contract/santander.md`) met gate item
1: `balances` and `transactions` answered `200` from Node with the seven
allowlisted headers only, no cookies, before `exp`. Items 2 and 3 failed as
written:

- **No accounts call exists.** The home's "Cuentas" section and the drawer's
  "Mis cuentas" render the products with no API call; the page then calls
  `balances` with an `accountId` it already holds. The only source is the token
  call's answer (`CrucedeProducto`), which also carries the customer's identity
  (names, document number, segment) and amounts.
- **The page makes no read by itself.** With no click after landing, no
  `openbanking` read was sent; waiting for one would add a manual step.

The same day, the public bundles showed that the accounts app does not read its
header values from the obfuscated `properties-frame.js`: it reads them from its
own `Saldos/assets/web/properties.js` — plain, public, no secret — which holds
the service URL (the `<service>` segment), the client id, the schema id and
the span id; `X-Client-Code` and `X-Organization-Code` are literals in the
app's bundle. That is ADR-018's situation on BCI.

## Decision

- **The login ends on the token call** (`oauth2/token` answering `200`), as
  BCI's ends on `connectors/td` (ADR-018). cta clicks nothing; no step after
  the user's typing. Reads never open a browser.
- **From that answer, in memory, cta extracts exactly:** `access_token`
  (ADR-015: only `exp` decoded), and per product of
  `CrucedeProducto.MATRICES.MATRIZCAPTACIONES.e1[]` / `.e2[]` four fields, as
  the accounts app maps them: `OFICINACONTRATO` + `NUMEROCONTRATO`
  (concatenated → `accountId`), `CODIGOMONEDA` (→ `currency`) and
  `AGRUPACIONCOMERCIAL` (the product type; `commercialGroup` is `"AHR"` for
  savings, else `""`). Everything else — amounts, `NUMEROPAN`,
  `ESCALARES` (names, document number, segment), `infoUser`, other matrices,
  `refresh_token`, `tokenJWT` — is never read by name, logged, stored,
  returned or passed on; the parsed object is dropped after extraction.
- **The extractor is a pure function with an allowlist of paths**, tested on a
  synthetic answer. A missing path fails the login with a `BankError` naming
  the step, never a guess.
- **Headers from the public config, parsed as text at login** (ADR-018): a pure
  parser reads `Saldos/assets/web/properties.js` and the accounts app's bundle
  for the allowlisted header values and the service URL. No code from the bank
  is executed, no file is deobfuscated, `properties-frame.js` is not read.
  `x-b3-spanid` is taken from the config as the page does. The config's
  `x-santander-client-id` differs from the one the page sends, and the bank
  accepts it (2026-10-15); cta uses the config's. A missing key fails the
  login naming the file.
- **The RUT rule holds (ADR-012):** cta never asks for, builds or sends it; the
  document number sits only in the parsed buffer and is not touched.
- **Products:** `cuentas` are the products whose `AGRUPACIONCOMERCIAL` is
  `CCC` (current account, any currency), `CCM` (cuenta vista) or `AHR`
  (savings), the ones read through `current-accounts`. Every other type is
  skipped by the extractor: `LCR` (the credit line is a product of its own,
  with its own movements service; its figures also ride on the current
  account's `balance` as `overdraftAgreement`, `balanceLca`), `TCR` (credit
  cards, `NotYetSupported`), loans and mortgages. Adding one needs a contract
  observation first.
- **Evidence (2026-10-15):** reads built only from the config and the token
  answered `200`; `currency` equals `CODIGOMONEDA` on the wire; the
  `accountId` concatenation is read from the app's bundle, not yet compared on
  the wire — the driver's first live login confirms it, and a mismatch fails
  that login naming the step.

## Alternatives Considered

1. **Wait for the user to open an account and capture the page's headers.**
   Rejected: a manual step after login, when the public config already holds
   the values.
2. **The user configures accounts by hand.** Rejected: friction on every new
   product, account numbers on disk, and a mismatch fails only at read time.
3. **No Santander driver** (the outcome ADR `santander-reads-over-http`
   allowed). Rejected: item 1 passed; the rest failed only on our own rule,
   and the subset reads no new kind of data (BCI accounts carry numbers too).
4. **Read the whole answer and filter later.** Rejected: identity would reach
   driver code and could leak into errors or logs.

## Consequences

- Santander's login works like BCI's: type, land, done; about 10 minutes of
  reads follow (unchanged: no refresh, on-demand only).
- cta parses an answer that holds the customer's identity. The extractor's
  allowlist and its test are the guard; a change that reads a new path needs
  review against this ADR.
- If the bank renames a config key or a subset path, the login fails loudly at
  the parser; the fix comes from a new observation (ADR-004).
