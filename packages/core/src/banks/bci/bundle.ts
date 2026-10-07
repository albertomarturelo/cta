import { BankError } from '../../errors/errors.js';
import { BCI } from './config.js';
import { unexpected } from './reads.js';

/**
 * Pure reading of a BCI app's public bundle (ADR-018, contract "Grant without
 * the menu"): the app's HTTP interceptor sets its API headers as constants, so
 * `cta` sends the same values the app would, read at login, never hard-coded.
 * Minifiers rename variables but keep header names as string literals, so the
 * parse anchors on those. Anything unexpected fails closed, naming the header
 * — never printing a value.
 */

/** An app's headers without the bearer, and the auth scheme its code writes. */
export interface AppHeaderTemplate {
  readonly headers: Readonly<Record<string, string>>;
  readonly scheme: string;
}

/** The `main.<hash>.js` an app's shell loads; the ES5 copy of a dual build is skipped. */
export function mainScriptOf(html: string, app: string): string {
  const scripts = [...html.matchAll(/<script[^>]*\ssrc="(main[\w.-]*\.js)"/g)]
    .map((m) => m[1]!)
    .filter((src) => !/(^|[-.])es5[-.]/.test(src));
  if (scripts.length !== 1) throw unexpected(`app ${app}: script principal`);
  return scripts[0]!;
}

/** The `{…}` that starts at `open`, skipping braces inside string and template literals. */
function balanced(src: string, open: number): string {
  let depth = 0;
  let quote: string | undefined;
  for (let i = open; i < src.length; i++) {
    const c = src[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = undefined;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('unbalanced');
}

/** The `{` of the innermost object around `at`; header objects hold no braces in strings. */
function enclosingOpen(src: string, at: number): number {
  let depth = 0;
  for (let i = at; i >= 0; i--) {
    if (src[i] === '}') depth++;
    else if (src[i] === '{') {
      if (depth === 0) return i;
      depth--;
    }
  }
  throw new Error('no object');
}

/** The top-level `key: value` entries of an object literal, as source text. */
function entriesOf(obj: string): string[] {
  const body = obj.slice(1, -1);
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = undefined;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if ('{[('.includes(c)) depth++;
    else if ('}])'.includes(c)) depth--;
    else if (c === ',' && depth === 0) {
      parts.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(body.slice(start).trim());
  return parts.filter((p) => p !== '');
}

const escapeRe = (s: string) => s.replace(/[$]/g, '\\$');

interface Parsed {
  headers: Record<string, string>;
  scheme?: string;
}

/**
 * A value is a string literal, the `` `<scheme> ${token}` `` template of
 * `Authorization`, or a reference to a key of the app's production environment
 * object (the saldos and statements apps' `X-IBM-Client-Id`, observed 2026-10-07).
 */
function readEntries(src: string, obj: string, depth: number): Parsed {
  const out: Parsed = { headers: {} };
  for (const entry of entriesOf(obj)) {
    if (entry.startsWith('...')) {
      // `...X.header` (the cards app, observed 2026-10-07): the one `header:{…}`
      // object of the bundle that sets an Application-Id.
      const prop = /\.([\w$]+)$/.exec(entry)?.[1];
      if (prop === undefined || depth > 0) throw new Error('spread');
      const found = [...src.matchAll(new RegExp(`[,{]${escapeRe(prop)}:\\{`, 'g'))]
        .map((m) => balanced(src, m.index + m[0].length - 1))
        .filter((o) => o.includes('"Application-Id"'));
      if (found.length !== 1) throw new Error('spread');
      const inner = readEntries(src, found[0]!, depth + 1);
      Object.assign(out.headers, inner.headers);
      continue;
    }
    const kv = /^("[^"]+"|'[^']+'|[\w$]+):([\s\S]+)$/.exec(entry);
    if (!kv) throw new Error('entry');
    const name = kv[1]!.replace(/^["']|["']$/g, '').toLowerCase();
    const raw = kv[2]!.trim();
    if (name === 'authorization') {
      // Later entries win, as in the object literal: a spread's placeholder
      // string is overridden by the interceptor's own template.
      const scheme = /^`([A-Za-z]+) \$\{[\w$]+\}`$/.exec(raw)?.[1];
      if (scheme !== undefined) out.scheme = scheme;
      continue;
    }
    let value = /^"([^"]*)"$/.exec(raw)?.[1];
    const ref = /^[\w$]+(?:\.[\w$]+)*\.([\w$]+)$/.exec(raw)?.[1];
    if (value === undefined && ref !== undefined) {
      const vals = new Set(
        [
          ...src.matchAll(new RegExp(`production:!0,[^{}]*?\\b${escapeRe(ref)}:"([^"]+)"`, 'g')),
        ].map((m) => m[1]!),
      );
      if (vals.size === 1) value = [...vals][0]!;
    }
    if (value === undefined) {
      // A header `cta` does not send may hold anything; one it sends may not.
      if ((BCI.apiHeaders as readonly string[]).includes(name)) throw unexpected(`header ${name}`);
      continue;
    }
    out.headers[name] = value;
  }
  return out;
}

// Header values are short constants (ids, codes, an IPv4, a media type).
const VALUE = /^[\w.\-/ ]{1,80}$/;
const REQUIRED = [
  'content-type',
  'application-id',
  'channel',
  'reference-service',
  'reference-operation',
  'x-ibm-client-id',
  'tracking-id',
] as const;

/**
 * The headers an app's interceptor sets, from its bundle: the one object that
 * builds `Authorization` from the token and sets `X-IBM-Client-Id`. Only the
 * contract's header names are kept (`Origin`, which a browser never lets a page
 * set, is dropped — ADR-015); each must be a plain constant.
 */
export function bundleHeaders(js: string, app: string): AppHeaderTemplate {
  const objects = new Set<string>();
  for (const m of js.matchAll(/Authorization:`[A-Za-z]+ \$\{/g)) {
    let obj: string;
    try {
      obj = balanced(js, enclosingOpen(js, m.index));
    } catch {
      continue;
    }
    if (obj.includes('"X-IBM-Client-Id"')) objects.add(obj);
  }
  if (objects.size !== 1) throw unexpected(`app ${app}: headers`);
  let parsed: Parsed;
  try {
    parsed = readEntries(js, [...objects][0]!, 0);
  } catch (err) {
    if (err instanceof BankError) throw err;
    throw unexpected(`app ${app}: headers`);
  }
  if (parsed.scheme === undefined) throw unexpected(`app ${app}: authorization`);
  const headers: Record<string, string> = {};
  for (const name of BCI.apiHeaders) {
    const v = parsed.headers[name];
    if (v === undefined) continue;
    if (!VALUE.test(v)) throw unexpected(`app ${app}: header ${name}`);
    headers[name] = v;
  }
  for (const name of REQUIRED) {
    if (headers[name] === undefined) throw unexpected(`app ${app}: header ${name}`);
  }
  return { headers, scheme: parsed.scheme };
}

/** The headers a read sends: the app's own, its Accept, and the bearer as its code writes it. */
export function withToken(t: AppHeaderTemplate, token: string): Record<string, string> {
  return { accept: BCI.apiAccept, ...t.headers, authorization: `${t.scheme} ${token}` };
}
