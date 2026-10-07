/**
 * The demo bank's login page (ADR-019), loaded with `setContent`: no URL, no
 * network. Its fields go nowhere — the form only flips a flag on submit, which
 * is all the driver reads. Anything typed is discarded with the page.
 */

/** The flag the page sets on submit; the driver waits for it and reads nothing else. */
export const DEMO_DONE_FLAG = 'ctaDemo';

export const DEMO_LOGIN_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Banco Demo — datos ficticios</title>
<style>
  :root { color-scheme: light; --ink: #1d2433; --muted: #5b6475; --brand: #0f6e5c; --line: #d9dee7; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ink);
         background: linear-gradient(160deg, #eef4f2 0%, #f7f8fb 60%); }
  main { width: min(400px, calc(100vw - 32px)); background: #fff; border: 1px solid var(--line);
         border-radius: 14px; padding: 28px; box-shadow: 0 10px 30px rgba(20, 30, 50, .08); }
  .badge { display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: .02em;
           color: #8a4b00; background: #fff3e0; border: 1px solid #ffd8a8; border-radius: 999px;
           padding: 2px 10px; margin-bottom: 14px; }
  h1 { font-size: 22px; margin: 0 0 4px; color: var(--brand); }
  p.sub { margin: 0 0 20px; color: var(--muted); font-size: 14px; }
  label { display: block; font-size: 14px; font-weight: 600; margin: 14px 0 6px; }
  input { width: 100%; font: inherit; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; }
  input:focus { outline: 2px solid var(--brand); outline-offset: 1px; border-color: transparent; }
  button { width: 100%; margin-top: 20px; font: inherit; font-weight: 600; color: #fff; background: var(--brand);
           border: 0; border-radius: 8px; padding: 11px; cursor: pointer; }
  .note { margin: 18px 0 0; font-size: 13px; color: var(--muted); }
  .done { display: none; text-align: center; }
  .done strong { display: block; font-size: 18px; color: var(--brand); margin-bottom: 4px; }
  body.ok form { display: none; }
  body.ok .done { display: block; }
</style>
</head>
<body>
<main>
  <span class="badge">Datos ficticios · no es un banco real</span>
  <h1>Banco Demo</h1>
  <p class="sub">Inicio de sesión de demostración de cta</p>
  <form autocomplete="off">
    <label for="rut">RUT</label>
    <input id="rut" inputmode="text" placeholder="Cualquier RUT ficticio">
    <label for="clave">Clave</label>
    <input id="clave" type="password" placeholder="Cualquier clave">
    <button type="submit">Ingresar</button>
    <p class="note">cta nunca lee lo que escribes aquí y esta página no envía nada:
      solo espera a que pulses «Ingresar». Con un banco real, escribes tu clave en la página del banco.</p>
  </form>
  <div class="done" role="status">
    <strong>Sesión iniciada</strong>
    Esta ventana se cerrará sola.
  </div>
</main>
<script>
  document.querySelector('form').addEventListener('submit', function (e) {
    e.preventDefault();
    document.querySelectorAll('input').forEach(function (i) { i.value = ''; });
    document.body.classList.add('ok');
    document.documentElement.dataset.${DEMO_DONE_FLAG} = 'ok';
  });
</script>
</body>
</html>`;
