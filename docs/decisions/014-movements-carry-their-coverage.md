# ADR-014: Movements carry their coverage — a bank may return less than the range

## Status

Accepted — 2026-09-25. Refines ADR-007 (movement output); GH-15.

## Context

`cta movimientos --desde --hasta` promises movements in a date range. The BCI
contract (GH-15) shows the only JSON movements read takes an account and **no
range**: it returns the latest movements, capped (50 observed). The bank's date
search lives in a server-rendered JSF page whose search POST has not been
observed; the new statements app lists monthly statements, not movements.
Returning the filtered latest 50 as if they were the whole range would silently
drop older movements — for money, a quiet omission is worse than an error.

## Decision

- **`movimientos` returns what the bank gave, filtered to the range, and says
  how far that reaches.** Result:
  `{ banco, movimientos: Movimiento[], cobertura: Cobertura[] }`, one
  `Cobertura` per account read:
  `{ cuenta, desde?: IsoDate, hasta?: IsoDate, completo: boolean }`, where
  `desde`/`hasta` are the oldest and newest dates the bank returned (omitted when
  it returned none), and `completo` is true only when the driver can vouch that
  nothing in the requested range is missing.
- **The driver decides `completo`,** because only it knows its source. A driver
  whose read has no range (BCI's latest movements) reports `completo: true` only
  when the requested `desde` is strictly after the oldest date returned — a cap
  can cut the oldest day in half. No `--desde`, or an empty list → `false`.
- **`--desde` and `--hasta` are optional.** Absent, the result is everything the
  bank returned; `hasta` never defaults to a guess of "today" in the core.
- **Surfaces never hide it:** `--human` prints a warning line when any
  `cobertura` is incomplete (STDERR); the MCP `movimientos` description tells
  the agent to report incompleteness to the user instead of summarizing the
  range as whole.
- **`BankDriver.movimientos`** returns `{ movimientos, cobertura }` instead of a
  bare list. A bank with a real range read can report `completo: true` directly.
- **BCI's sign comes from `tipo`:** `C` → `cargo` (negative), `A` → `abono`
  (positive), recorded as *inferred* in the contract; any other letter is a
  `BankError`, never a guess. Verified on the first live run.

## Alternatives Considered

1. **Wait for the JSF Cartola Histórica date search.** Rejected for now — not
   observed; parsing server HTML is the most fragile read. It can later make
   `completo` true more often without changing this contract.
2. **Drop `--desde`/`--hasta` in v1.** Rejected — departs from the ROADMAP verb
   and every future bank's natural read; coverage handles the gap honestly.
3. **Fail when the range reaches past the oldest movement.** Rejected — makes
   the common "this month" query fail for an active account; partial data with
   an explicit flag is more useful than none.

## Consequences

- Easier: `movimientos` ships with what was observed; the output tells the
  truth about its reach.
- Harder: consumers must read `cobertura`; the shape is a list, not a flag.
- Obligation: the BCI `tipo` mapping is verified live before it is marked
  observed; ROADMAP's `movimientos` row notes the latest-50 limit.
