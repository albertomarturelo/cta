import { AmbiguousAccount, NoSuchAccount } from '../errors/errors.js';

/**
 * Resolves a `--cuenta` selector against the account numbers of one bank: the
 * full number (separators ignored) or its last 4 digits. Drivers call it after
 * listing accounts, inside the same browser (ADR-012).
 */
export function matchCuenta(banco: string, numeros: readonly string[], selector: string): string {
  const digits = (s: string) => s.replace(/\D/g, '');
  const wanted = digits(selector);
  if (wanted === '') throw new NoSuchAccount(banco, selector);
  const exact = numeros.filter((n) => digits(n) === wanted);
  if (exact.length === 1) return exact[0]!;
  const bySuffix = wanted.length === 4 ? numeros.filter((n) => digits(n).endsWith(wanted)) : [];
  if (bySuffix.length === 1) return bySuffix[0]!;
  const count = Math.max(exact.length, bySuffix.length);
  if (count > 1) throw new AmbiguousAccount(banco, selector, count);
  throw new NoSuchAccount(banco, selector);
}
