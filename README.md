# cta — tu cartola bancaria desde la terminal o tu agente de IA

> ⚠️ **Pre-alpha (0.1.0-rc.2).** Prerelease: el servidor MCP funciona de
> punta a punta con BCI; las lecturas desde el CLI llegan en la próxima versión.
> Decisiones documentadas en [`docs/decisions/`](docs/decisions/_index.md).

`cta` lee **tu saldo y tus movimientos (la cartola)** de tu propia cuenta bancaria
chilena, desde la terminal o desde un agente de IA vía **MCP** (Claude Desktop,
Claude Code y cualquier cliente MCP). Todo corre **en tu computador**:

- Tus credenciales las escribes tú, en la página real del banco. `cta` nunca las
  ve ni las guarda.
- Tras el login, `cta` guarda la sesión de lectura **solo en memoria**, cerca de
  una hora, y lee sin volver a abrir el navegador. Nada de eso toca el disco.
- Sin servidores intermedios: tus datos no pasan por nadie más.
- El segundo factor lo apruebas tú, en la app del banco.

**Banco soportado primero:** BCI. Otros bancos se suman como *drivers*
independientes, idealmente contribuidos por quien tiene cuenta en ellos.

## Instalar (prerelease)

Requiere **Node ≥ 20**.

```bash
npm i -g @albertomarturelo/cta-mcp@next @albertomarturelo/cta-cli@next
npx playwright install chromium   # el navegador donde inicias sesión
```

### Con tu agente de IA (MCP)

En Claude Desktop, agrega el servidor en `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cta": { "command": "cta-mcp" }
  }
}
```

Luego pídele, por ejemplo, «inicia sesión en bci y dime mi saldo»:

1. Se abre la página real del banco. Inicias sesión tú, con tu clave y, si lo
   pide, tu segundo factor.
2. Al llegar a tu inicio, la ventana abre sola tus últimos movimientos, toma la
   sesión de lectura y se cierra.
3. Durante cerca de una hora, el agente lee cuentas, saldos y movimientos sin
   abrir el navegador. Cuando la sesión vence, vuelves a iniciar sesión.

### Desde la terminal

```bash
cta login bci
cta saldo --banco bci --human
cta movimientos --banco bci --desde 2026-09-01
```

En esta versión, cada comando del CLI es un proceso aparte y no reutiliza la
sesión del anterior, así que las lecturas de BCI desde el CLI responden
`NotAuthenticated`. La sesión compartida entre el CLI y el MCP llega en la
próxima versión.

## Qué NO hace

- **No mueve dinero.** La versión 1 es solo lectura. Cualquier escritura futura
  tendrá su propia decisión documentada, y la aprobación final siempre será tuya,
  en la app del banco.
- No es un servicio: no guarda credenciales de terceros ni opera cuentas ajenas.
- No evade controles de seguridad del banco. Si el banco bloquea, `cta` se detiene.

## Aviso importante

`cta` no está afiliado, patrocinado ni respaldado por ningún banco. Automatizar el
acceso a tu propia cuenta puede ir contra los términos de servicio de tu banco, y
**el banco puede bloquear tu acceso o tu dispositivo**. Úsalo bajo tu propia
responsabilidad. Se entrega "tal cual", sin garantías (licencia MIT).

## Contribuir

Lee [`CONTRIBUTING.md`](CONTRIBUTING.md). El proyecto usa
[Context-First Development](https://github.com/albertomarturelo/context-first-development).
Proyecto hermano: [`sii`](https://github.com/albertomarturelo/sii), el mismo patrón
para el SII de Chile.
