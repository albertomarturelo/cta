# Bank wire contracts

One file per bank driver: `<slug>.md`. It is the observed truth the driver is
built from, and the first thing to update when a bank changes. Everything here
is **first-hand observed on a live account** (ADR-004), with dates.

**Do not identify who observed it.** No names, handles or account details: a
contract doc must not reveal which person banks where.

**Never paste real data here.** No account numbers, balances, names, RUTs,
cookies or tokens — describe shapes with synthetic values.

## Template

```markdown
# <Bank name> (`<slug>`, code <NNN>)

Last verified: <YYYY-MM-DD>

## Readable under ADR-004?
<yes / no / partially — and why. If the bank requires evasion, stop here.>

## Login
- Entry URL, flow steps, where the user types credentials.
- Second factor at login? Which kind?
- How success is detected (URL, response), how failure and lock look.

## Session
- What holds it (cookies? which? storage tokens?), observed lifetime.
- How an expired session shows up.

## Reads
### Accounts / balances
- Source (JSON endpoint or rendered page), request shape, response shape (synthetic).
### Movements
- Source, date-range parameters, paging, response shape (synthetic).

## Formats
- Money, dates, signs, account types as the bank renders them.

## Errors and blocks
- Verbatim messages observed, and what each means.

## Second factor on writes (for a future ADR-008 surface)
- Does the approval screen show amount and destination? (yes / no / not observed)
```
