# 🛠️ Guía de Desarrollo — RutaEscolar PWA

> **Guía para desarrolladores**: cómo correr, estructurar, añadir features y mantener el proyecto.
> **Última actualización:** 24/08/2026

---

## 1. Requisitos

- **Node.js** ≥ 18 (probado con Node 24)
- **npm** (o Bun — el lockfile original es `bun.lock`)
- Navegador moderno (Chrome/Edge/Firefox)

## 2. Puesta en marcha

```bash
# 1. Clonar
git clone https://github.com/iamnocodeveloper/ruta-colegios.git
cd ruta-colegios

# 2. Instalar dependencias
npm install          # o: bun install

# 3. Variables de entorno (opcional para dev)
cp .env.example .env

# 4. Correr en desarrollo
npm run dev          # → http://localhost:3000
```

> ⚠️ **Puerto 3000**: si está ocupado por otro servicio (ej. Remotion Studio), verás un HTML ajeno. Cierra el otro proceso o cambia el puerto en `server.ts`.

## 3. Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server (Express + Vite middleware) en :3000 |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm run build` | Build producción → `dist/` (vite + esbuild server) |
| `npm run start` | Sirve `dist/` en producción |
| `npm run preview` | Vite preview |

## 4. Estructura de carpetas

```
rutas-coplegio/
├── index.html              # HTML raíz (SPA)
├── server.ts               # Express: API tracking + servir dist/ (prod)
├── vite.config.ts          # base './', plugins React+Tailwind, alias @
├── tsconfig.json           # TypeScript (target ES2022, jsx react-jsx)
├── package.json / bun.lock # dependencias
├── public/                 # PWA: manifest, sw.js, iconos
├── src/
│   ├── main.tsx            # Entry point (ErrorBoundary + App)
│   ├── App.tsx             # Estado global, auth, vistas, handlers
│   ├── types.ts            # Modelo de datos
│   ├── index.css           # Design system (@theme) + estilos Leaflet
│   ├── services/           # instantDb, routeCalculator, routeHistory, routeJourneys, pdfReport, mockData
│   └── components/
│       ├── Layout/  Home/  Driver/  Admin/  Parent/
│       ├── Auth/    Map/   PWA/
│       └── ErrorBoundary.tsx
├── docs/                   # Documentación del proyecto
└── DOCUMENTACION.md        # Índice general
```

## 5. Convenciones de código

### Estilo
- **TypeScript estricto**: tipos explícitos, sin `any` salvo interop con InstantDB (patrón `(alu: any)` en mapeos).
- **Componentes**: `React.FC<Props>` con interfaces de props locales.
- **Naming**: camelCase para funciones/variables, PascalCase para componentes/tipos, snake_case para campos de datos (modelo DB).
- **IDs de botones**: conservar los `id="nav-*"`, `btn-*`, `tab-*` existentes (pueden usarse en tests).

### Temas / clases
- Usar los **tokens del design system**: `bg-canvas`, `bg-surface`, `text-ink`, `text-muted`, `text-primary`, `bg-soft-gray`, `border-line`, `rounded-card`, `shadow-soft`, `bg-neon`.
- No introducir clases `slate-*`/`amber-*` oscuras nuevas (se migró a tema claro).
- Botones primarios: `bg-primary text-white`.

### Datos
- **Doble escritura**: cada mutación debe ir a InstantDB (`*Instant`) Y localStorage (resiliencia).
- **`activo_en_rutas`** en alumno: `false` lo excluye de rutas.
- **`dias_ruta`**: array de `['Lun','Mar','Mié','Jue','Vie']`; usar `normalizeDays()` al leer (puede venir como string JSON de InstantDB).
- **`modalidad_servicio`**: `ida_y_vuelta` | `solo_ida` | `solo_vuelta` — siempre mapearlo desde InstantDB (bug histórico: se perdía en el mapeo).

### Drag & drop (motion)
- Usar `Reorder.Group` / `Reorder.Item` de **`motion/react`** (ya instalado; re-exporta de framer-motion).
- Para que solo arrastre un asa: `dragListener={false}` + `useDragControls` y disparar `controls.start(e)` en el `onPointerDown` del handle (`GripVertical`).
- ⚠️ **No llamar hooks (ej. `useDragControls`) dentro de un `.map()`** — extraer un componente por fila (ver `StopRow` en `RoutePlanner.tsx`).
- Todo reorden de paradas recalcula con el helper centralizado **`applyManualOrder(newOrder)`** (variante "Manual").

### Rutas combinadas (ida + vuelta)
- Un solo registro `RutaDiaria` puede contener ambas jornadas vía **`ruta.ida` / `ruta.vuelta`** (tipo `RutaTrayecto`); `ruta.paradas` es la concatenación de ambas (vistas legacy siguen funcionando).
- Usar los helpers de **`src/services/routeJourneys.ts`** para leer/actualizar jornadas (`getJourneys`, `getJourneyByParadaId`, `updateJourney`, `journeyView`, `computeRutaEstado`).
- El estado global (`ruta.estado`) se deriva de las jornadas (`computeRutaEstado`): `planificada` → `en_curso` (si alguna arrancó) → `completada` (cuando todas terminan).

### Multi-tenant (clientes)
- Entidad `clientes` + campo **`cliente_id`** en todas las entidades (`src/types.ts`, schema en `instantDb.ts`).
- El **interruptor** `multitenantEnabled()` (localStorage `rutaescolar_multitenant_enabled`) controla si los upserts envían `cliente_id` y si las queries filtran por `where: { cliente_id }`. Mientras esté inactivo, todo funciona como single-tenant.
- **Activación (requiere dashboard de InstantDB):** crear la entidad `clientes` (nombre, plan, activo, created_at) y agregar el atributo `cliente_id` (texto, opcional) a colegios, representantes, alumnos, conductores, rutas_diarias, paradas_ruta, tracking_logs, usuarios, eventos_ruta, webhook_logs. Luego en la app: menu **Clientes** → "Activar multi-cliente".
- Roles: `superadmin` (dueño, gestiona clientes) · `admin` (colegio, su cliente) · `conductor` (sus rutas). Resolución en `App.handleStaffLogin` desde `usuarios.email` / `conductores.email`.
- Al agregar una entidad nueva, incluye `cliente_id` en el schema, en el upsert (gated por `multitenantEnabled()`) y en el `where` del query.

## 6. Cómo añadir una feature (flujo recomendado)

1. **Tipos primero**: extender `src/types.ts` y el schema en `instantDb.ts` si hay nuevos campos.
2. **Servicio**: lógica en `src/services/` (testeable, sin UI).
3. **Componente**: UI en `src/components/<Area>/`.
4. **Integrar en App.tsx**: estado + handler + render condicional en el switch de vistas.
5. **Persistir**: InstantDB + localStorage.
6. **Verificar**: `npm run lint` y `npm run build`.

## 7. Testing

No hay suite de tests automatizados todavía (solo typecheck y build). Recomendado:
- Agregar tests unitarios para `routeCalculator.ts` (fórmulas, variantes, normalizeDays).
- Agregar tests para `routeHistory.ts` (snapshot, upsert).

## 8. Deployment

### Build
```bash
npm run build   # genera dist/ con assets relativos (base './')
```

### Servir (Cloud Run / Node)
```bash
NODE_ENV=production npm start
```
- `server.ts` resuelve `dist/` desde cwd, `__dirname` o `../`.
- Fallback SPA solo para rutas sin extensión (evita MIME text/html en assets).
- Service worker `v3` es network-first para HTML (los usuarios se actualizan solos).

### Subpath
La app funciona bajo subpath (`https://host/app/`) gracias a `base: './'` en Vite.

## 9. Troubleshooting común

| Problema | Causa | Fix |
|---|---|---|
| Pantalla en blanco | Error de runtime | ErrorBoundary muestra fallback; revisar consola |
| MIME text/html en assets | Caché vieja del SW / build viejo | Redesplegar + recargar 2 veces (SW network-first) |
| Alumnos no salen en la lista de ruta | `dias_ruta` como string o día sin marcar | `normalizeDays()` + verificar selector de día |
| Modalidad incorrecta en lista | `modalidad_servicio` no mapeado | El mapeo de App.tsx ya lo copia (fix `72126d1`) |
| Puerto 3000 con HTML raro | Otro servicio ocupando el puerto | Cerrarlo o cambiar PORT en server.ts |
| No veo cambios tras push | Service worker cacheando | Recargar con DevTools abierto → SW → Update |

## 10. Git

```bash
git add -A
git commit -m "feat/fix/chore: descripción"
git push origin main
```

**Convención de mensajes:** `feat:`, `fix:`, `chore:`, `docs:` — con descripción en español.
