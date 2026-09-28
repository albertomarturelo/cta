import { describe, expect, it } from 'vitest';

import { money, parseDecimalAmount, parseEsClAmount } from './money.js';

describe('money', () => {
  it('accepts safe integers only', () => {
    expect(money('CLP', 1500)).toEqual({ moneda: 'CLP', monto: 1500 });
    expect(() => money('CLP', 1.5)).toThrow(RangeError);
    expect(() => money('CLP', Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});

describe('parseDecimalAmount', () => {
  it('reads machine decimals into minor units', () => {
    expect(parseDecimalAmount('1000.00', 'CLP')).toEqual({ moneda: 'CLP', monto: 1000 });
    expect(parseDecimalAmount('-15990', 'CLP')).toEqual({ moneda: 'CLP', monto: -15990 });
    expect(parseDecimalAmount('12.5', 'USD')).toEqual({ moneda: 'USD', monto: 1250 });
    expect(parseDecimalAmount('0.00', 'CLP').monto).toBe(0);
  });

  it('refuses precision the currency cannot hold', () => {
    expect(() => parseDecimalAmount('10.50', 'CLP')).toThrow(RangeError);
    expect(() => parseDecimalAmount('1.005', 'USD')).toThrow(RangeError);
  });

  it('rejects anything that is not a plain decimal', () => {
    for (const bad of ['', 'abc', '1,000.00', '1.000.000', '$100']) {
      expect(() => parseDecimalAmount(bad, 'CLP')).toThrow(SyntaxError);
    }
  });
});

describe('parseEsClAmount', () => {
  it('reads amounts as Chilean pages render them', () => {
    expect(parseEsClAmount('$ 1.234.567', 'CLP').monto).toBe(1234567);
    expect(parseEsClAmount('1.000.000', 'CLP').monto).toBe(1000000);
    expect(parseEsClAmount('$0', 'CLP').monto).toBe(0);
    expect(parseEsClAmount('US$ 1.234,56', 'USD').monto).toBe(123456);
  });

  it('keeps the sign wherever it is written', () => {
    expect(parseEsClAmount('-$ 2.500', 'CLP').monto).toBe(-2500);
    expect(parseEsClAmount('$ -2.500', 'CLP').monto).toBe(-2500);
    expect(() => parseEsClAmount('-$ -2.500', 'CLP')).toThrow(SyntaxError);
  });

  it('rejects a US$ amount where another currency is expected', () => {
    expect(() => parseEsClAmount('US$ 100', 'CLP')).toThrow(/in USD, expected CLP/);
  });

  it('rejects malformed grouping', () => {
    for (const bad of ['1.23.456', '$ 12.34', 'mil pesos']) {
      expect(() => parseEsClAmount(bad, 'CLP')).toThrow(SyntaxError);
    }
  });
});
