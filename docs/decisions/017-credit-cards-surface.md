# ADR-017: Credit cards — `cta tarjetas`, read with the login's grant and the cards app's own headers

## Status

Accepted — 2026-09-29. Extends ADR-007 (surfaces, money, dates) and ADR-015 (the
read grant); CTA-8.

## Context

The next read is the user's credit cards: quotas, billed amount, minimum
payment, dates and movements. The CTA-8 probes (2026-09-29, `bank-contract/bci.md`,
"Credit cards") found the home's "Tarjetas" view cookie-authenticated, and the
"Mis movimientos" app (`fe-mismovimientos`) calling the `apilocal` gateway with
the **same bearer** as the saldos app (from `connectors/td`) but its **own**
headers. One answer per card (`informacion-tdc`) carries quotas, billed totals,
dates and movements, national (CLP, whole pesos) and international (USD, dollars
with two decimals); it answered `200` from Node.

## Decision

- **Surfaces:** `cta tarjetas --banco <b> [--tarjeta <last-4>] [--movimientos]`
  and MCP `tarjetas` (`banco` required, `tarjeta?`, `movimientos?`;
  `readOnlyHint: true`). One core task, `tarjetas`, behind both (ADR-003); the
  holder's method allowlist gains `tarjetas` (ADR-015).
- **Output** (ADR-007: minor units, ISO dates, optional fields omitted):
  `{ banco, tarjetas: Tarjeta[], movimientos?: MovimientoTarjeta[] }` with
  - `Tarjeta` is **one per card account**, never per plastic: `{ banco,
    tarjeta: '<titular's last 4>', adicionales?: ['<last 4>'], descripcion,
    nacional: Cupo, internacional: Cupo, facturacion: { ultima?, proxima?,
    vencimiento?, vencimientoProximo? } }` — the bank lists one entry per
    plastic and an additional card shares its titular's `numeroDeCuenta`
    (observed), so the driver groups by account, reads each account once, and
    a quota is never reported twice. `descripcion` is the bank's own label of
    the titular card, verbatim, accepted only if it shows at most 4 digits;
  - `Cupo = { total, utilizado, disponible, facturado?, pagoMinimo? }`, every
    field a `Money` (`CLP` national, `USD` international, in cents);
  - `MovimientoTarjeta = { banco, tarjeta, fecha, descripcion, monto, tipo:
    'cargo' | 'abono', facturado: boolean, cuota?: { numero, total },
    adicional?: true }`; `tarjeta` is the last 4 of the plastic that made it
    (from the movement's own label), `adicional` the bank's own flag; `monto` is
    a signed `Money` whose `moneda` (`CLP` or `USD`) says national or
    international; `cuota` only when the bank says more than one.
- **Movements carry no range:** `--movimientos` returns what the bank shows —
  the last billed statement and the unbilled ones. There is no `--desde`; the
  MCP description says so, and says `facturado` tells the two apart.
- **Card numbers never leave the driver.** The bank's `numeroTarjeta` (4
  digits on 2026-09-29) and the card account number are request keys only,
  held in memory with the grant, never in output, audit, errors or logs.
  Output shows last 4 digits only; `--tarjeta` matches a titular's or an
  additional card's and selects that account. A label or a movement
  description with a run of more than 4 digits is a `BankError`, never printed.
- **Sign and meaning are inferred until the live run confirms them:** a
  positive bank `monto` is a `cargo` (negative in output), a negative one an
  `abono`. Date fields map as `fechaFacturacion` → `ultima`,
  `fechaProximaFacturacion` → `proxima`, `fechaVencimiento` → `vencimiento`,
  `fechaVencimientoNoFacturado` → `vencimientoProximo`. Dates come as `D/M/YYYY`
  without zero padding; any other shape, or a USD amount with more than 2
  decimals, is a `BankError`.
- **The cards grant is a second capture in the same login**, with no manual
  step: after the saldos capture, the driver follows the bank's own menu by
  exact names («Tarjetas» → «Tarjetas de crédito» → «Mis movimientos») and keeps
  the headers of that app's own `GET …/mov-tdc/` request, exactly as sent, and
  the card list from its answer (as `por-rut` gives the accounts). The bearer
  is the same token; the grant keeps one header set per app. Reads then `POST …/mov-tdc/informacion-tdc`
  from Node, one card at a time, with that app's headers only (ADR-015).
- **A failed cards capture does not fail the login.** Accounts, balances and
  movements still work; `tarjetas` then raises a `BankError` saying where the
  menu stopped. The capture waits a bounded time for the app's own request and
  never repeats a click the bank answered.

## Alternatives Considered

1. **The home's "Tarjetas" view (`consultar-cupo`, `titulares`).** Rejected:
   cookie-authenticated on `personas.bci.cl`; reading it from Node would replay
   the browser's session cookie, which ADR-015 rules out. It also lacks billed
   totals, dates and movements.
2. **Reuse the saldos app's headers for the cards API.** Rejected: the bank's
   apps never send that combination; ADR-015 sends an app's own headers only.
3. **Hard-code the cards app's headers and skip the menu.** Rejected:
   `origin-addr` is the bank's own value for the client and `x-ibm-client-id`
   would land in a public repo; both stay the bank's own, read at runtime.
   Only the capture uses the menu; the reads are the web's own API calls.
4. **Capture the cards grant on the first `tarjetas` read, in a browser.**
   Rejected: reads never open a browser (ADR-015); it would need a second login.
5. **A separate `cta movimientos-tarjeta` command.** Rejected by the owner: the
   same bank answer serves both; `--movimientos` keeps one surface.
6. **Folding card movements into `cta movimientos`.** Rejected: a card is not
   an account (no balance, two currencies, billing state); mixing them would
   blur ADR-014's per-account coverage.
7. **The "Estado de cuenta" app.** Deferred: statement history, a third app.

## Consequences

- One attended login also yields about an hour of card reads; the login
  window stays open a little longer while the cards app loads.
- The grant type gains per-app headers and a card list; the driver gains a
  second menu path, which can break when the bank changes its menu — it then
  fails only `tarjetas`, naming the step.
- Obligation: the live run confirms the sign, the date fields and the USD
  scale against the bank's own app before the contract marks them observed.
