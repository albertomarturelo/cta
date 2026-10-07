import { describe, expect, it } from 'vitest';

import { BankBlocked, BankError, NoSuchCard, NotAuthenticated } from '../../errors/errors.js';
import type { HttpAnswer, HttpClient, ReadGrant } from '../../seams/seams.js';
import { BciDriver } from './bci-driver.js';

// Synthetic grant and answers (contract shapes, invented values).
const grant: ReadGrant = {
  banco: 'bci',
  headers: { authorization: 'Bearer synthetic', 'x-ibm-client-id': 'synthetic-client' },
  expiresAt: 1_900_000_000,
  cuentas: [
    { banco: 'bci', numero: '00001111', tipo: 'Corriente', moneda: 'CLP' },
    { banco: 'bci', numero: '00002222', tipo: 'Corriente', moneda: 'CLP' },
  ],
};
const auth = { kind: 'grant' as const, grant };

// The cards app's own headers differ from the saldos app's (contract); invented values.
const cardsHeaders = { authorization: 'Bearer synthetic', 'application-id': 'cards-app' };
const card = (cardKey: string, accountKey: string, last4: string) => ({
  cardKey,
  accountKey,
  label: `Tarjeta Ficticia **** ${last4}`,
  last4,
});
const withCards: ReadGrant = {
  ...grant,
  tarjetas: {
    headers: cardsHeaders,
    cards: [
      card('1001', '900001', '1111'),
      card('1002', '900002', '2222'),
      card('1003', '900002', '3333'),
    ],
  },
};
const cardsAuth = { kind: 'grant' as const, grant: withCards };
const informacion = {
  cupoNacional: 1000,
  cupoUtilizadoNacional: 400,
  cupoDisponibleNacional: 600,
  cupoInternacional: 100,
  cupoUtilizadoInternacional: 0.5,
  cupoDisponibleInternacional: 99.5,
  fechaProximaFacturacion: '20/10/2026',
  errorNacional: null,
  errorNoFacturados: null,
  facturadosNacionales: [
    { monto: 100, descripcion: 'COMERCIO', fecha: '3/9/2026', tipo: 'Titular **** 1111' },
  ],
  noFacturadosNacional: [],
  facturadosInternacionales: null,
  noFacturadosInternacional: [],
};

class FakeHttp implements HttpClient {
  readonly sent: { url: string; headers: Readonly<Record<string, string>>; body: unknown }[] = [];
  constructor(private readonly answer: (url: string, body: unknown) => HttpAnswer) {}
  async get(url: string, headers: Readonly<Record<string, string>>) {
    this.sent.push({ url, headers, body: undefined });
    return this.answer(url, undefined);
  }
  async post(url: string, headers: Readonly<Record<string, string>>, body: string) {
    const parsed: unknown = JSON.parse(body);
    this.sent.push({ url, headers, body: parsed });
    return this.answer(url, parsed);
  }
}

const ok = (body: unknown): HttpAnswer => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});
const saldo = (numero: string) =>
  ok({ numero, saldoDisponible: 1000, saldoContable: 1200, retenciones: null });

describe('BciDriver', () => {
  it('identifies itself and reads over HTTP (ADR-015)', () => {
    const d = new BciDriver();
    expect([d.slug, d.code, d.readMode]).toEqual(['bci', '016', 'http']);
  });

  it('lists the accounts the app got at login, with no request', async () => {
    const http = new FakeHttp(() => ok({}));
    const d = new BciDriver({ http });
    expect((await d.cuentas(auth)).map((c) => c.numero)).toEqual(['00001111', '00002222']);
    expect(http.sent).toEqual([]);
  });

  it('reads each balance with exactly the grant headers', async () => {
    const http = new FakeHttp((_url, body) =>
      saldo((body as { cuentaNumero: string }).cuentaNumero),
    );
    const d = new BciDriver({ http });
    const out = await d.saldos(auth, '2222');
    expect(out.map((s) => [s.cuenta, s.disponible.monto])).toEqual([['00002222', 1000]]);
    expect(http.sent).toHaveLength(1);
    expect(http.sent[0]?.headers).toEqual(grant.headers);
    expect(http.sent[0]?.body).toEqual({ cuentaNumero: '00002222' });
  });

  it('reads movements per account and reports coverage', async () => {
    const http = new FakeHttp(() =>
      ok({
        movimientos: [
          { fechaMovimiento: '2026-01-10', glosa: 'Compra', monto: '100.00', tipo: 'C' },
          { fechaMovimiento: '2026-01-05', glosa: 'Abono', monto: '50.00', tipo: 'A' },
        ],
      }),
    );
    const d = new BciDriver({ http });
    const out = await d.movimientos(auth, { desde: '2026-01-06' }, '1111');
    expect(out.movimientos.map((m) => [m.fecha, m.monto.monto])).toEqual([['2026-01-10', -100]]);
    expect(out.cobertura).toHaveLength(1);
    expect(http.sent[0]?.body).toEqual({ numeroCuenta: '00001111' });
  });

  it('reads each card account once, with the cards app headers and its own body keys', async () => {
    const http = new FakeHttp(() => ok(informacion));
    const d = new BciDriver({ http });
    const out = await d.tarjetas(cardsAuth, {});
    expect(out.tarjetas.map((t) => [t.tarjeta, t.adicionales])).toEqual([
      ['1111', undefined],
      ['2222', ['3333']],
    ]);
    expect(out.movimientos).toBeUndefined();
    expect(http.sent.map((r) => r.body)).toEqual([
      { numeroCuenta: '900001', numeroTarjeta: '1001' },
      { numeroCuenta: '900002', numeroTarjeta: '1002' },
    ]);
    expect(http.sent.every((r) => r.headers === cardsHeaders)).toBe(true);
    // Keys are request keys only: never in the result.
    expect(JSON.stringify(out)).not.toMatch(/900001|900002|1001|1002/);
  });

  it('reads one account by any of its cards, with movements when asked', async () => {
    const http = new FakeHttp(() => ok(informacion));
    const d = new BciDriver({ http });
    const out = await d.tarjetas(cardsAuth, { tarjeta: '3333', movimientos: true });
    expect(out.tarjetas.map((t) => t.tarjeta)).toEqual(['2222']);
    expect(out.movimientos?.map((m) => [m.fecha, m.monto.monto, m.facturado])).toEqual([
      ['2026-09-03', -100, true],
    ]);
    expect(http.sent).toHaveLength(1);
    await expect(d.tarjetas(cardsAuth, { tarjeta: '9999' })).rejects.toBeInstanceOf(NoSuchCard);
    expect(http.sent).toHaveLength(1);
  });

  it('says why cards are missing instead of reading without their headers', async () => {
    const http = new FakeHttp(() => ok(informacion));
    const d = new BciDriver({ http });
    const failed = {
      kind: 'grant' as const,
      grant: { ...grant, tarjetas: { fallo: 'menú cambiado' } },
    };
    await expect(d.tarjetas(failed, {})).rejects.toThrow('menú cambiado');
    await expect(d.tarjetas(auth, {})).rejects.toBeInstanceOf(BankError);
    expect(http.sent).toEqual([]);
  });

  it('stops at the first expired or blocked answer, never retrying', async () => {
    const expired = new FakeHttp(() => ({
      status: 401,
      contentType: 'application/json',
      body: '{}',
    }));
    await expect(new BciDriver({ http: expired }).saldos(auth)).rejects.toBeInstanceOf(
      NotAuthenticated,
    );
    expect(expired.sent).toHaveLength(1);

    const blocked = new FakeHttp(() => ({
      status: 403,
      contentType: 'text/html',
      body: '<html/>',
    }));
    await expect(new BciDriver({ http: blocked }).saldos(auth)).rejects.toBeInstanceOf(BankBlocked);
    expect(blocked.sent).toHaveLength(1);
  });

  it('reports a network failure as a bank error, once', async () => {
    let calls = 0;
    const down: HttpClient = {
      get: () => Promise.reject(new TypeError('unused')),
      post: () => {
        calls += 1;
        return Promise.reject(new TypeError('fetch failed'));
      },
    };
    await expect(new BciDriver({ http: down }).saldos(auth)).rejects.toThrow(
      'No se pudo contactar al banco (TypeError).',
    );
    expect(calls).toBe(1);
  });

  it('treats stored cookies as no session in HTTP mode', async () => {
    const d = new BciDriver({ http: new FakeHttp(() => ok({})) });
    const cookies = {
      kind: 'cookies' as const,
      session: { banco: 'bci', cookies: [], savedAt: 'x' },
    };
    await expect(d.saldos(cookies)).rejects.toBeInstanceOf(NotAuthenticated);
  });

  describe('grant from the orchestrator token (ADR-018)', () => {
    // Built at run time from parts, so no token-shaped literal sits in the source (ADR-009).
    const b64url = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const token = ['h', b64url({ exp: 1_900_000_000 }), 's'].join('.');
    // A synthetic interceptor per app, in the shape the bundles use (invented values).
    const key = ['api', 'Key'].join('');
    const bundle = (appId: string, client: string) =>
      `x={production:!0,${key}:"${client}"};intercept(t,e){const i=t.clone({setHeaders:{` +
      `"Application-Id":"${appId}",Authorization:\`bearer \${r}\`,Channel:"110",` +
      `"Content-Type":"application/json","Reference-Operation":"op","Reference-Service":"svc",` +
      `"Tracking-Id":"1","X-IBM-Client-Id":x.${key}}})}`;
    const shell = '<script src="main.abc.js" type="module"></script>';
    const text = (body: string): HttpAnswer => ({ status: 200, contentType: 'text/html', body });
    const site = (overrides: Record<string, HttpAnswer> = {}) =>
      new FakeHttp((url) => {
        const hit = Object.entries(overrides).find(([part]) => url.includes(part));
        if (hit) return hit[1];
        const app = /\/(fe-[\w]+)\//.exec(url)?.[1] ?? '';
        if (url.endsWith('/')) {
          if (url.includes('apilocal')) {
            return ok([
              {
                numeroTarjeta: '1001',
                numeroDeCuenta: '900001',
                descripcionLogo: '1',
                tipoCliente: 'P',
                descripcionSelectorTarjeta: 'Tarjeta Ficticia **** 1111',
              },
            ]);
          }
          return text(shell);
        }
        if (url.endsWith('main.abc.js')) return text(bundle(app, `cliente-${app}`));
        if (url.includes('SolicitarClienteCuentas')) {
          return ok({
            cuentas: [
              {
                numeroDeCuenta: '00001111',
                tipoCuenta: 'CCT',
                fechaApertura: 'x',
                estadoCuenta: 'VIG',
              },
            ],
          });
        }
        return { status: 404, contentType: 'text/plain', body: '' };
      });

    it('builds every app header set from its bundle, and lists accounts and cards', async () => {
      const http = site();
      const g = await new BciDriver({ http }).grantFromToken(token);
      expect(g.expiresAt).toBe(1_900_000_000);
      expect(g.cuentas.map((c) => c.numero)).toEqual(['00001111']);
      expect(g.headers['application-id']).toBe('fe-saldosultimosmovpersonas');
      expect(g.headers['authorization']).toBe(`bearer ${token}`);
      const cards = g.tarjetas;
      expect(cards && 'headers' in cards && cards.headers['application-id']).toBe(
        'fe-mismovimientos',
      );
      // bundles fetched bare; the accounts list with the statements app's own headers
      const bare = http.sent.filter((r) => !r.url.includes('apilocal'));
      expect(bare.every((r) => Object.keys(r.headers).length === 0)).toBe(true);
      const listing = http.sent.find((r) => r.url.includes('SolicitarClienteCuentas'));
      expect(listing?.headers['application-id']).toBe('fe-cartolashistoricaspersonas');
      expect(JSON.stringify(http.sent)).not.toMatch(/rut/i);
    });

    it('keeps the login when only the cards app fails, saying why', async () => {
      const http = site({ 'fe-mismovimientos/main': text('sin interceptor') });
      const g = await new BciDriver({ http }).grantFromToken(token);
      expect(g.cuentas).toHaveLength(1);
      expect(g.tarjetas).toEqual({ fallo: expect.stringContaining('tarjetas') });
    });

    it('fails the login when the accounts or saldos app cannot be read, never retrying', async () => {
      const blocked = site({
        'fe-saldosultimosmovpersonas/': { status: 403, contentType: 'text/html', body: '' },
      });
      await expect(new BciDriver({ http: blocked }).grantFromToken(token)).rejects.toBeInstanceOf(
        BankBlocked,
      );
      expect(blocked.sent).toHaveLength(1);
      const expired = site({
        SolicitarClienteCuentas: { status: 401, contentType: 'application/json', body: '{}' },
      });
      await expect(new BciDriver({ http: expired }).grantFromToken(token)).rejects.toBeInstanceOf(
        NotAuthenticated,
      );
    });
  });
});
