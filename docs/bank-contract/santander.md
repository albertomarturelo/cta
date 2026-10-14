# Santander Chile (`santander`, code 037)

Last verified: 2026-10-14 (public pages and bundles; one attended login, request metadata only)

Observed with plain HTTPS GETs (`curl`, its own user agent, no cookies sent),
the way ADR-018 reads public bundles. Values below are shapes; identifiers in
`<angle>` are placeholders, never real data. Vendor names are *inferred* from
cookie, path and code names and marked as such; everything else was seen.

## Readable under ADR-004?

**Unknown until one attended login.** Nothing was blocked on the public pages,
but bot and fraud checks run before the user types anything:

- **Bot management on both hosts.** `banco.santander.cl` and
  `mibanco.santander.cl` answer `200` and set `_abck` and `bm_sz`, and each page
  loads a script from an opaque same-origin path (`/<opaque>/<opaque>/…`, no
  extension) — Akamai Bot Manager *(inferred from those names and that path
  shape)*. Responses carry `x-akamai-transformed`.
- **Behavioral biometrics, named in the login app's code:** a `biocatchService`,
  a `customerSessionId`, a periodic **heartbeat** (`HEARTBEAT` in the app's
  config), and an HTTP interceptor that reports to `/fraud_evaluation/api-exp`
  whenever a `POST` goes out while the heartbeat status is not `Ok` and a
  session exists. The public site's widget also calls
  `window.cdApi.resetSessionNumber()`. Vendor named by the code itself; the
  same `cd*` convention was seen on BCI.
- **reCAPTCHA (Google, invisible)** is loaded by the public site bundle, but
  the code that runs it feeds a commercial lead form, not the login. Whether
  the login shows a challenge is not yet observed.
- **The login app's runtime config is obfuscated on purpose**
  (`assets/web/properties-frame.js`, a string-array obfuscator; so is
  `assets/js/login-iframe.js`). Its keys include client IDs and a client secret
  by name. **cta does not deobfuscate it**: what the bank hides is not read,
  and nothing in cta needs it — headers and the token come from the page's own
  requests at login (ADR-015), not from the bundle (ADR-018 does not fit here).
- Analytics and monitoring: Tealium, Evergage, AppDynamics (`cdn.appdynamics.com`).

A headed Playwright Chromium exposes `navigator.webdriver = true`, which
ADR-004 forbids hiding. If the bot manager challenges or blocks that browser at
login, the spike stops there and the bank's words are recorded verbatim.

## Login

Observed 2026-10-14 in public bundles, not yet exercised.

**Entry: `https://mibanco.santander.cl/UI.Web.HB/Private_new/frame/#/public/login?redirect=false`**
(the page the bank's personas login uses). An Angular 12 shell
(`<base href="/UI.Web.HB/Private_new/frame/">`, `main.<hash>.js`, about 80
lazy chunks `<id>.<hash>.js` in the same folder) built with Webpack Module
Federation and the bank's own shared libraries (`@santander/http`,
`@santander/session`, `@santander/passwordless`, `@santander/biometricauth`, …).
It also loads `/UI.Web.HB/Menu/menu.js` and Transmit Security's BindID SDK
(`signin.identity.security`, passwordless sign-in). `content-security-policy:
frame-ancestors` allows `*.santander.cl` and `*.santandermovil.cl`: the same
app runs as an iframe (`/login-frame`) inside other pages.

- **Credential call (the page's, never cta's):** an OAuth 2 password grant —
  `POST <LOGIN>` (`application/x-www-form-urlencoded`) with fields
  `grant_type=password`, `client_id`, `scope=Completa`, `username`, `password`,
  and headers named `canal`, `app`, `nro_ser`. A second path posts JSON
  `{RUTCLIENTE, PASSWOR…}` for another environment flag. `<LOGIN>` lives in the
  obfuscated config; its host is seen at login.
- **Answer:** `access_token` and `token_type` (also `tokenJWT`); the app then
  sends `Authorization: <token_type> <access_token>`. A cookie `tokenType`
  records `oauth2` or `dss` (a second token kind, "party auth DSS", with its
  own refresh endpoint under `apideveloper.santander.cl/…/party_auth_dss/v1/oauth2/refresh`).
  Expiry is kept in cookies `__expIn__` and `__expRf__` (refresh), consent in
  `__conOn__`.
- **Second factor options named in the code:** SuperClave (`SUPER_CLAVE`),
  Santander Pass (`SANTANDER_PASS_VALIDATION`), OTP (`crearOTP`), device
  enrollment, QR (`code_qr`), passwordless (BindID) and Touch ID. The browser
  login observed on 2026-10-14 asked for none (see below); they likely guard
  other operations (transfers, enrollment).
- **The app stores the RUT in a cookie named `rut`.** cta must never persist
  that cookie (ADR-012: cta never stores the RUT); an HTTP-mode driver persists
  no cookies at all (ADR-015).

Older entry, still on the public site: `https://banco.santander.cl/personas`
→ «Ingresar a mi banco» opens an embedded panel (RUT `d_rut`, clave `d_pin`,
optional shuffled virtual keypad) that **form-posts** to
`https://www.santander.cl/transa/cruce.asp`. Not the entry the driver will use
unless the attended login shows `mibanco` sends users there.

## API hosts named in the bundles

- `https://apiper.santander.cl` with channel prefixes `perdsk` (desktop),
  `permov` (mobile web), `perapp` (app) — e.g. `<host>/perdsk/<service>/…`.
- `https://api-app.santander.cl/perapp/…` and
  `https://apideveloper.santander.cl/sancl/{partner,privado}/…` (OAuth token
  and refresh endpoints).
- Header **names** the apps send: `Authorization`, `X-Santander-Client-Id`,
  `x-schema-id`, `X-Client-Code`, `X-Organization-Code`, `canal`, `app`,
  `nro_ser`, `Content-Type`. Values come from the obfuscated config; cta takes
  them from the page's own request, never from a file.
- A request body envelope `{Cabecera: {HOST: {USUARIO-ALT, TERMINAL-ALT,
  CANAL-ID}, CanalFisico, CanalLogico, …}, Entrada: {…}}` on several services.
- **The bank's app refreshes its token** (`REFRESH_TOKEN`). cta does not
  (ADR-015: no refresh, no keep-alive); a session ends at the token's `exp`.

## Login, observed (2026-10-14, one attended login)

Observed with a plain, visible Playwright Chromium (1.63), no flags, no
stealth; the user typed everything; the probe recorded request metadata only.

- **No challenge and no block** at login: no CAPTCHA page, no interstitial.
  The login completed in about 25 s.
- **No second factor at login:** RUT and clave only; no separate
  second-factor call in the request log. The second-factor services named in
  the code (SuperClave, Santander Pass, OTP) are not part of this login.
- The page stays on `mibanco.santander.cl/UI.Web.HB/Private_new/frame/`; the
  routes after login are client-side (`#/…`), and other apps load as
  same-origin modules (`/UI.Web.HB/Private_new/Home_Privado/`, `…/Saldos/`).
  There is no redirect chain and no landing document to wait for.
- **Credential call:** `POST https://apideveloper.santander.cl/sancl/privado/party_authentication_restricted/party_auth_dss/v1/oauth2/token`,
  `application/x-www-form-urlencoded`, headers named `accept`, `app`, `canal`,
  `nro_ser`, `tokentbk`, `akamai-bm-telemetry` (the bot manager's sensor data
  rides on this call). `200`, JSON with `access_token`, `refresh_token`,
  `tokenJWT`, and a `CrucedeProducto` block that **carries the customer's
  identity and products** (`ESCALARES`: names, document number, segment;
  `MATRICES.MATRIZCAPTACIONES.e1[]`: contract number, product, amounts, card
  PAN field…) plus `infoUser` (`lastLoginOK`, account state). A driver that
  takes the token from this answer must read `access_token` only and drop the
  rest unparsed (ADR-015, ADR-012).
- **The bearer is a JWT that lives 600 s (10 min)** (`exp` − issue, read from
  the claim only). Every later API call carried `Authorization: Bearer <jwt>`.
- Called right after login: `api-dsk.santander.cl/perdsk/datosCliente/*`
  (email, campaigns), `apideveloper…/market_research/v1/suscriberkeymc`,
  `openbanking.santander.cl/party_authentication/session/v1/parameters`
  (headers `authorization`, `x-client-code`, `x-organization-code`).
- **Fraud scoring in the flow:** `POST api-dsk.santander.cl/perdsk/seguridad/Biocatch/getScore`
  (Bearer) runs next to the reads (3 times while opening balances).
- Third-party opaque hosts `1.<hash>.com` load `/scripts/prod/crossdomain.html`
  documents (device fingerprinting, as on BCI); `mibanco…/_bm/get_params` is
  the bot manager's own call.

## Session

- Holder: the JWT above, in the page's memory. The `__expIn__`, `__expRf__`,
  `tokenType` and `rut` cookies named in the code were **not** set in this
  session (43 cookies seen, none of those names).
- **Lifetime: 10 minutes, then the bank ends it.** With the user idle after
  browsing, the app sent **no refresh** and no API heartbeat. At the token's
  `exp` (600 s after the token call) the app itself called
  `POST apideveloper…/party_auth_dss/v1/oauth2/revoke` (Bearer) and
  `POST https://apiper.santander.cl/perdsk/logoff`, then navigated to
  `www.santander.cl/` → `banco.santander.cl/personas` (`301`, `302`).
  So one attended login gives at most ~10 min of reads, and the token is
  revoked server-side at `exp` while the bank's page is open.
- Behavioral telemetry while idle: `POST https://wup-<id>.santander.cl/v3.1/<opaque>`
  and `…/client/v3/web/wup`, plus `log-<id>.santander.cl/api/v1/sendLogs` —
  the same shapes as BCI's behavioral telemetry *(vendor inferred)*.
- Not observed: whether a token whose page was closed early stays valid until
  `exp` (no revoke would be sent), and what an API answers past `exp`.

## Reads (observed 2026-10-14; shapes in CTA-15)

All on **`openbanking.santander.cl`**, `Authorization: Bearer <jwt>`, an Apigee
gateway. Header names the app sends with them: `x-santander-client-id`,
`x-schema-id`, `x-b3-spanid`, `x-client-code`, `x-organization-code`,
`content-type: application/json`. Values come from the app's runtime config;
cta takes them from the page's own request.

- **Balances:** `POST /<service>/v1/current-accounts/balances` → `200`. Body
  (from the app's code): `{accountId, currency, commercialGroup}`.
- **Movements:** `POST /<service>/v1/current-accounts/transactions` → `200`
  (called twice when opening an account). The app names this "last
  movements"; its calendar filter (`dateFrom`, `dateUntil`) is a UI form —
  whether the API takes a range is not yet observed.
- **Statements (cartolas)** go through another service whose body carries
  `rutCliente`, `numPersona`, `fechaDesde`, `fechaHasta`. **cta cannot build
  that request** (ADR-012: never the RUT).
- **Debit cards:** `GET /card_authorization/card_authorization/v1/cards/card_devices_management`
  → `200`, query keys `data_recall`, `debit_or_credit_card`, `document_number`,
  `flag_recall`, `option_call`. **`document_number` is the RUT in the URL**:
  cta cannot build this request either.
- `<service>` is one path segment longer than 40 characters, built from the
  app's config (`URL_CONSULTA_SALDO_API_GEE`); recorded masked.
- Accounts list: not yet seen as its own call (the token answer lists
  products; see above).

## Not yet observed (next probe, CTA-15)

Same probe rules: a visible Chromium, the user types everything, metadata only,
JSON answers reduced to field names and value types at the source, scanned
before reading.

- Response shapes (field names, money and date formats, sign) of `balances`,
  `transactions` and `card_devices_management`; the request body of
  `transactions` (range? paging?).
- An accounts list the app gets without the RUT (the token answer lists
  products, but cta must not parse that answer beyond `access_token`).
- Credit cards (not opened in this session) and their service.
- Whether the `<service>` segment is stable; the full header set of a read.
- Whether a Node read with the page's own headers answers `200` — tried only
  if the open questions above leave HTTP mode viable (10-min token, fraud
  scoring next to reads), and never after a challenge (ADR-004).
