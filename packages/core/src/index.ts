// Main barrel: pure and embeddable. No `node:*` and no Playwright at import
// time — Node adapters belong behind the `./node` subpath (ADR-003).
export * from './errors/errors.js';
export * from './money/money.js';
export * from './dates/dates.js';
export type * from './domain/types.js';
export type * from './seams/seams.js';
export * from './seams/fakes.js';
export { resolveBank } from './identity/resolve-bank.js';
export { matchCuenta } from './accounts/match-cuenta.js';
export { inRange, latestOnlyCoverage } from './movements/coverage.js';
export { createTasks } from './tasks/tasks.js';
export type {
  BancoInfo,
  LoginFallido,
  LoginResult,
  LoginStarted,
  MovimientosQuery,
  TaskDeps,
  Tasks,
} from './tasks/tasks.js';
