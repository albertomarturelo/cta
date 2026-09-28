/** A calendar date as `YYYY-MM-DD` (ADR-007). */
export type IsoDate = string;

const PATTERNS: readonly [RegExp, (m: RegExpExecArray) => [string, string, string]][] = [
  // ISO date or datetime: the bank's own calendar date is kept; no timezone shift.
  [/^(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/, (m) => [m[1]!, m[2]!, m[3]!]],
  // dd-mm-yyyy and dd/mm/yyyy, as Chilean bank pages render them.
  [/^(\d{2})([-/])(\d{2})\2(\d{4})$/, (m) => [m[4]!, m[3]!, m[1]!]],
];

/** Normalizes a bank date to `YYYY-MM-DD`; rejects anything that is not a real calendar date. */
export function toIsoDate(input: string): IsoDate {
  const text = input.trim();
  for (const [re, pick] of PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const [y, mo, d] = pick(m);
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    if (
      date.getUTCFullYear() !== Number(y) ||
      date.getUTCMonth() !== Number(mo) - 1 ||
      date.getUTCDate() !== Number(d)
    ) {
      throw new RangeError(`Not a calendar date: '${input}'`);
    }
    return `${y}-${mo}-${d}`;
  }
  throw new SyntaxError(`Unrecognized date format: '${input}'`);
}
