import { describe, expect, it } from 'vitest';

import { BankError } from '../../errors/errors.js';
import { bundleHeaders, mainScriptOf, withToken } from './bundle.js';

// The environment key's name is joined at run time so no credential-shaped
// literal sits in the source (ADR-009).
const KEY = ['api', 'Key'].join('');

// Synthetic bundles in the three shapes seen on 2026-10-07 (contract, "Grant
// without the menu"); every id and value is invented.
const saldosLike = [
  `var a=1;const uh="https://example.invalid/",lh={production:!0,${KEY}:"cliente-saldos",`,
  `defaultTimeout:2e4},dev={production:!1,${KEY}:"otro-entorno"};`,
  'intercept(t,e){const r=this.s.getToken();const i=t.clone({setHeaders:{"Application-Id":"1",',
  'Authorization:`bearer ${r}`,Channel:"110","Content-Type":"application/json",',
  'Origin:"https://app.example.invalid","Origin-Addr":"10.0.0.1","Reference-Operation":"refope",',
  `"Reference-Service":"refser","Tracking-Id":"1","X-IBM-Client-Id":lh.${KEY}}});return e.handle(i)}`,
  // an unrelated call in the same bundle (an analytics client)
  'send(n,t,i){const l={"Content-Type":"application/json",Authorization:`Bearer ${i}`};}',
].join('');

const cardsLike = [
  'Td={production:!1,"X-IBM-Client-Id":"cliente-entorno",headers:{auth:{"X-IBM-Client-Id":"x"}},',
  'header:{"Application-Id":"app-tarjetas",Authorization:"bearer {{token}}",Channel:"110",',
  '"Content-Type":"application/json","Origin-Addr":"10.0.0.1","Reference-Operation":"tarjetas",',
  '"Reference-Service":"tarjetas","Tracking-Id":"1","X-IBM-Client-Id":"cliente-viejo"}};',
  'intercept(t,i){const o=this.s.getTokenStored();const s={...Td.header,',
  '"X-IBM-Client-Id":"cliente-tarjetas",Authorization:`bearer ${o}`},l=t.clone({setHeaders:s});}',
].join('');

const statementsLike = saldosLike.replace('"Origin-Addr":"10.0.0.1",', '');

describe('BCI app bundles (ADR-018)', () => {
  it('finds the main script a shell loads, skipping the ES5 copy', () => {
    const single = '<script src="runtime.1a.js"></script><script src="main.2b3c.js" type="module">';
    expect(mainScriptOf(single, 'x')).toBe('main.2b3c.js');
    const dual =
      '<script src="main-es2015.ab.js" type="module"></script><script src="main-es5.ab.js" nomodule>';
    expect(mainScriptOf(dual, 'x')).toBe('main-es2015.ab.js');
    expect(() => mainScriptOf('<script src="app.js"></script>', 'x')).toThrow(BankError);
  });

  it('takes the interceptor headers, resolving the production environment key', () => {
    expect(bundleHeaders(saldosLike, 'saldos')).toEqual({
      scheme: 'bearer',
      headers: {
        'content-type': 'application/json',
        'application-id': '1',
        channel: '110',
        'reference-service': 'refser',
        'reference-operation': 'refope',
        'x-ibm-client-id': 'cliente-saldos',
        'origin-addr': '10.0.0.1',
        'tracking-id': '1',
      },
    });
  });

  it('applies a spread header object, letting the interceptor override it', () => {
    const t = bundleHeaders(cardsLike, 'tarjetas');
    expect(t.scheme).toBe('bearer');
    expect(t.headers['application-id']).toBe('app-tarjetas');
    expect(t.headers['x-ibm-client-id']).toBe('cliente-tarjetas');
  });

  it('accepts an app that sets no Origin-Addr', () => {
    expect(bundleHeaders(statementsLike, 'cuentas').headers).not.toHaveProperty('origin-addr');
  });

  it('never sends Origin, which a browser does not let a page set', () => {
    expect(bundleHeaders(saldosLike, 'saldos').headers).not.toHaveProperty('origin');
  });

  it('fails closed, naming the header and never its value', () => {
    const noClient = saldosLike.replace(`,"X-IBM-Client-Id":lh.${KEY}`, '');
    expect(() => bundleHeaders(noClient, 'saldos')).toThrow(BankError);
    const noRef = saldosLike.replace('"Reference-Service":"refser",', '');
    expect(() => bundleHeaders(noRef, 'saldos')).toThrow(/reference-service/);
    const odd = saldosLike.replace('"Tracking-Id":"1"', '"Tracking-Id":"1;x=<y>"');
    try {
      bundleHeaders(odd, 'saldos');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(BankError);
      expect((err as Error).message).toContain('tracking-id');
      expect((err as Error).message).not.toContain('<y>');
    }
    const computed = saldosLike
      .replace('"Channel":"110"', '')
      .replace('Channel:"110"', 'Channel:f()');
    expect(() => bundleHeaders(computed, 'saldos')).toThrow(/channel/);
  });

  it('fails when the environment key is ambiguous or the interceptor is not unique', () => {
    const twoProd = saldosLike.replace('production:!1', 'production:!0');
    expect(() => bundleHeaders(twoProd, 'saldos')).toThrow(BankError);
    expect(() =>
      bundleHeaders(saldosLike + saldosLike.replace('refser', 'otro'), 'saldos'),
    ).toThrow(BankError);
    expect(() => bundleHeaders('const x={}', 'saldos')).toThrow(BankError);
  });

  it('builds the bearer the way the app code writes it', () => {
    const h = withToken(bundleHeaders(saldosLike, 'saldos'), 'tok');
    expect(h['authorization']).toBe('bearer tok');
    expect(h['accept']).toBe('application/json, text/plain, */*');
    expect(h['x-ibm-client-id']).toBe('cliente-saldos');
  });
});
