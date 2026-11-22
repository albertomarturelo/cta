# Card movements carry their coverage — a just-closed cycle is a gap, said out loud

## Status

Accepted — 2026-11-22. Amends ADR-017 (the `tarjetas` output); applies ADR-014's
idea to cards. CTA-24, public #34.

## Context

ADR-017 returns a card's movements as the bank shows them: the last billed
statement and the unbilled ones, with no range. Between a cycle's close and the
publication of its statement, BCI's `informacion-tdc` still reports the previous
statement as billed and only movements from the new close on as unbilled; the
just-closed cycle is in neither list (CTA-23, `bank-contract/bci.md`, "A
just-closed card cycle"). No call of the cards app or the statement app returns
those movements in that window, and the bank's own app shows the same gap. A
consumer — a person reading JSON, a script, an agent summarizing spend — reads
the list as complete. ADR-014 already solved this shape of problem for account
movements: return what the bank gave and say how far it reaches.

## Decision

- **With `--movimientos` (MCP `movimientos: true`), the `tarjetas` result gains
  `cobertura: CoberturaTarjeta[]`,** one per card account read, in the order of
  `tarjetas`: `{ tarjeta: '<last 4>', completo: boolean, hueco?: { desde:
  IsoDate, hasta: IsoDate } }`. Without `--movimientos` there is no
  `cobertura` (there are no movements to qualify).
- **`hueco` is the just-closed cycle:** from the day after the last billed
  close (`facturacion.ultima`) to the day before the passed close
  (`facturacion.proxima`), both inclusive; unbilled movements start at that
  close. `completo` is `false` whenever `hueco` is present.
- **"The close has passed" is decided by the bank's own date,** the
  `fechaActual` of the same `informacion-tdc` answer: the window is
  `fechaProximaFacturacion < fechaActual`. No clock in the core path; the
  answer is judged against what the bank believed when it answered. Its
  meaning (the bank's current date) is confirmed on the next live run inside a
  window, as ADR-017 did for the other date fields.
- **`completo: true` only when the driver can vouch for it:** `ultima`,
  `proxima` and `fechaActual` all present and the window not open. A missing
  date → `completo: false` with no `hueco`. A date of another shape stays a
  `BankError` (ADR-017).
- **`completo` speaks only of the gap between the last statement and today.**
  Older statements were never part of `tarjetas` (ADR-017), and that is not
  reported as incomplete.
- **Surfaces never hide it** (ADR-014): `--human` prints one Spanish warning
  line per incomplete card on STDERR; the MCP `tarjetas` description tells the
  agent to report an incomplete `cobertura` (and its `hueco`) instead of
  presenting the movements as the whole period.
- **A driver that cannot tell** returns `completo: false` with no `hueco`. The
  demo bank (ADR-019) reports `completo: true`.

## Alternatives Considered

1. **A flag on each `Tarjeta`** (`facturacion.estadoCuentaPendiente`).
   Rejected: it describes the card, not the movements; it would appear without
   `--movimientos`, and it departs from the shape agents already know from
   `movimientos`.
2. **A warning only (STDERR, MCP text).** Rejected: JSON consumers get no
   signal, and they are the ones that summarize.
3. **The core's `Clock` as "today".** Rejected: adds a clock to a pure read and
   can disagree with the bank around midnight or on a stale answer; the bank's
   own `fechaActual` comes in the same answer.
4. **Fill the gap from another call.** Rejected for now: CTA-23 found none; a
   well-formed `fechaFacturacion` on the statement export was not tried (no
   bank app sends it). If one appears, it can make `completo` true more often
   without changing this contract.
5. **Fail the read in the window.** Rejected: quotas and post-close movements
   are still right; partial data with an explicit flag beats none (ADR-014).

## Consequences

- `TarjetasResult` and `BankDriver.tarjetas` gain `cobertura`; the BCI driver
  computes it from the answer it already reads, with no new request.
- Every bank driver must report it; a new bank starts at `completo: false`.
- Obligation: the next live run inside a window confirms `fechaActual` against
  the bank's app before the contract marks it observed.
