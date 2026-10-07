# ADR-018: The read grant comes from the orchestrator's token call and the apps' own bundles — no menu

## Status

Accepted — 2026-10-07. Supersedes in part ADR-015 (how the grant is captured)
and ADR-017 (the cards capture through the menu; its alternative 3 rationale).
Takes effect for a driver only once its contract records the probe below.

## Context

Every BCI read already runs from Node over HTTP (ADR-015), but the login still
clicks through the bank's home menu so each embedded app sends one request
whose headers `cta` copies. That menu is the part that keeps breaking: CTA-6
(the "Mi Cuenta" accordion), then three fixes in CTA-8 alone («Tarjetas» is an
anchor without `href`, a slow menu, a group that needs a second click). The
bank changes its front end; its API has stayed put.

Two observations (2026-10-07, `bank-contract/bci.md`) remove the reason for the
menu: (1) right after the landing the orchestrator itself sends
`POST connectors/td`, whose `access_token` is the bearer of every `apilocal`
call seen (2026-09-29, matched by hash); (2) each app's header values are
constants in its own public JavaScript bundle, served without a session —
`Origin-Addr` included, which the contract had wrongly inferred to be the
client's IP. The apps build `Authorization` as `bearer <token>`.

## Decision

- **Login ends on the token.** After the landing, the driver waits a bounded
  time for the orchestrator's own `connectors/td` response and keeps its
  `access_token` in memory (only `exp` decoded, ADR-015). `cta` clicks nothing
  after the user's own typing; the window closes once the token is in. No
  token → the login fails at once with a `BankError` naming the step.
- **Headers come from each app's own bundle, read at login.** Node fetches the
  app's public shell (`index.html`) and the `main.*.js` it names — plain HTTPS
  GETs, no cookie, no grant, no browser headers. A pure parser takes the header
  object of the app's HTTP interceptor by header **name** (literal strings
  survive minification) and builds `Authorization` the way that code does.
  Apps: saldos (`/modernizacion/fe-saldosultimosmovpersonas/`), cartolas
  (`/nuevaWeb/fe-cartolashistoricaspersonas/`), cards
  (`/andes/fe-mismovimientos/`). A header the interceptor sets but a browser
  never sends (`Origin`) is not sent (ADR-015: no browser headers made up).
- **Fail closed.** A bundle without the expected header names, or with a value
  of an unexpected shape, is a `BankError` naming the app and the header — never
  its value. The token, the accounts app and the saldos app are required: any
  of them failing fails the login. The cards app failing fails only `tarjetas`
  (as ADR-017 already does).
- **`cta` sends the list requests itself, still RUT-free.** Accounts come from
  the cartolas app's `GET SolicitarClienteCuentas` (no body, no RUT, observed
  2026-09-25) instead of waiting for the saldos app's `por-rut`, whose body
  carries the RUT. Cards come from `GET mov-tdc/` (no body). The RUT rule
  (ADR-012) is unchanged: `cta` never builds, reads or sends it.
- **Evidence gate (ADR-015):** the driver switches only after one probe login
  records, from Node with the `connectors/td` token and bundle-built headers, a
  `200` for each read: accounts, balance, movements, card list, card detail.
  Met on 2026-10-07 (contract, "Grant without the menu").
- The client IDs stay out of this public repo: no fixture, doc or test carries
  a real value; tests build synthetic bundles at run time.

## Alternatives Considered

1. **Keep the menu capture.** Rejected: it is the part that breaks, and each
   break costs a login (2–3 a day). The API needs nothing it provides.
2. **Hard-code the header values with an observation date.** Rejected: it
   publishes the bank's client IDs in a public repo, and a rotation needs a
   release (the cards client ID already differs in length from 2026-09-29's
   capture). The bundle gives today's values, the same the browser would send.
3. **Send `connectors/td` from Node with the session cookie.** Rejected: it
   replays the browser's cookie (ADR-015 alternative 6) and could mint tokens
   after the login — a refresh by another name (ADR-015).
4. **Keep `por-rut`, fed by `obtenerDatosCliente` or the token's claims.**
   Rejected: `cta` would handle the RUT (ADR-012).
5. **Open each app by URL, without the menu.** Rejected: a built URL is a
   guessed link (GH-38 hit a bank error page) and still waits on each app.

## Consequences

- The login window closes seconds after the landing, and no BCI menu change
  can break it. Cards no longer need a second capture: `tarjetas` works on
  every login.
- New dependency: the shape of three public bundles. A rename of a header
  literal or of the shell's `main.*.js` reference breaks that app's reads with
  a `BankError` at login — visible, and fixed in the parser, not in a probe.
- The login sends six public GETs to `personas.bci.cl`. No `apilocal` call is
  added; the reads are the same ones the apps make.
- CONVENTIONS ("after the landing … may follow the bank's own menu") and the
  contract's "Driver rules" change when this ships; the menu code is deleted.
