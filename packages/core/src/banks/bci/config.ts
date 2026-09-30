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
    // observed at https://personas.bci.cl/web/fe-orq-mo-personas-re-v1-7/comp/embedded on
    // 2026-09-28: where "Últimos Movimientos" routes before loading the saldos app
    embeddedSegment: '/comp/embedded',
    // observed at https://personas.bci.cl/web/fe-orq-mo-personas-re-v1-7/comp/mi_banco/cl/bci/aplicaciones/menu/vistas/inicio/miBanco
    // on 2026-09-28: the user's path to the saldos app — the main frame's link
    // "Mi Cuenta", then its link "Últimos Movimientos" (both href="#"), which
    // routes to /comp/embedded?url=… and loads the app with ?token=… in an iframe
    menuMiCuenta: 'Mi Cuenta',
    menuUltimosMovimientos: 'Últimos Movimientos',
    // observed at https://personas.bci.cl/web/fe-orq-mo-personas-re-v1-7/comp/mi_banco/cl/bci/aplicaciones/menu/vistas/inicio/miBanco
    // on 2026-09-29: the user's path to the cards app — the link "Tarjetas", then the
    // group "Tarjetas de crédito", then its link "Mis movimientos", which routes to
    // /comp/embedded and loads the cards app. "Tarjetas de débito" also holds a
    // "Mis tarjetas", so the item is taken inside the credit group only.
    menuTarjetas: 'Tarjetas',
    menuTarjetasCredito: 'Tarjetas de crédito',
    menuMisMovimientosTarjeta: 'Mis movimientos',
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

  // observed at https://personas.bci.cl/nuevaWeb/fe-saldosultimosmovpersonas/ on 2026-09-25
  // (the micro-frontends' host, reached as an iframe of the JSF page)
  appsHost: 'personas.bci.cl',

  // observed at https://personas.bci.cl/nuevaWeb/fe-saldosultimosmovpersonas/ on 2026-09-25
  // (the balances-and-latest-movements app; it sends por-rut itself on load)
  saldosApp: 'fe-saldosultimosmovpersonas',
  // observed at https://personas.bci.cl/andes/fe-mismovimientos/ on 2026-09-29
  // (the credit cards' "Mis movimientos" app; it sends GET mov-tdc/ itself on load)
  cardsApp: 'fe-mismovimientos',

  // observed on personas.bci.cl on 2026-09-25 (/nuevaWeb/), 2026-09-28
  // (/modernizacion/, loaded by the orchestrator's /comp/embedded route) and
  // 2026-09-29 (/andes/, the cards app)
  appPathRoots: ['/nuevaWeb/', '/modernizacion/', '/andes/'],

  // observed at https://apilocal.bci.cl/bci-produccion/api-bci/bff-saldosyultimosmovimientoswebpersonas/v3.2/ on 2026-09-25
  api: {
    cuentasPorRut:
      'https://apilocal.bci.cl/bci-produccion/api-bci/bff-saldosyultimosmovimientoswebpersonas/v3.2/cuentas-busquedas/por-rut',
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
  // headers it sends besides what the browser adds itself
  apiHeaders: [
    'accept',
    'content-type',
    'authorization',
    'application-id',
    'channel',
    'reference-service',
    'reference-operation',
    'x-ibm-client-id',
    'origin-addr',
    'tracking-id',
  ],
} as const;
