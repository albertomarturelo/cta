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

  // observed at https://personas.bci.cl/nuevaWeb/fe-saldosultimosmovpersonas/ on 2026-09-25
  // (the micro-frontends' host, reached as an iframe of the JSF page)
  appsHost: 'personas.bci.cl',

  // observed at https://personas.bci.cl/nuevaWeb/fe-saldosultimosmovpersonas/ on 2026-09-25
  // (the balances-and-latest-movements app; it sends por-rut itself on load)
  saldosApp: 'fe-saldosultimosmovpersonas',
  // observed on personas.bci.cl on 2026-09-25 (/nuevaWeb/) and 2026-09-28
  // (/modernizacion/, loaded by the orchestrator's /comp/embedded route)
  appPathRoots: ['/nuevaWeb/', '/modernizacion/'],

  // observed at https://apilocal.bci.cl/bci-produccion/api-bci/bff-saldosyultimosmovimientoswebpersonas/v3.2/ on 2026-09-25
  api: {
    cuentasPorRut:
      'https://apilocal.bci.cl/bci-produccion/api-bci/bff-saldosyultimosmovimientoswebpersonas/v3.2/cuentas-busquedas/por-rut',
    saldoPorCuenta:
      'https://apilocal.bci.cl/bci-produccion/api-bci/bff-saldosyultimosmovimientoswebpersonas/v3.2/cuentas-busquedas/por-numero-cuenta',
    // body {numeroCuenta}; the latest movements, no range, no paging (50 seen)
    movimientosPorCuenta:
      'https://apilocal.bci.cl/bci-produccion/api-bci/bff-saldosyultimosmovimientoswebpersonas/v3.2/cuentas-movimientos/por-numero-cuenta',
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
