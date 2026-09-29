# BCI (`bci`, code 016)

Last verified: 2026-09-28 (landing move, HTTP reads, live driver reads — GH-36, GH-37, GH-38); 2026-09-25 (login, session, reads, expiry — see GH-6, GH-8, GH-15; live `cta cuentas`, `saldo`, `movimientos` runs through the driver — GH-28, GH-29; open items under "Not yet observed")

Observed with a plain, visible Playwright Chromium (1.63), no flags, no stealth,
the login typed by hand. Values below are shapes; identifiers in `<angle>` or
`{braces}` are placeholders, never real data. Vendor names are *inferred* from
cookie, path and header names and marked as such; everything else was seen.

## Readable under ADR-004?

**Yes, today — in a visible browser only, and with a standing risk.** The login completed with no CAPTCHA, no
challenge page and no block. But several anti-automation layers run on every
page, and the browser exposes `navigator.webdriver = true`, which ADR-004
forbids hiding:

- **Invisible JS bot checks** in front of `*.bci.cl`:
  `POST /cdn-cgi/challenge-platform/h/b/jsd/oneshot/...` on each page, answered
  with `cf_clearance` (refreshed each time) and `__cf_bm`, `__cflb`, `_cfuvid`
  cookies — Cloudflare bot management *(inferred from those names)*.
- **Behavioral telemetry**: `POST https://<sub>.bci.cl/v3.1/<opaque-id>`
  (`text/plain`) every few seconds while the user is active, spacing out to
  ~2 min when idle (29 posts in 6.4 min), plus
  `POST https://<sub>.bci.cl/api/v1/sendLogs`. Cookie/storage names `cdSNum`,
  `cdContextId`, `cdSrvrState`, `cdTabList` match a known behavioral-biometrics
  naming convention; vendor not confirmed.
- **Device fingerprinting**: `detectedFonts_*` in localStorage; iframes and
  requests to an opaque third-party host (`1.<hash>.com`).
- **Trusted-device enrollment** ("dispositivo de confianza") offered right
  after the credentials — skippable on 2026-09-24 (see Login).

**Headless is blocked (observed 2026-09-24, GH-10).** One cookies-only restore in
a headless Chromium got `307` → `403` on the JSF home with a
`__cf_chl_rt_tk` challenge parameter and `/cdn-cgi/challenge-platform/h/b/fo/…`,
and `403` on `TokenAutorizacion`; no API call happened. The same restore in a
visible Chromium succeeded. Under ADR-004 nothing is tried to get past it: **BCI
reads need a visible browser.**

A driver may be blocked at any time without code changes on our side. If that
happens it stops and surfaces the bank's message verbatim (ADR-004); it never
adapts to avoid detection.

## Login

Observed 2026-09-24.

1. Public site `https://www.bci.cl/personas` → "Banco en línea personas"
   (`/corporativo/banco-en-linea/personas`). The user types RUT and clave there.
2. **Classic form POST** (document navigation):
   `POST https://www.bci.cl/LoginJSFGenerico`, `application/x-www-form-urlencoded`,
   fields `rut, dig, rut_aux, clave, transaccion, grupo, serv, canal, touch`.
   Response `302` → `https://login.bci.cl/web/<id>/?authId=<opaque>`, setting
   `JSESSIONID`, `persist`, `TS014d1b63`, `TS01e515b6`, `dtCookie` (`TS01…` is
   the naming of an F5 application firewall — *inferred*).
3. **Trusted-device step** on `login.bci.cl` (separate app):
   - `POST /api/bff/<id>/dispositivo-confianza/validaciones` — JSON `{dispositivosCookie}`,
     with an `Authorization` header;
   - page `/web/<id>/portal-registro/dispositivo-confianza` offers enrollment;
   - "Omitir" → `POST /api/bff/<id>/dispositivo-confianza/omitir` (empty JSON).
   - Cookie `__Host-Device` on `login.bci.cl` (1-year expiry) — empty when skipped.
4. `POST https://www.bci.cl/LoginJSFGenerico` with `{authId}` → `200`, sets
   `X-CSRF-TOKEN`, `BCI_CSRF_STRUTS`; then the JSF app
   `/cl/bci/aplicaciones/contenido.jsf` → `/cl/bci/aplicaciones/menu/vistas/inicio/miBanco.jsf`.
5. **Landing moved (observed 2026-09-28, GH-36).** After the trusted-device page
   the browser now lands on an orchestrator app on `personas.bci.cl` instead of
   the JSF home: `/web/fe-orq-mo-personas-re-v1-7/home` →
   `/web/fe-orq-mo-personas-re-v1-7/cl/bci/aplicaciones/menu/index` →
   `/web/fe-orq-mo-personas-re-v1-7/comp` →
   `/web/fe-orq-mo-personas-re-v1-7/comp/mi_banco/cl/bci/aplicaciones/menu/vistas/inicio/miBanco`
   (client-side routes of one app; the version segment `v1-7` will change).
   **No `JSESSIONID` on `www.bci.cl`** was present once this landing rendered
   (same date) — the session cookie of the old flow is gone. The landing's
   session cookie is **`__Host-SESSIONID` on `personas.bci.cl`** (httpOnly,
   persistent); the rest are Cloudflare (`cf_clearance`, `__cf_bm` per host),
   the trusted-device `__Host-Device`, telemetry and analytics (observed
   2026-09-28, names only). The read entry moved with it: see "Reads from a Node
   HTTP client" (the embedded saldos app under `/modernizacion/`, GH-37).

- **Second factor at login:** none on 2026-09-24 — the network log shows no
  second-factor request or page between the credentials POST and the landing.
- **Success signal:** landing on `/cl/bci/aplicaciones/contenido.jsf` with
  `JSESSIONID` + `X-CSRF-TOKEN` set (2026-09-24), or on the orchestrator's
  `…/home` or `…/comp/mi_banco/…` route with `__Host-SESSIONID` on
  `personas.bci.cl` set (2026-09-28); both are accepted, since a
  rollout may reach users unevenly. Decide by content, not status (CONVENTIONS).
- **Failure / lock:** not observed (no failed attempt was made, on purpose).

## Session

Two layers, observed 2026-09-24:

- **Classic JSF app (`www.bci.cl`)** — cookies: `JSESSIONID` (httpOnly, secure,
  cookie expiry +60 min from login), `persist` (httpOnly, session), `TS014d1b63`
  and `TS01e515b6` (session), `X-CSRF-TOKEN` (session), `BCI_CSRF_STRUTS`
  (+80 min). JSF POSTs carry `javax.faces.ViewState`.
- **New micro-frontends (`personas.bci.cl/nuevaWeb/<app>/`)** — reached through
  `GET https://www.bci.cl/svcRest/infraestructura/seguridad/servlet/TokenAutorizacion?url=<app>`
  → `303` → `https://personas.bci.cl/nuevaWeb/<app>/?token=<opaque>`. The app then
  calls an API gateway with a **bearer token, not a cookie** (IBM API Connect,
  *inferred from the `x-ibm-client-id` header*):
  `https://apilocal.bci.cl/bci-produccion/api-bci/<domain>/<service>/v<x.y>/...`,
  headers `authorization, application-id, channel, reference-service,
  reference-operation, origin-addr, x-ibm-client-id`. Example path shape:
  `.../gestion-clientes/ms-bciplus-orq/v1.9/usuarios/{rut}`.
- **Idle lifetime: ~15 min — REPORTED, NOT observed.** No
  idle stretch of 15 min has been observed yet (both sessions, 6.4 and 9.5 min,
  had activity); the 60-min cookie expiry is an upper bound, not the idle timeout.
- **How an expired session shows up (observed 2026-09-25, GH-15):** a restore
  with cookies ~16 h old (past the 60-min `JSESSIONID` expiry): `GET
  …/menu/vistas/inicio/miBanco.jsf` → `302` → `/personas/cierresesion.html` →
  `307` → the public "Banco en línea personas" page
  (`/corporativo/banco-en-linea/personas`, title "Personas | Bci Corporativo").
  This was the driver's expiry rule while it read in a browser (ADR-012); since
  GH-38 it reads over HTTP and an ended session is the API's `401` (see "Reads
  from a Node HTTP client"). The bot-check script runs on those public pages too.
- **The bank's own logout** (observed 2026-09-25): `GET
  /cl/bci/aplicaciones/menu/encuestaCierreSesion.jsf` →
  `GET /seguridadwls/CerrarSesion?tmp=<n>` → `GET /personas/cierresesion`.
  `cta logout` does not call it (it only forgets cookies).

**Cookies-only restore works (observed 2026-09-24, GH-8).** In a fresh browser
context holding only the copied cookies (no storage), one attempt each:
`GET .../menu/vistas/inicio/miBanco.jsf` → `200` on the JSF home (not the login
page); replaying `TokenAutorizacion?url=<app>` → `303` →
`personas.bci.cl/nuevaWeb/<app>/?token=<opaque, ~940 chars>`; the app's four
`apilocal` calls with `Authorization` → all `200`. **ADR-006 verdict: viable** —
persist cookies only; mint the API token per run through `TokenAutorizacion`,
never store it. **Correction (observed 2026-09-25, GH-28):** a *top-level*
`GET TokenAutorizacion?url=fe-saldosultimosmovpersonas` answers **`500`**. The
bank opens the apps only as an **iframe of its JSF page**: on the home
(`miBanco.jsf`) the accounts box link "Ir a últimos Movimientos"
(`fnActualizaProducto('cct'); fnVinculoAccesoDirecto('ult_mov', …)`) →
`GET /cl/bci/aplicaciones/menu/cargaOpciones.jsf?idServicio&idProducto` →
`GET /cl/bci/aplicaciones/contenido.jsf?tmp` → child frame
`TokenAutorizacion?url=fe-saldosultimosmovpersonas` (`Referer: https://www.bci.cl/`)
→ `303` → the app, which then sends `obtenerDatosCliente`, `por-rut`,
`por-numero-cuenta` and `cuentas-movimientos/por-numero-cuenta`. The home itself
embeds `fe-saldoscashback` the same way, and renders the balances box
server-side (`[id$=":saldosCuenta"]`). **Driver rule:** follow the bank's link;
read and send API calls from the app's frame. **`Authorization` is `Bearer <the URL token>`** — the `token`
query value of the redirect, used as is (a JWT, ~940 chars; observed equal,
2026-09-24). No exchange call exists.

## Reads

All observed 2026-09-24 in the visible browser; `apilocal` =
`https://apilocal.bci.cl/bci-produccion/api-bci`. The balances-and-latest-
movements app is `personas.bci.cl/nuevaWeb/fe-saldosultimosmovpersonas/`; its
backend is `{apilocal}/bff-saldosyultimosmovimientoswebpersonas/v3.2/…`. Its
calls carry `Authorization: Bearer <token>` and these app constants:
`application-id: 1`, `channel: 110`, `reference-service: refser`,
`reference-operation: refope`, `x-ibm-client-id: <36-char GUID set by the app —
read at runtime, not hard-coded>`, `origin-addr: <client IP — inferred>`, and
`tracking-id` (observed 2026-09-25; value shape not recorded). The cartolas app
sends the same set without `origin-addr`. Shapes below use invented
placeholders.

**Bearer token claims (names only, observed 2026-09-25):** `exp, iat, jti,
user_name, rut_cliente, nombre_cliente, apellido_p_cliente, cic, canal,
cod_convenio, client_id, scid, scope, authorities`. The token carries the RUT;
`cta` never decodes it (ADR-012).

### Accounts / balances

- **List of accounts — the app asks, `cta` only reads the answer.** On load,
  `fe-saldosultimosmovpersonas` itself sends
  `POST {apilocal}/bff-saldosyultimosmovimientoswebpersonas/v3.2/cuentas-busquedas/por-rut`,
  body `{"rut": "12345670-K"}` (the app fills it; observed 2026-09-25 on each
  load) → `{"cuentas": [{"numero": "00000000", "tipo": "Corriente"}]}`.
  **RUT-free rule (ADR-012, GH-15):** the driver never builds, reads or sends
  this body; it waits for the app's own response and reads `cuentas` from it.
- **RUT-free alternative (observed 2026-09-25):**
  `GET {apilocal}/operaciones-transversales-de-producto/gestion-de-cuenta/ms-gestioncuentascliente-neg/v3.11/SolicitarClienteCuentas`,
  no body, no RUT anywhere → `{"cuentas": [{"numeroDeCuenta", "tipoCuenta":
  "CCT", "fechaApertura": "2020-01-31", "estadoCuenta": "VIG"}]}`. Called by the
  cartolas app (`fe-cartolashistoricaspersonas`), with that app's token.
- **Balance of one account:** `POST {apilocal}/bff-saldosyultimosmovimientoswebpersonas/v3.2/cuentas-busquedas/por-numero-cuenta`,
  body `{"cuentaNumero": "00000000"}` → `{numero, tipo, estado, saldoContable,
  saldoDisponible, retenciones, lineaSobregiro: {montoUtilizado, saldoDisponible},
  lineaEmergencia: {saldoDisponible}, ultimosChequesCobrados: ["0000"]}` — every
  amount a JSON **integer** (whole pesos). `tipo` is a product code (`CCT`,
  `CPR` seen), `estado` `VIG`. One call per account. Switching account in the
  bank's UI reloads the app through the JSF menu (`contenido.jsf` POST with
  `idServicio`/`idProducto`) and a new `TokenAutorizacion` — *inferred from call
  counts on 2026-09-25*; the app then reads the selected account.

### Movements

- **Latest movements ("Últimos Movimientos"):**
  `POST {apilocal}/bff-saldosyultimosmovimientoswebpersonas/v3.2/cuentas-movimientos/por-numero-cuenta`, body
  `{"numeroCuenta": "00000000"}` only — **no date range, no paging**. Returned
  **50** items on each of 4 calls (likely a cap; fewer for a quieter account is
  expected but unobserved); the UI's "show 10 / 50" pages client-side. Item:
  `{fechaMovimiento: "2026-01-31T00:00:00…", idMovimiento, glosa, monto: "1000.00",
  serie: "<18 digits>", tipo: "<one letter>", detalleMovimiento: {tipo,
  atributos: [{titulo, valor, posicion, tooltip}]}}`, plus `ordenadoPor`.
  `monto` is an **unsigned decimal string**; the sign must come from `tipo`.
  **`tipo` letters (2026-09-25):** only `C` and `A` observed. `C` = cargo
  (debit), `A` = abono (credit) — **confirmed against the bank's own app on
  2026-09-28** (the join with the cartola's
  `saldo_mas`/`saldo_menos` icons still did not run). **Driver rule:**
  any other letter is a `BankError`, never a guess. `detalleMovimiento.tipo` is
  a category (`TRANSFERENCIA`, `PAGO_EN_LINEA`, `NO_ENRIQUECIDO` seen), not a
  sign. `fechaMovimiento` comes with or without milliseconds.
- **Cartola Actual e Histórica (classic JSF, HTML):**
  `/cl/bci/aplicaciones/cartola/cuenta/cartolaCuenta.jsf`, form
  `formCartolaCuenta`; account switch is a JSF ajax POST with
  `formCartolaCuenta:select_cuenta` + `javax.faces.ViewState`. The movements table
  `tablaMov` has a **date search** (`tablaMov:fecha1`, `tablaMov:fecha2`,
  `buscaPorFechas`) and a PrimeFaces paginator. Columns: Fecha, Descripción,
  Serie, Monto $, and a truncated fifth header (likely Saldo — *inferred*); the debit/credit sign is an **icon** (`saldo_menos` /
  `saldo_mas` classes), not text. Excel export offered. Server-rendered — reading
  it means parsing HTML. The date-search POST was not exercised.
- **Cartola histórica (new app `fe-cartolashistoricaspersonas`, JSON) —
  monthly statements index:**
  `POST {apilocal}/operaciones-transversales-de-producto/gestion-de-cuenta/ms-movimientoscuentapersonas-neg/v1.3/cartolas-busquedas/por-cuenta-y-anio`,
  body `{"numeroCuenta", "anio": 2026 | "2026", "fechaDesde": "", "fechaHasta": ""}`
  (`anio` sent both as number and as string; the dates always empty — 7 calls,
  2026-09-25) →
  `[{cuenta: {numero}, folio: "<nnn>", fechaMovimientos: "<yyyy-mm-dd>",
  fechaProceso: "<yyyy-mm-dd>", archivo: null}]` — a list of downloadable monthly
  statements filtered by year, not movements. `fechaDesde`/`fechaHasta` exist but
  were sent empty.

### Credit cards (not in this contract yet)

Card reads are planned for a future `tarjetas` surface. Their paths are
re-observed and recorded here with that surface's ADR.

### Reads from a Node HTTP client (observed 2026-09-28, GH-37)

One attended login, then the browser closed and the balance read sent from Node
(`fetch`, Node 26), one attempt per point, stopping at the first non-200:

- **Entry after the landing move (GH-36):** from the orchestrator home, the
  user's "últimos movimientos" opened `personas.bci.cl/web/fe-orq-mo-personas-re-v1-7/comp/embedded`,
  whose iframe loads the saldos app at **`personas.bci.cl/modernizacion/fe-saldosultimosmovpersonas/`**
  (was `/nuevaWeb/…`). From that frame the app sent, with `Authorization: Bearer`,
  `…/ms-gestiondatoscliente-neg/v2.1/obtenerDatosCliente` and the same
  `bff-saldosyultimosmovimientoswebpersonas/v3.2/cuentas-busquedas/por-rut` as
  before (`200`). Same ten app headers as on 2026-09-25 (`accept`,
  `content-type`, `authorization`, `application-id`, `channel`,
  `reference-service`, `reference-operation`, `x-ibm-client-id`, `origin-addr`,
  `tracking-id`).
- **Request from Node:** `POST …/v3.2/cuentas-busquedas/por-numero-cuenta`
  with only those ten headers (reused as captured, `tracking-id` included); no
  cookies; no `user-agent`, `origin`, `referer` or `sec-*` set by `cta`.
- **Answers:** `200 application/json` with the usual balance keys at **0, 5, 16,
  31 and 46 min** after the login, with no browser open and nothing else
  touching the session between calls (gaps up to 15 min). `server: cloudflare`
  and `cf-ray` are present on `apilocal.bci.cl`, **with no challenge**. The
  answer sets cookies, which the probe ignored.
- **Past `exp`:** at **62 min** the same call answered **`401 application/json`**
  with keys `error`, `error_description` (Cloudflare present, no challenge).
  **Driver rule:** `401` → `NotAuthenticated`; the grant is dropped, and nothing
  retries it.
- **Token:** claim names `id_cliente, user_name, rut_cliente, origen,
  authorities, client_id, apellido_p_cliente, azp, scope, cod_convenio, exp,
  cic, jti, scid, nombre_cliente`, with no `iat`. `exp` was 59.8 min after the
  login. **The token carries personal identifiers:** it never leaves memory
  (ADR-015).
- **Verdict (ADR-015):** BCI reads can run from Node with the grant the app
  receives. The browser is needed only for the login and the grant capture.
- **Driver rules (GH-38):** after the landing, the login waits for the saldos
  app's own `por-rut` POST from a frame under `/nuevaWeb/` or `/modernizacion/`
  and keeps its ten headers, its account list and the bearer's `exp` (the only
  claim read). To open the app, it follows the home's own menu (observed
  2026-09-28, public #4): the main frame's link **"Mi Cuenta"**, then its link
  **"Últimos Movimientos"** (both `href="#"`, exact names). That routes to
  `/web/fe-orq-mo-personas-re-v1-7/comp/embedded?url=…` and loads the app in an
  iframe at `/modernizacion/fe-saldosultimosmovpersonas/?token=…`; the app then
  sends `obtenerDatosCliente` and `por-rut` with the bearer. The home carries **two copies** of each link, and Playwright reports both as
  visible (observed 2026-09-28): a closed dropdown's "Últimos Movimientos" counts
  as visible yet takes no click. The driver therefore clicks the first "Mi
  Cuenta" copy that accepts a click, then "Últimos Movimientos" **inside that
  menu** (the nearest ancestor of "Mi Cuenta" that holds it). If the path is not
  taken, the login ends at once with a `BankError` that names the step and the
  found/visible counts. A guessed link — the old JSF "Ir a últimos
  Movimientos" inside the orchestrator home — led to a bank error page,
  `{"codigo":"-1","mensaje":"Ha ocurrido un error interno"}` (GH-38). The home
  also loads `fe-saldoscashback` with a `?token=` on its own, and calls
  `personas.bci.cl/api/ms-supercartola-mb-orq/v1.2/supercartolaBackingMB/state`
  (a balances summary, session cookie, no bearer) — not used. **Live, same
  day:** a login in which the user touched nothing after typing the
  credentials ended by itself through this menu, and `cuentas`, `saldo` and
  `movimientos` then read over HTTP. **Live through the grant holder (same day,
  CTA-2):** the login ended by itself through the menu; `bancos`, `cuentas`,
  `saldo` and `movimientos` each ran as a separate `cta` process through the
  shared holder; `logout` ended the session for all, and a later `saldo` exited 3.
  **Menu timing (2026-09-29, CTA-6):** a click on "Últimos Movimientos" made
  right after the landing was accepted but did nothing, and the login timed
  out. The driver now waits for the `/comp/mi_banco/…` route and a quiet
  network (at most 15 s), and checks the click routed to `/comp/embedded`
  (one more click if it did not). Live the same day: the login ended by itself
  and a `saldo` from another process read over HTTP.
  Reads: one POST per account with those headers only. `401` →
  `NotAuthenticated`; a challenge marker, `403` or a non-JSON `200` →
  `BankBlocked`; anything else → `BankError`. Nothing is retried.
- **Live through the driver (2026-09-28, GH-38):** one login in which the user
  opened "últimos movimientos"; then `cuentas`, `saldo` and `movimientos`
  (both signs) through the tasks over HTTP, with no browser after the login and
  nothing stored on disk.

## Formats

- **API (JSON):** balances integer pesos; movement `monto` unsigned decimal
  string with `.` decimals; dates ISO (`date-iso`, `datetime-iso`); account
  numbers digit strings.
- **Rendered pages:** amounts `$ 1.234.567` (`.` thousands, no decimals); dates
  `dd-mm-yyyy` in the JSF movements table, `dd/mm/yyyy` in the new apps; sign via
  icon.

## Errors and blocks

- **Login POST → `500`** (observed 2026-09-24, after repeated logins the same
  day): `POST /LoginJSFGenerico` answered `500 text/html` with a
  generic application-server page — title "Error 500--Internal Server Error",
  body quoting RFC 2068 §10.5.1 ("The server encountered an unexpected condition
  which prevented it from fulfilling the request."). A second attempt 22 s later
  got the same. Cause unknown (transient fault, or a reaction to repeated
  automated-browser logins — not distinguishable from the client). **Driver
  rule:** treat it as a failed login; surface it verbatim and stop — never retry
  (ADR-004).
- **Headless restore → bot challenge** (`307` → `403`, see "Readable under
  ADR-004?").
- Every other document and API response on 2026-09-24 was 2xx/3xx.

## Not yet observed (next probe)

- The real **idle** lifetime (the 2026-09-25 session ended by the bank's own
  logout, so the 16-min idle restore was not run).
- The join of `tipo` `C`/`A` with the cartola's +/− icons (the mapping was
  confirmed against the bank's app on 2026-09-28).
- The orchestrator home's own link or button to "últimos movimientos" (GH-38
  relies on the user's click).
- The JSF **Cartola Histórica date search** (`tablaMov:fecha1`/`fecha2` inside
  `panelCartolaHistorica`, paginator): not exercised; the 2026-09-25 search went
  through the new statements app, which lists monthly statements, not movements.
- Whether `tracking-id` changes per request. The driver reads every account
  in one browser by sending `por-numero-cuenta` from the app's page with the
  headers of the app's own request, `tracking-id` included (ADR-012).

## Second factor on writes (for a future ADR-008 surface)

Not observed.
