import { describe, expect, it } from 'vitest';

import {
  bankCookies,
  classifyDocumentResponse,
  hasSessionCookie,
  isLoggedInUrl,
  isTokenCall,
  pageMessage,
} from './login-flow.js';

const cookie = (
  name: string,
  domain: string,
  extra: Partial<Parameters<typeof bankCookies>[0][number]> = {},
) => ({
  name,
  value: 'synthetic',
  domain,
  path: '/',
  expires: -1,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax' as const,
  ...extra,
});

describe('BCI login flow (pure)', () => {
  it("watches only the orchestrator's own token POST (ADR-018)", () => {
    const url = 'https://personas.bci.cl/api/api-auth-personas/v1/connectors/td';
    expect(isTokenCall('POST', url)).toBe(true);
    expect(isTokenCall('GET', url)).toBe(false);
    expect(isTokenCall('POST', 'https://www.bci.cl/api/api-auth-personas/v1/connectors/td')).toBe(
      false,
    );
    expect(isTokenCall('POST', `${url}/otro`)).toBe(false);
    expect(isTokenCall('POST', 'no es url')).toBe(false);
  });

  it('recognizes the observed JSF landing as success', () => {
    expect(isLoggedInUrl('https://www.bci.cl/cl/bci/aplicaciones/contenido.jsf')).toBe(true);
    expect(
      isLoggedInUrl('https://www.bci.cl/cl/bci/aplicaciones/menu/vistas/inicio/miBanco.jsf?x=1'),
    ).toBe(true);
    expect(isLoggedInUrl('https://www.bci.cl/corporativo/banco-en-linea/personas')).toBe(false);
    expect(isLoggedInUrl('https://evil.example/cl/bci/aplicaciones/contenido.jsf')).toBe(false);
    expect(isLoggedInUrl('not a url')).toBe(false);
  });

  it('recognizes the orchestrator landing observed on 2026-09-28, any version', () => {
    const base = 'https://personas.bci.cl/web/fe-orq-mo-personas-re-v';
    expect(isLoggedInUrl(`${base}1-7/home`)).toBe(true);
    expect(
      isLoggedInUrl(`${base}1-7/comp/mi_banco/cl/bci/aplicaciones/menu/vistas/inicio/miBanco`),
    ).toBe(true);
    expect(isLoggedInUrl(`${base}2-0/home?x=1`)).toBe(true);
    // Intermediate routes, the login app and look-alikes are not a landing.
    expect(isLoggedInUrl(`${base}1-7/cl/bci/aplicaciones/menu/index`)).toBe(false);
    expect(isLoggedInUrl(`${base}1-7/comp`)).toBe(false);
    expect(isLoggedInUrl(`${base}x/home`)).toBe(false);
    expect(isLoggedInUrl(`${base}/home`)).toBe(false);
    expect(isLoggedInUrl('https://login.bci.cl/web/fe-dispositivosconfianza-mo-re-v1-0/')).toBe(
      false,
    );
    expect(isLoggedInUrl('https://evil.example/web/fe-orq-mo-personas-re-v1-7/home')).toBe(false);
    expect(isLoggedInUrl('https://personas.bci.cl/nuevaWeb/fe-saldosultimosmovpersonas/')).toBe(
      false,
    );
  });

  it('ends the attempt on the observed login 500 and on a challenge, nothing else', () => {
    expect(
      classifyDocumentResponse({ url: 'https://www.bci.cl/LoginJSFGenerico', status: 500 }),
    ).toBe('login-server-error');
    expect(
      classifyDocumentResponse({
        url: 'https://www.bci.cl/x/miBanco.jsf?__cf_chl_rt_tk=abc',
        status: 403,
      }),
    ).toBe('challenge');
    expect(
      classifyDocumentResponse({ url: 'https://www.bci.cl/LoginJSFGenerico', status: 302 }),
    ).toBeUndefined();
    expect(
      classifyDocumentResponse({ url: 'https://www.bci.cl/other', status: 500 }),
    ).toBeUndefined();
    expect(classifyDocumentResponse({ url: 'https://www.bci.cl/x', status: 403 })).toBeUndefined();
  });

  it('stores only the bank own cookies, normalizing session cookies', () => {
    const kept = bankCookies([
      cookie('JSESSIONID', 'www.bci.cl'),
      cookie('persist', '.bci.cl', { expires: 0 }),
      cookie('IDE', '.doubleclick.net'),
      cookie('x', 'notbci.cl'),
    ]);
    expect(kept.map((c) => [c.name, c.domain])).toEqual([
      ['JSESSIONID', 'www.bci.cl'],
      ['persist', '.bci.cl'],
    ]);
    expect(kept[1]?.expires).toBe(-1);
  });

  it('requires the JSF session cookie', () => {
    expect(hasSessionCookie(bankCookies([cookie('JSESSIONID', 'www.bci.cl')]))).toBe(true);
    expect(hasSessionCookie(bankCookies([cookie('JSESSIONID', 'www.bci.cl', { value: '' })]))).toBe(
      false,
    );
    expect(hasSessionCookie(bankCookies([cookie('persist', 'www.bci.cl')]))).toBe(false);
  });

  it('accepts the orchestrator session cookie observed on 2026-09-28, on its host only', () => {
    expect(hasSessionCookie(bankCookies([cookie('__Host-SESSIONID', 'personas.bci.cl')]))).toBe(
      true,
    );
    expect(
      hasSessionCookie(bankCookies([cookie('__Host-SESSIONID', 'personas.bci.cl', { value: '' })])),
    ).toBe(false);
    expect(hasSessionCookie(bankCookies([cookie('__Host-SESSIONID', 'www.bci.cl')]))).toBe(false);
    expect(hasSessionCookie(bankCookies([cookie('JSESSIONID', 'personas.bci.cl')]))).toBe(false);
  });

  it('keeps the bank words verbatim, heading first', () => {
    expect(pageMessage({ title: 'T', heading: ' Error 500--Internal  Server Error ' }, 'f')).toBe(
      'Error 500--Internal Server Error',
    );
    expect(pageMessage({ title: 'Solo título' }, 'f')).toBe('Solo título');
    expect(pageMessage({}, 'respaldo')).toBe('respaldo');
  });
});
