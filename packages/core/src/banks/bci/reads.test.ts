import { describe, expect, it } from 'vitest';

import { BankBlocked, BankError, NotAuthenticated } from '../../errors/errors.js';
import {
  appHeaders,
  grantExpiry,
  isAppUrl,
  judgeApiAnswer,
  parseCuentas,
  parseMovimientos,
  parseSaldo,
} from './reads.js';

// Synthetic shapes of the contract (docs/bank-contract/bci.md); invented values.
describe('BCI reads', () => {
  it('reads accounts from the app answer, never needing the RUT', () => {
    expect(
      parseCuentas({
        cuentas: [
          { numero: '00001111', tipo: 'Corriente' },
          { numero: '00002222', tipo: 'Corriente' },
        ],
      }),
    ).toEqual([
      { banco: 'bci', numero: '00001111', tipo: 'Corriente', moneda: 'CLP' },
      { banco: 'bci', numero: '00002222', tipo: 'Corriente', moneda: 'CLP' },
    ]);
  });

  it('rejects an unexpected account shape instead of guessing', () => {
    expect(() => parseCuentas({ accounts: [] })).toThrow(BankError);
    expect(() => parseCuentas({ cuentas: [{ numero: 1111 }] })).toThrow(BankError);
    expect(() => parseCuentas({ cuentas: [{ numero: 'abc' }] })).toThrow(BankError);
  });

  it('reads a balance as integer pesos', () => {
    expect(
      parseSaldo({
        numero: '00001111',
        tipo: 'CCT',
        estado: 'VIG',
        saldoContable: 1500,
        saldoDisponible: 1200,
        retenciones: 300,
        lineaSobregiro: { montoUtilizado: 0, saldoDisponible: 0 },
      }),
    ).toEqual({
      banco: 'bci',
      cuenta: '00001111',
      disponible: { moneda: 'CLP', monto: 1200 },
      contable: { moneda: 'CLP', monto: 1500 },
      retenciones: { moneda: 'CLP', monto: 300 },
    });
  });

  it('omits retenciones when the bank does not send it; rejects non-integer pesos', () => {
    const base = { numero: '00001111', saldoContable: 10, saldoDisponible: 10 };
    expect(parseSaldo(base)).not.toHaveProperty('retenciones');
    expect(() => parseSaldo({ ...base, saldoDisponible: 10.5 })).toThrow(BankError);
    expect(() => parseSaldo({ ...base, saldoContable: '10' })).toThrow(BankError);
  });

  it('recognizes the saldos app only on its own host and path', () => {
    const app = 'fe-saldosultimosmovpersonas';
    expect(isAppUrl('https://personas.bci.cl/nuevaWeb/fe-saldosultimosmovpersonas/?t=x', app)).toBe(
      true,
    );
    expect(isAppUrl('https://www.bci.cl/nuevaWeb/fe-saldosultimosmovpersonas/', app)).toBe(false);
    expect(isAppUrl('https://personas.bci.cl/nuevaWeb/fe-otra/', app)).toBe(false);
  });

  it('accepts the app under /modernizacion/ as well (observed 2026-09-28)', () => {
    const app = 'fe-saldosultimosmovpersonas';
    expect(
      isAppUrl('https://personas.bci.cl/modernizacion/fe-saldosultimosmovpersonas/', app),
    ).toBe(true);
    expect(isAppUrl('https://personas.bci.cl/otra/fe-saldosultimosmovpersonas/', app)).toBe(false);
  });

  // Built at run time from parts, so no token-shaped literal sits in the source (ADR-009).
  const b64url = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const bearer = (claims: unknown) => ['Bearer h', b64url(claims), 's'].join('.');

  it('reads only exp from the bearer', () => {
    expect(grantExpiry(bearer({ exp: 1_900_000_000, otro: 'x' }))).toBe(1_900_000_000);
    expect(() => grantExpiry(bearer({ otro: 'x' }))).toThrow(BankError);
    expect(() => grantExpiry('Bearer synthetic')).toThrow(BankError);
    expect(() => grantExpiry('')).toThrow(BankError);
  });

  const json = (status: number, body: unknown) => ({
    status,
    contentType: 'application/json;charset=UTF-8',
    body: JSON.stringify(body),
  });

  it('returns the JSON of a 200 answer', () => {
    expect(judgeApiAnswer(json(200, { numero: '00001111' }))).toEqual({ numero: '00001111' });
  });

  it('maps 401 (seen past exp) to NotAuthenticated', () => {
    expect(() => judgeApiAnswer(json(401, { error: 'invalid_token' }))).toThrow(NotAuthenticated);
  });

  it('treats a challenge, a 403 or a non-JSON 200 as a block, with the page title verbatim', () => {
    const page = (status: number, html: string) => ({
      status,
      contentType: 'text/html',
      body: html,
    });
    const blocked = (a: Parameters<typeof judgeApiAnswer>[0]) => {
      try {
        judgeApiAnswer(a);
      } catch (err) {
        return err;
      }
      return undefined;
    };
    const e1 = blocked(page(403, '<html><title> Acceso  denegado </title></html>'));
    expect(e1).toBeInstanceOf(BankBlocked);
    expect((e1 as BankBlocked).message).toBe('Acceso denegado');
    expect(blocked(page(200, '<html>x /cdn-cgi/challenge-platform/ y</html>'))).toBeInstanceOf(
      BankBlocked,
    );
    expect(blocked(page(200, '<html>sin título</html>'))).toBeInstanceOf(BankBlocked);
    expect(blocked(json(403, { error: 'forbidden' }))).toBeInstanceOf(BankBlocked);
  });

  it('keeps the bank message of any other error, and rejects unreadable bodies', () => {
    expect(() => judgeApiAnswer(json(500, { mensaje: 'Servicio no disponible' }))).toThrow(
      'Servicio no disponible',
    );
    expect(() => judgeApiAnswer(json(502, {}))).toThrow('El banco respondió 502.');
    expect(() =>
      judgeApiAnswer({ status: 200, contentType: 'application/json', body: 'no json' }),
    ).toThrow(BankError);
  });

  it('repeats only the headers the app sets, and requires its authorization', () => {
    const fromApp = {
      authorization: 'Bearer synthetic',
      'application-id': '1',
      channel: '110',
      'x-ibm-client-id': 'synthetic-client',
      'content-type': 'application/json',
      'user-agent': 'browser adds it',
      origin: 'browser adds it',
      'content-length': '20',
      ':path': '/pseudo',
    };
    expect(appHeaders(fromApp)).toEqual({
      authorization: 'Bearer synthetic',
      'application-id': '1',
      channel: '110',
      'x-ibm-client-id': 'synthetic-client',
      'content-type': 'application/json',
    });
    expect(() => appHeaders({ channel: '110' })).toThrow(BankError);
  });

  it('signs movements from tipo: C is a cargo, A an abono (inferred, contract)', () => {
    const json = {
      movimientos: [
        {
          fechaMovimiento: '2026-01-31T00:00:00',
          idMovimiento: 'x',
          glosa: 'Compra ficticia',
          monto: '2500.00',
          serie: '000000000000000001',
          tipo: 'C',
        },
        {
          fechaMovimiento: '2026-01-30T00:00:00.000',
          glosa: 'Abono ficticio',
          monto: '100.00',
          tipo: 'A',
        },
      ],
      ordenadoPor: 'FECHA_TRANSACCION',
    };
    expect(parseMovimientos(json, '00001111')).toEqual([
      {
        banco: 'bci',
        cuenta: '00001111',
        fecha: '2026-01-31',
        descripcion: 'Compra ficticia',
        monto: { moneda: 'CLP', monto: -2500 },
        tipo: 'cargo',
      },
      {
        banco: 'bci',
        cuenta: '00001111',
        fecha: '2026-01-30',
        descripcion: 'Abono ficticio',
        monto: { moneda: 'CLP', monto: 100 },
        tipo: 'abono',
      },
    ]);
  });

  it('never guesses a sign, a date or an amount', () => {
    const one = (m: Record<string, unknown>) => ({
      movimientos: [
        { fechaMovimiento: '2026-01-31T00:00:00', glosa: 'x', monto: '1.00', tipo: 'C', ...m },
      ],
    });
    expect(() => parseMovimientos(one({ tipo: 'X' }), '1')).toThrow(/tipo de movimiento 'X'/);
    expect(() => parseMovimientos(one({ tipo: 'toString' }), '1')).toThrow(BankError);
    expect(() => parseMovimientos(one({ tipo: 7 }), '1')).toThrow(BankError);
    expect(() => parseMovimientos(one({ monto: '-1.00' }), '1')).toThrow(BankError);
    expect(() => parseMovimientos(one({ monto: '1.50' }), '1')).toThrow(BankError);
    expect(() => parseMovimientos(one({ fechaMovimiento: 'ayer' }), '1')).toThrow(BankError);
    expect(() => parseMovimientos({ items: [] }, '1')).toThrow(BankError);
  });
});
