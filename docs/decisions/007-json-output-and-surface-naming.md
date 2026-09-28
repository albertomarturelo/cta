# ADR-007: JSON by default, normalized money and dates, surfaces named by artifact

## Status

Accepted — 2026-09-23. Lineage: sii ADR-012 (JSON default) and ADR-024
(surfaces named by artifact). `cta usar` / `usar` withdrawn by ADR-011 (2026-09-24).

## Context

Primary consumers are programmatic: an agent via MCP, scripts via the CLI, and
systems embedding the core. Banks render money and dates differently
(`$1.234.567`, `12/09/2026`), and a float is not an acceptable money type.

## Decision

- **The core returns JSON-serializable objects and never formats.** The CLI
  prints them as JSON by default; `--human` renders text. STDOUT carries only the
  result; diagnostics and the effective-bank line go to STDERR.
- **Money is `{ moneda: 'CLP' | 'USD' | …, monto: <integer minor units> }`.**
  CLP has zero decimals, USD two. Never a float, never a formatted string.
- **Dates are ISO `YYYY-MM-DD`; timestamps ISO 8601 with offset.**
- **Movements are normalized:** `{ fecha, descripcion, monto (signed), saldo?,
  tipo: 'cargo' | 'abono', cuenta }`, where the bank's verbatim description is
  kept. Optional fields are omitted, not `null`.
- **Surfaces are named by banking artifact, in Spanish where the term is
  entrenched:** `cta saldo`, `cta movimientos`, `cta cuentas`, `cta bancos`,
  `cta usar`, `cta login`, `cta logout`. MCP tools mirror them (`saldo`,
  `movimientos`, …), read tools marked `readOnlyHint: true`.
- **Errors are structured** in JSON mode: `{ "error": "<verbatim bank message>",
  "banco": "<slug>" }` on STDERR with a documented exit code.

## Alternatives Considered

1. **Human text by default.** Rejected — the integration contract is the point;
   `--human` covers people.
2. **Decimal strings for money.** Rejected — integers in minor units are exact,
   sortable and trivially summed; the currency code carries the scale.

## Consequences

- Easier: MCP, CLI and embedded core share one shape; totals are exact.
- Obligation: every driver converts to minor units and ISO dates at the
  boundary, with tests for the bank's formats.
