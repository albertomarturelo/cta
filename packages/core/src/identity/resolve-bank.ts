import { UnknownBank } from '../errors/errors.js';
import type { BankDriver } from '../seams/seams.js';

/**
 * The one place a bank argument becomes a driver (ADR-011): required, matched by
 * slug (case-insensitive) or by Chilean bank code, never inferred.
 */
export function resolveBank(input: string | undefined, drivers: readonly BankDriver[]): BankDriver {
  const wanted = input?.trim().toLowerCase() ?? '';
  const driver =
    wanted === '' ? undefined : drivers.find((d) => d.slug === wanted || d.code === wanted);
  if (!driver)
    throw new UnknownBank(
      input,
      drivers.map((d) => d.slug),
    );
  return driver;
}
