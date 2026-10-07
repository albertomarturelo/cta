/**
 * BCI's observed wire contract for login — the ONLY place its hostnames and
 * markers live (CONVENTIONS). Every value is first-hand observed and recorded in
 * `docs/bank-contract/bci.md` (ADR-004).
 */
export const BCI = {
  slug: 'bci',
  code: '016',
  name: 'Banco de Crédito e Inversiones',

  // observed at https://www.bci.cl/corporativo/banco-en-linea/personas on 2026-09-24
  // (the "Banco en línea personas" page where the user types RUT and clave)
  loginEntryUrl: 'https://www.bci.cl/corporativo/banco-en-linea/personas',

  // observed at https://www.bci.cl/LoginJSFGenerico on 2026-09-24
  // (credentials form POST target; also where the login 500 page is served)
  appHost: 'www.bci.cl',
  loginPostPath: '/LoginJSFGenerico',

  // observed at https://www.bci.cl/cl/bci/aplicaciones/contenido.jsf on 2026-09-24
  // (JSF landing after a successful login, then the miBanco home)
  homePaths: [
    '/cl/bci/aplicaciones/contenido.jsf',
    '/cl/bci/aplicaciones/menu/vistas/inicio/miBanco.jsf',
  ],

  // observed at https://personas.bci.cl/web/fe-orq-mo-personas-re-v1-7/home on 2026-09-28
  // (the landing after the trusted-device step moved to an orchestrator app, which
  // then routes to .../comp/mi_banco/cl/bci/aplicaciones/menu/vistas/inicio/miBanco).
  // The version segment ("v1-7") is expected to change, so it is not pinned.
  orchestrator: {
    host: 'personas.bci.cl',
    pathPrefix: '/web/fe-orq-mo-personas-re-v',
    homeSuffix: '/home',
    miBancoSegment: '/comp/mi_banco/',
    // observed on personas.bci.cl on 2026-09-28: the only session cookie at this
    // landing — httpOnly, persistent; JSESSIONID on www.bci.cl no longer exists
    sessionCookie: '__Host-SESSIONID',
  },

  // observed on www.bci.cl on 2026-09-24: set by the credentials POST, httpOnly, secure
  sessionCookie: 'JSESSIONID',

  // observed at https://www.bci.cl/cl/bci/aplicaciones/menu/vistas/inicio/miBanco.jsf on 2026-09-24
  // (a 403 carrying these when the bank challenged a headless restore)
  challengeMarkers: ['__cf_chl_rt_tk', '/cdn-cgi/challenge-platform/'],

  // Only the bank's own cookies are stored; trackers are dropped.
  cookieDomainSuffix: 'bci.cl',

  // observed at https://personas.bci.cl/api/api-auth-personas/v1/connectors/td on
  // 2026-09-29 and 2026-10-07: right after the landing the orchestrator itself
  // POSTs here (session cookie, no bearer) and gets {cpi, access_token}; that
  // token is the bearer of every apilocal read (ADR-018). Answered 3 s after the
  // landing on 2026-10-07.
  tokenCall: { host: 'personas.bci.cl', path: '/api/api-auth-personas/v1/connectors/td' },

  // observed at these URLs on 2026-10-07: each app's public shell, served with
  // no session; it names the app's main.<hash>.js, whose HTTP interceptor holds
  // the app's own API headers (ADR-018). Headers come from there at every login.
  apps: {
    // the balances-and-latest-movements app (reads saldo and movimientos)
    saldos: 'https://personas.bci.cl/modernizacion/fe-saldosultimosmovpersonas/',
    // the statements app: its SolicitarClienteCuentas lists accounts with no RUT
    cuentas: 'https://personas.bci.cl/nuevaWeb/fe-cartolashistoricaspersonas/',
    // the credit cards' "Mis movimientos" app
    tarjetas: 'https://personas.bci.cl/andes/fe-mismovimientos/',
  },

  // observed at https://apilocal.bci.cl/bci-produccion/api-bci/bff-saldosyultimosmovimientoswebpersonas/v3.2/ on 2026-09-25
  api: {
    // observed at this URL on 2026-09-25 (sent by the statements app) and sent from
    // Node with that app's bundle headers on 2026-10-07 → 200: GET, no body, no RUT
    cuentas:
      'https://apilocal.bci.cl/bci-produccion/api-bci/operaciones-transversales-de-producto/gestion-de-cuenta/ms-gestioncuentascliente-neg/v3.11/SolicitarClienteCuentas',
    saldoPorCuenta:
      'https://apilocal.bci.cl/bci-produccion/api-bci/bff-saldosyultimosmovimientoswebpersonas/v3.2/cuentas-busquedas/por-numero-cuenta',
    // body {numeroCuenta}; the latest movements, no range, no paging (50 seen)
    movimientosPorCuenta:
      'https://apilocal.bci.cl/bci-produccion/api-bci/bff-saldosyultimosmovimientoswebpersonas/v3.2/cuentas-movimientos/por-numero-cuenta',
    // observed at https://apilocal.bci.cl/bci-produccion/api-bci/operaciones-y-ejecucion/tarjetas/ms-movimientostdcpersonasweb-exp/v2.0/mov-tdc/
    // on 2026-09-29: GET, no body — the cards app's own card list, one entry per plastic
    tarjetasLista:
      'https://apilocal.bci.cl/bci-produccion/api-bci/operaciones-y-ejecucion/tarjetas/ms-movimientostdcpersonasweb-exp/v2.0/mov-tdc/',
    // observed at the same base on 2026-09-29: POST {numeroCuenta, numeroTarjeta}
    // → quotas, billing dates and billed and unbilled movements of one card;
    // answered 200 from Node with the cards app's headers only (contract)
    informacionTarjeta:
      'https://apilocal.bci.cl/bci-produccion/api-bci/operaciones-y-ejecucion/tarjetas/ms-movimientostdcpersonasweb-exp/v2.0/mov-tdc/informacion-tdc',
  },

  // observed on cuentas-movimientos/por-numero-cuenta answers on 2026-09-25: only
  // these letters. C = cargo, A = abono confirmed against the bank's app on
  // 2026-09-28 (contract); others fail.
  movementSign: { C: 'cargo', A: 'abono' },

  // observed on apilocal.bci.cl requests of the saldos app on 2026-09-25: the
  // headers it sends besides what the browser adds itself. Only these are taken
  // from a bundle's interceptor; `authorization` is built from the token.
  apiHeaders: [
    'content-type',
    'application-id',
    'channel',
    'reference-service',
    'reference-operation',
    'x-ibm-client-id',
    'origin-addr',
    'tracking-id',
  ],
  // Angular HttpClient's default Accept, which the apps' requests carry; sent
  // from Node with every read on 2026-10-07 → 200.
  apiAccept: 'application/json, text/plain, */*',
} as const;
