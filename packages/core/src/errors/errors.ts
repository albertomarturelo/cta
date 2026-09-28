/** Base of every error `cta-core` raises on purpose; surfaces map `exitCode`. */
export class CtaError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly exitCode: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The bank argument is missing or names no registered driver (ADR-011). Usage error. */
export class UnknownBank extends CtaError {
  constructor(
    readonly input: string | undefined,
    readonly supported: readonly string[],
  ) {
    super(
      input === undefined || input.trim() === ''
        ? `--banco es obligatorio. Soportados: ${supported.join(', ') || '(ninguno)'}.`
        : `Banco desconocido '${input}'. Soportados: ${supported.join(', ') || '(ninguno)'}.`,
      'UNKNOWN_BANK',
      2,
    );
  }
}

/** No usable session for the bank: never logged in, or expired (ADR-006). */
export class NotAuthenticated extends CtaError {
  constructor(readonly banco: string) {
    super(
      `No hay sesión activa para '${banco}'. Ejecuta: cta login ${banco}`,
      'NOT_AUTHENTICATED',
      3,
    );
  }
}

/**
 * The bank blocked or challenged the request. The bank's own words are kept
 * verbatim and nothing is retried (ADR-004).
 */
export class BankBlocked extends CtaError {
  constructor(
    readonly banco: string,
    readonly bankMessage: string,
  ) {
    super(bankMessage, 'BANK_BLOCKED', 4);
  }
}

/** The bank answered with an error page or an unexpected shape; message verbatim. */
export class BankError extends CtaError {
  constructor(
    readonly banco: string,
    readonly bankMessage: string,
    options?: ErrorOptions,
  ) {
    super(bankMessage, 'BANK_ERROR', 5, options);
  }
}

/** `--cuenta` matches no account of the bank. Usage error. */
export class NoSuchAccount extends CtaError {
  constructor(
    readonly banco: string,
    readonly selector: string,
  ) {
    super(
      `Ninguna cuenta de '${banco}' coincide con '${selector}'. Ejecuta: cta cuentas --banco ${banco}`,
      'NO_SUCH_ACCOUNT',
      2,
    );
  }
}

/** `--cuenta` matches more than one account; the full number is needed. Usage error. */
export class AmbiguousAccount extends CtaError {
  constructor(
    readonly banco: string,
    readonly selector: string,
    readonly matches: number,
  ) {
    super(
      `'${selector}' coincide con ${matches} cuentas de '${banco}'. Usa el número completo.`,
      'AMBIGUOUS_ACCOUNT',
      2,
    );
  }
}

/** `--desde`/`--hasta` is not a calendar date, or the range is reversed. Usage error. */
export class InvalidDateRange extends CtaError {
  constructor(detail: string) {
    super(`Rango de fechas inválido: ${detail}. Usa AAAA-MM-DD.`, 'INVALID_DATE_RANGE', 2);
  }
}

/** The login did not finish: the window was closed or the wait timed out. No session. */
export class LoginCancelled extends CtaError {
  constructor(
    readonly banco: string,
    reason: 'closed' | 'timeout',
  ) {
    super(
      reason === 'closed'
        ? `Login en '${banco}' cancelado: se cerró la ventana antes de entrar.`
        : `Login en '${banco}' cancelado: se agotó el tiempo de espera.`,
      'LOGIN_CANCELLED',
      3,
    );
  }
}

/** The bank's driver does not implement this read yet. */
export class NotYetSupported extends CtaError {
  constructor(
    readonly banco: string,
    operation: string,
    tracking: string,
  ) {
    super(
      `'${banco}' aún no soporta '${operation}'. Seguimiento: ${tracking}.`,
      'NOT_YET_SUPPORTED',
      6,
    );
  }
}

/** Playwright's Chromium is not installed on this machine. */
export class BrowserMissing extends CtaError {
  constructor() {
    super(
      'Falta el navegador. Ejecuta una vez: npx playwright install chromium',
      'BROWSER_MISSING',
      7,
    );
  }
}
