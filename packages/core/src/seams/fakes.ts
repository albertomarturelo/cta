import { matchCuenta } from '../accounts/match-cuenta.js';
import { inRange } from '../movements/coverage.js';
import { NoSuchCard } from '../errors/errors.js';
import type {
  Cartola,
  Cobertura,
  Cuenta,
  EstadoTarjetas,
  Movimiento,
  Saldo,
} from '../domain/types.js';
import type {
  AuditEntry,
  AuditSink,
  BankDriver,
  Clock,
  DateRange,
  LoginOutcome,
  ReadAuth,
  ReadGrant,
  SessionStore,
  StoredCookie,
  StoredSession,
  TarjetasQuery,
} from './seams.js';

/** In-memory fakes of every seam, for tests. Synthetic data only. */

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, StoredSession>();

  async get(banco: string): Promise<StoredSession | undefined> {
    return this.sessions.get(banco);
  }

  async put(session: StoredSession): Promise<void> {
    this.sessions.set(session.banco, session);
  }

  async delete(banco: string): Promise<void> {
    this.sessions.delete(banco);
  }

  async list(): Promise<readonly string[]> {
    return [...this.sessions.keys()].sort();
  }
}

export class MemoryAuditSink implements AuditSink {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export interface FakeBankData {
  readonly cookies?: readonly StoredCookie[];
  /** Makes the fake an HTTP-mode driver whose login yields this grant (ADR-015). */
  readonly grant?: ReadGrant;
  readonly cuentas?: readonly Cuenta[];
  readonly saldos?: readonly Saldo[];
  readonly movimientos?: readonly Movimiento[];
  /** Card accounts and all their movements; the fake filters them like a driver (ADR-017). */
  readonly tarjetas?: EstadoTarjetas;
  /** Thrown by every read, e.g. a `NotAuthenticated` or `BankBlocked`. */
  readonly failWith?: Error;
  /** Overrides the coverage the fake reports, e.g. an incomplete one (ADR-014). */
  readonly cobertura?: readonly Cobertura[];
  /** Login ends only once this settles, like a user still typing (ADR-013). */
  readonly loginWaitsFor?: Promise<unknown>;
}

/** A driver that returns canned synthetic data and records the calls it gets. */
export class FakeBankDriver implements BankDriver {
  readonly readMode: 'headless' | 'http';
  readonly calls: string[] = [];

  constructor(
    readonly slug: string,
    readonly code: string,
    readonly name: string,
    private readonly data: FakeBankData = {},
  ) {
    this.readMode = data.grant ? 'http' : 'headless';
  }

  async login(): Promise<LoginOutcome> {
    this.calls.push('login');
    await this.data.loginWaitsFor;
    if (this.data.failWith) throw this.data.failWith;
    if (this.data.grant) return { kind: 'grant', grant: this.data.grant };
    return { kind: 'cookies', cookies: this.data.cookies ?? [] };
  }

  /** The auth kind each read got, e.g. `grant`, to check the task wiring. */
  readonly auths: ReadAuth['kind'][] = [];

  async cuentas(auth: ReadAuth): Promise<readonly Cuenta[]> {
    this.auths.push(auth.kind);
    this.calls.push('cuentas');
    if (this.data.failWith) throw this.data.failWith;
    return this.data.cuentas ?? [];
  }

  async saldos(auth: ReadAuth, cuenta?: string): Promise<readonly Saldo[]> {
    this.auths.push(auth.kind);
    this.calls.push(`saldos:${cuenta ?? '*'}`);
    if (this.data.failWith) throw this.data.failWith;
    const all = this.data.saldos ?? [];
    if (cuenta === undefined) return all;
    const numero = matchCuenta(
      this.slug,
      all.map((s) => s.cuenta),
      cuenta,
    );
    return all.filter((s) => s.cuenta === numero);
  }

  async movimientos(auth: ReadAuth, range: DateRange, cuenta?: string): Promise<Cartola> {
    this.auths.push(auth.kind);
    this.calls.push(`movimientos:${range.desde ?? ''}..${range.hasta ?? ''}:${cuenta ?? '*'}`);
    if (this.data.failWith) throw this.data.failWith;
    const all = this.data.movimientos ?? [];
    const cuentas = [...new Set(all.map((m) => m.cuenta))];
    const selected = cuenta === undefined ? cuentas : [matchCuenta(this.slug, cuentas, cuenta)];
    const movimientos = all.filter((m) => selected.includes(m.cuenta) && inRange(m.fecha, range));
    // A fake reads by range, like a bank with a real date search: always complete.
    const cobertura =
      this.data.cobertura ??
      selected.map((c) => {
        const fechas = movimientos
          .filter((m) => m.cuenta === c)
          .map((m) => m.fecha)
          .sort();
        return {
          cuenta: c,
          ...(fechas.length ? { desde: fechas[0]!, hasta: fechas[fechas.length - 1]! } : {}),
          completo: true,
        };
      });
    return { movimientos, cobertura };
  }

  async tarjetas(auth: ReadAuth, query: TarjetasQuery): Promise<EstadoTarjetas> {
    this.auths.push(auth.kind);
    this.calls.push(`tarjetas:${query.tarjeta ?? '*'}:${query.movimientos === true ? 'mov' : '-'}`);
    if (this.data.failWith) throw this.data.failWith;
    const all = this.data.tarjetas ?? { tarjetas: [] };
    const tarjetas =
      query.tarjeta === undefined
        ? all.tarjetas
        : all.tarjetas.filter((t) =>
            [t.tarjeta, ...(t.adicionales ?? [])].includes(query.tarjeta!),
          );
    if (query.tarjeta !== undefined && tarjetas.length !== 1) {
      throw new NoSuchCard(this.slug, query.tarjeta, tarjetas.length > 1);
    }
    if (query.movimientos !== true) return { tarjetas };
    const own = new Set(tarjetas.flatMap((t) => [t.tarjeta, ...(t.adicionales ?? [])]));
    return { tarjetas, movimientos: (all.movimientos ?? []).filter((m) => own.has(m.tarjeta)) };
  }
}
