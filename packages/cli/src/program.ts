import { Command, CommanderError } from 'commander';
import { CtaError, type Tasks } from '@albertomarturelo/cta-core';

import { coverageWarning, human } from './render.js';

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface CliDeps {
  readonly tasks: Tasks;
  readonly version: string;
  readonly io: Io;
}

/**
 * The `cta` CLI: parse, call ONE core task, print (ADR-003). STDOUT carries only
 * the result — JSON by default, text with `--human`; everything else goes to
 * STDERR (ADR-007). The bank is always required (ADR-011).
 */
export async function run(
  argv: readonly string[],
  { tasks, version, io }: CliDeps,
): Promise<number> {
  let exitCode = 0;

  const emit = <T extends object>(
    result: T,
    humanFn: (r: T) => string,
    asHuman: boolean,
    warnFn?: (r: T) => string | undefined,
  ) => {
    if (asHuman) {
      if ('banco' in result && typeof result.banco === 'string')
        io.stderr(`banco: ${result.banco}`);
      const warning = warnFn?.(result);
      if (warning !== undefined) io.stderr(warning);
      io.stdout(humanFn(result));
    } else {
      io.stdout(JSON.stringify(result, null, 2));
    }
  };

  const fail = (err: unknown, asHuman: boolean, banco?: string) => {
    if (err instanceof CtaError) {
      exitCode = err.exitCode;
      const bancoOf = 'banco' in err && typeof err.banco === 'string' ? err.banco : banco;
      io.stderr(
        asHuman
          ? `cta: ${err.message}`
          : JSON.stringify({
              error: err.message,
              code: err.code,
              ...(bancoOf ? { banco: bancoOf } : {}),
            }),
      );
      return;
    }
    // Unexpected errors may carry request details (cookies): print the class only.
    exitCode = 1;
    const name = err instanceof Error ? err.name : 'Error';
    io.stderr(
      asHuman
        ? `cta: error inesperado (${name})`
        : JSON.stringify({ error: `Error inesperado (${name})`, code: 'UNEXPECTED' }),
    );
  };

  const exec = async <T extends object>(
    opts: { human?: boolean },
    call: () => Promise<T>,
    humanFn: (r: T) => string,
    warnFn?: (r: T) => string | undefined,
  ) => {
    // `--human` is accepted before the command (`cta --human saldo …`) or after it.
    const asHuman = opts.human === true || program.opts<{ human?: boolean }>().human === true;
    try {
      emit(await call(), humanFn, asHuman, warnFn);
    } catch (err) {
      fail(err, asHuman);
    }
  };

  const program = new Command()
    .name('cta')
    .description('Lee tus propias cuentas bancarias chilenas (solo lectura).')
    .version(version, '-V, --version', 'muestra la versión')
    .helpOption('-h, --help', 'muestra esta ayuda')
    .helpCommand('help [comando]', 'muestra la ayuda de un comando')
    .option('--human', 'salida en texto')
    .exitOverride()
    .configureOutput({
      writeOut: (s) => io.stdout(s.trimEnd()),
      writeErr: (s) => io.stderr(s.trimEnd()),
    });

  program
    .command('login')
    .description(
      'Abre la página real del banco; escribes tus credenciales allí. Nunca guarda tu clave.',
    )
    .argument('<banco>', 'banco (slug o código), p. ej. bci o 016')
    .option('--human', 'salida en texto')
    .action((banco: string, opts: { human?: boolean }) => {
      io.stderr(
        'Inicia sesión en la ventana del banco y, al llegar a tu inicio, abre tus últimos ' +
          'movimientos: así cta toma la sesión de lectura. No cierres sesión en el banco.',
      );
      return exec(opts, () => tasks.login(banco), human.login);
    });

  program
    .command('logout')
    .description('Olvida la sesión guardada de un banco (no cierra sesión en el banco).')
    .argument('<banco>', 'banco (slug o código)')
    .option('--human', 'salida en texto')
    .action((banco: string, opts: { human?: boolean }) =>
      exec(opts, () => tasks.logout(banco), human.logout),
    );

  program
    .command('bancos')
    .description('Bancos soportados y cuáles tienen sesión (guardada o en memoria, hasta cuándo).')
    .option('--human', 'salida en texto')
    .action((opts: { human?: boolean }) => exec(opts, () => tasks.bancos(), human.bancos));

  program
    .command('cuentas')
    .description('Cuentas de un banco.')
    .option('--banco <banco>', 'banco (obligatorio)')
    .option('--human', 'salida en texto')
    .action((opts: { banco?: string; human?: boolean }) =>
      exec(opts, () => tasks.cuentas(opts.banco), human.cuentas),
    );

  program
    .command('saldo')
    .description('Saldo de las cuentas de un banco, o de una con --cuenta.')
    .option('--banco <banco>', 'banco (obligatorio)')
    .option('--cuenta <cuenta>', 'número completo o últimos 4 dígitos')
    .option('--human', 'salida en texto')
    .action((opts: { banco?: string; cuenta?: string; human?: boolean }) =>
      exec(opts, () => tasks.saldo(opts.banco, opts.cuenta), human.saldo),
    );

  program
    .command('movimientos')
    .description(
      'Movimientos de un banco en un rango. Si el banco entrega menos que el rango, la salida lo dice (cobertura).',
    )
    .option('--banco <banco>', 'banco (obligatorio)')
    .option('--cuenta <cuenta>', 'número completo o últimos 4 dígitos')
    .option('--desde <fecha>', 'fecha inicial, AAAA-MM-DD (incluida)')
    .option('--hasta <fecha>', 'fecha final, AAAA-MM-DD (incluida)')
    .option('--human', 'salida en texto')
    .action(
      (opts: {
        banco?: string;
        cuenta?: string;
        desde?: string;
        hasta?: string;
        human?: boolean;
      }) =>
        exec(
          opts,
          () =>
            tasks.movimientos(opts.banco, {
              ...(opts.cuenta === undefined ? {} : { cuenta: opts.cuenta }),
              ...(opts.desde === undefined ? {} : { desde: opts.desde }),
              ...(opts.hasta === undefined ? {} : { hasta: opts.hasta }),
            }),
          human.movimientos,
          (r) => coverageWarning(r.cobertura),
        ),
    );

  try {
    await program.parseAsync([...argv], { from: 'user' });
  } catch (err) {
    if (err instanceof CommanderError) {
      // --help and --version exit 0; any other parse problem is a usage error.
      return err.code === 'commander.helpDisplayed' ||
        err.code === 'commander.version' ||
        err.code === 'commander.help'
        ? 0
        : 2;
    }
    fail(err, false);
  }
  return exitCode;
}
