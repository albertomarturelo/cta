import type { StoredCookie } from '../../seams/seams.js';
import { BCI } from './config.js';

/** A browser cookie as Playwright reports it (structural, no Playwright import). */
export interface BrowserCookie {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires: number;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: 'Strict' | 'Lax' | 'None';
}

function parse(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

/**
 * Success is decided by where the browser landed, not by a status (CONVENTIONS):
 * the JSF home (2026-09-24) or the orchestrator app that replaced it as the
 * landing (2026-09-28). Both are kept — a rollout may reach users unevenly.
 */
export function isLoggedInUrl(url: string): boolean {
  const u = parse(url);
  if (!u) return false;
  if (u.hostname === BCI.appHost) {
    return (BCI.homePaths as readonly string[]).includes(u.pathname);
  }
  const o = BCI.orchestrator;
  if (u.hostname !== o.host || !u.pathname.startsWith(o.pathPrefix)) return false;
  // Past the prefix: "<version>/home" or "<version>/comp/mi_banco/…".
  const rest = u.pathname.slice(o.pathPrefix.length);
  const version = rest.slice(0, rest.indexOf('/'));
  if (!/^\d+(-\d+)*$/.test(version)) return false;
  const route = rest.slice(version.length);
  return route === o.homeSuffix || route.startsWith(o.miBancoSegment);
}

/**
 * The orchestrator's own token call (ADR-018): a POST to `connectors/td` on its
 * host. Watched, never sent by `cta`.
 */
export function isTokenCall(method: string, url: string): boolean {
  const u = parse(url);
  return (
    method === 'POST' &&
    u !== undefined &&
    u.hostname === BCI.tokenCall.host &&
    u.pathname === BCI.tokenCall.path
  );
}

/**
 * Classifies a decisive document response. The login uses only
 * `login-server-error`: a challenge there is the user's to resolve (ADR-004).
 * `challenge` serves unattended reads (restore), where nobody can resolve it.
 */
export function classifyDocumentResponse(r: {
  url: string;
  status: number;
}): 'login-server-error' | 'challenge' | undefined {
  const u = parse(r.url);
  if (!u) return undefined;
  if (r.status === 403 && BCI.challengeMarkers.some((m) => r.url.includes(m))) return 'challenge';
  if (r.status >= 500 && u.hostname === BCI.appHost && u.pathname === BCI.loginPostPath) {
    return 'login-server-error';
  }
  return undefined;
}

const isBankDomain = (domain: string) => {
  const d = domain.replace(/^\./, '');
  return d === BCI.cookieDomainSuffix || d.endsWith(`.${BCI.cookieDomainSuffix}`);
};

/** The cookies worth storing: the bank's own domains only (ADR-006). */
export function bankCookies(cookies: readonly BrowserCookie[]): StoredCookie[] {
  return cookies
    .filter((c) => isBankDomain(c.domain))
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires > 0 ? c.expires : -1,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    }));
}

/** The JSF session (2026-09-24) or the orchestrator's (2026-09-28), whichever the landing set. */
export function hasSessionCookie(cookies: readonly StoredCookie[]): boolean {
  const is = (c: StoredCookie, name: string, host: string) =>
    c.name === name && c.domain.replace(/^\./, '') === host && c.value !== '';
  return cookies.some(
    (c) =>
      is(c, BCI.sessionCookie, BCI.appHost) ||
      is(c, BCI.orchestrator.sessionCookie, BCI.orchestrator.host),
  );
}

/** The bank's own words from an error page, verbatim; a neutral fallback if none. */
export function pageMessage(
  page: { title?: string | undefined; heading?: string | undefined },
  fallback: string,
): string {
  const clean = (s?: string) => s?.replace(/\s+/g, ' ').trim() || undefined;
  return clean(page.heading) ?? clean(page.title) ?? fallback;
}
