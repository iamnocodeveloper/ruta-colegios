# 📚 Documentación del Sistema — RutaEscolar PWA

> **Documento vivo**: actualizar siempre que haya avances, mejoras o cambios en el sistema.
> **Última actualización:** 24/08/2026

---

## 📑 Índice de Documentación

| Documento | Descripción |
|---|---|
| [`docs/MEMORIA.md`](docs/MEMORIA.md) | 🧠 Memoria del proyecto: decisiones, contexto, estado mental |
| [`docs/AVANCES.md`](docs/AVANCES.md) | 🚀 Registro cronológico de avances por commit y fase |
| [`docs/DESCRIPCION_SISTEMA.md`](docs/DESCRIPCION_SISTEMA.md) | 🏫 Descripción funcional y técnica profunda (servicios, componentes, flujos) |
| [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) | 🔒 Auditoría de seguridad y recomendaciones de hardening |
| [`docs/GUIA_DESARROLLO.md`](docs/GUIA_DESARROLLO.md) | 🛠️ Guía para desarrolladores (setup, convenciones, deploy) |

---

## 1. Resumen del Proyecto

**RutaEscolar** es una aplicación web **PWA (Progressive Web App)** de optimización y seguimiento de **transporte escolar** para instituciones educativas. Permite:

- Calcular rutas óptimas de recogida de alumnos con **algoritmo de salida inversa** (hora de salida = hora límite de llegada − tiempo total estimado).
- Que el **conductor** ejecute la ruta del día y marque **recogido / ausente / pendiente** en cada parada.
- Que los **representantes** sigan en vivo la posición de la unidad y el estado de su hijo.
- Gestionar **alumnos, colegios, conductores y representantes** con sincronización en tiempo real.
- Guardar un **historial completo de rutas creadas** con enlaces de revisión (solo lectura).

**Repositorio:** https://github.com/iamnocodeveloper/ruta-colegios
**Rama principal:** `main`

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | React 19 + TypeScript 5.8 + Vite 6 |
| **Estilos** | Tailwind CSS v4 (design system Soft UI propio vía `@theme`) |
| **Iconos** | lucide-react |
| **Mapas** | Leaflet + tiles CartoDB Voyager + OSRM (rutas) + Nominatim (geocoding) |
| **Backend (dev)** | Express + Vite middleware (`server.ts`, puerto 3000) |
| **Base de datos en tiempo real** | InstantDB (`@instantdb/react`) — App ID `9bfbca9b-1445-4948-98f4-70bfcf2164a2` |
| **Informes PDF** | jspdf + jspdf-autotable (descarga directa, texto vectorial) |
| **Persistencia local** | localStorage (fallback resiliente) |
| **Animación / drag & drop** | motion (Reorder) — reordenamiento de paradas por arrastre |
| **Package manager** | Bun (`bun.lock`) / npm compatible |

### Scripts

```bash
npm run dev       # servidor dev (tsx server.ts) en http://localhost:3000
npm run build     # build producción (vite build + esbuild server)
npm run start     # sirve dist/ con node
npm run lint      # typecheck (tsc --noEmit)
```

---

## 3. Arquitectura de Carpetas

```
src/
├── App.tsx                      # Componente raíz: auth, vistas, estado global, handlers
├── types.ts                     # Modelo de datos (Colegio, Alumno, Conductor, RutaDiaria...)
├── index.css                    # Design system Soft UI (@theme tokens) + estilos Leaflet
├── components/
│   ├── Layout/                  # AppSidebar (navegación lateral) + AppHeader (top bar + drawer móvil)
│   ├── Home/                    # HomeDashboard (dashboard Bento: KPIs, gauge, timeline, feed)
│   ├── Driver/                  # DriverPanelSimple (cabina del conductor simplificada)
│   ├── Admin/                   # RoutePlanner, StudentManager, SchoolManager, DriverManager,
│   │                            # RouteHistory, RouteReviewView, SqlSchemaViewer
│   ├── Parent/                  # ParentPortal (portal del representante)
│   ├── Auth/                    # LoginGateway, InstantAuthModal, InstantSyncBadge
│   ├── Map/                     # SchoolRouteMap, LocationPicker
│   └── PWA/                     # PWAInstallBanner
├── services/
│   ├── instantDb.ts             # Cliente InstantDB: schema, seed, CRUD, auth
│   ├── routeCalculator.ts       # Algoritmo de optimización de rutas (TSP + salida inversa)
│   ├── routeHistory.ts          # Historial de rutas (localStorage + cloud)
│   └── mockData.ts              # Datos semilla (Quito, Ecuador)
server.ts                        # Servidor Express + API /api/tracking + Vite
public/                          # Manifest PWA, iconos, service worker
```

---

## 4. Modelo de Datos

### Entidades InstantDB (`instantDb.ts`)

| Entidad | Campos clave |
|---|---|
| `clientes` 🆕 | **Multi-tenant:** nombre, plan (basico/pro/premium/escolar), activo — aísla los datos por cliente (conductor/colegio) |
| `colegios` | nombre, direccion, lat, lng, hora_llegada_limite, contacto_telefono, **cliente_id** |
| `representantes` | nombre, telefono_whatsapp, magic_token, email |
| `alumnos` | nombre, colegio_id, representante_id, direccion_recogida, lat, lng, grado, notas_medicas, tiempo_abordaje_estimado_min, modalidad_servicio, **activo_en_rutas**, **dias_ruta** |
| `conductores` | nombre, telefono, licencia, vehiculo_modelo, vehiculo_placa, capacidad_pasajeros, activo |
| `rutas_diarias` | fecha, colegio_id, conductor_id, origen_lat/lng, modo_optimizacion, tipo_trayecto, hora_llegada_objetivo, hora_salida_estimada, tiempos, distancia_total_km, estado, polyline_json, **ida/vuelta** (jornadas embebidas) |
| `paradas_ruta` | ruta_id, alumno_id, orden, hora_estimada, hora_real, estado, lat, lng, distancias |
| `tracking_logs` | ruta_id, lat, lng, velocidad_kmh, rumbo_grados, timestamp |
| `usuarios` | email, nombre, rol |
| `eventos_ruta` 🔒 | **Auditoría (write-only, no visible en la app):** evento, ruta_id, fecha_ruta, colegio_id/nombre, conductor_id/nombre, parada_id, orden_parada, alumno_id/nombre, estado_anterior, estado_nuevo, hora_evento, detalle_json (payload completo), created_at |
| `webhook_logs` 🔒 | **Auditoría de envíos al webhook (write-only, no visible en la app):** evento, url_destino, payload_json, estado_envio (`pendiente`\|`enviado`\|`fallido`), intentos, http_status, duracion_ms, error_mensaje, timestamp, created_at |

🔒 = tablas de auditoría: se escriben automáticamente pero **NO se consultan desde la app** (no están en `db.useQuery`), por lo que nunca aparecen en la interfaz.

### Tipos de estado

- **Ruta:** `planificada` → `en_curso` → `completada` | `cancelada`
- **Parada:** `pendiente` → `recogido` | `ausente`
- **Modalidad de servicio:** `ida_y_vuelta` | `solo_ida` | `solo_vuelta`
- **Tipo de trayecto:** `ida` (mañana) | `vuelta` (tarde)
- **Rol de usuario:** `superadmin` (dueño) | `admin` (colegio) | `conductor`

### Multi-cliente (multi-tenant)

Una sola app puede atender a varios clientes (conductores/colegios). Cada cliente tiene su `cliente_id` en todas las entidades; el superadmin crea/activa clientes en **Clientes** y "Gestiona" cada uno (navega a sus pantallas). Para **activarlo** hace falta configurar el dashboard de InstantDB (entidad `clientes` + atributo `cliente_id` en las entidades) y pulsar "Activar multi-cliente" — ver `docs/AVANCES.md` Fase 13. Hasta entonces, la app funciona en modo single (sin `cliente_id`).

### Ruta combinada (ida + vuelta)

Un solo registro `RutaDiaria` puede contener **ambas jornadas**: los campos opcionales `ida` y `vuelta` (tipo `RutaTrayecto`) guardan cada trayecto con sus propias paradas, horarios, distancia, polyline y variante. `ruta.paradas` es la concatenación de ambas jornadas para que las vistas legacy (Inicio/Padres) sigan funcionando. Ver `src/services/routeJourneys.ts` (`getJourneys`, `journeyView`, `updateJourney`, `computeRutaEstado`).

---

## 5. Design System (Soft UI / Bento Grid)

Implementado en `src/index.css` con tokens Tailwind v4 `@theme`:

| Token | Valor | Uso |
|---|---|---|
| `--color-canvas` | `#F4F6FA` | Fondo de la app |
| `--color-surface` | `#FFFFFF` | Tarjetas / superficies |
| `--color-primary` | `#0084FF` | Acciones, ítems activos, links |
| `--color-neon` | `#D2F638` | Badges de acento (lima) |
| `--color-ink` | `#1C1E21` | Texto principal |
| `--color-muted` | `#8A94A6` | Texto secundario |
| `--color-alert` | `#FF5050` | Errores / ausentes |
| `--color-soft-blue` | `#EBF5FF` | Fondos azules suaves |
| `--color-soft-gray` | `#F7F8FA` | Chips / contenedores internos |
| `--color-line` | `#E6E9F0` | Bordes suaves |
| `--radius-card` | `22px` | Cards |
| `--radius-chip` | `12px` | Botones / chips |
| `--shadow-soft` | `0px 10px 30px rgba(0,0,0,0.03)` | Sombras suaves |

**Tipografía:** Plus Jakarta Sans (Google Fonts), weights 400/500/600/700/800.
**Iconografía:** lucide-react, trazo 2px, en contenedores redondeados.

---

## 6. Navegación

### Sidebar izquierdo (escritorio) + drawer móvil
Ítems: **Inicio · Cabina Conductor · Planificador · Alumnos · Colegios · Conductores · Historial**

- El ítem activo usa **pastilla blanca flotante** con texto azul `#0084FF`.
- Banner CTA inferior: "Optimiza con tráfico real" → abre el Planificador.
- **SQL ya NO está en el menú** (se accede por `?view=sql` o link discreto en Inicio).

### Vistas disponibles (URLs útiles)
| Vista | Acceso |
|---|---|
| Inicio (dashboard Bento) | `/` o `?view=home` |
| Cabina Conductor | sidebar / `?view=driver` |
| Planificador | sidebar / `?view=planner` |
| Alumnos | sidebar / `?view=students` |
| Colegios | sidebar / `?view=schools` |
| Conductores | sidebar / `?view=drivers` |
| **Clientes (solo superadmin)** | sidebar / `?view=clientes` |
| Historial de Rutas | sidebar / `?view=history` |
| Revisión de Ruta (solo lectura) | `?view=review&routeId=<id>` |
| Esquema SQL (oculto) | `?view=sql` |
| Portal Representante | `?magic=<token>` / `?student=<id>` |

---

## 7. Funcionalidades por Rol

### 👨‍💼 Staff / Administrador
- **Inicio (Dashboard Bento):** ruta de hoy con salida/llegada/distancia/paradas, KPIs de recogidos y matrícula, gauge de progreso, timeline de paradas, feed de actividad.
- **Cabina del Conductor (simplificada):** selección de conductor, ruta de hoy con botón EMPEZAR (y **selector de jornada IDA/VUELTA** en rutas combinadas), próximas paradas con RECOGIDO/AUSENTE/PENDIENTE, mapa de la ruta, lista de mis rutas.
- **Planificador:** cálculo de ruta (IDA/VUELTA), selección de colegio, conductor, origen, modo (estándar/tráfico real), tiempo de abordaje, itinerario con ETA **desplegable**, reorden de paradas por arrastre o desde el mapa, y **guardado por jornadas** ("Guardar Plan IDA" / "Guardar Plan VUELTA" → "Guardar Registro Completo" con ambos trayectos en un solo registro).
- **Gestión de Alumnos:** CRUD completo + **toggle Activo en Rutas** (alumno desactivado no entra en el cálculo de paradas) + copiar Magic Link + ver portal.
- **Gestión de Colegios:** CRUD con hora límite de llegada y GPS.
- **Gestión de Conductores:** CRUD con vehículo, placa, capacidad, estado activo.
- **Historial de Rutas:** listado de todas las rutas creadas con datos completos (paradas, horarios, conductor, colegio, km, tiempos), acciones: **Ver Recorrido** (solo lectura), **Generar PDF** (informe descargable), **Copiar Link de Revisión**, **Usar Hoy**, **Ver Todos los Datos**, **Eliminar**.

### 🚌 Conductor
- Ver **rutas asignadas** (filtradas por conductor desde el historial).
- **Empezar la ruta del día** (cambia a `en_curso` y registra hora de salida real).
- **Marcar recogido / ausente** en cada parada (con posibilidad de revertir a pendiente).
- Ver mapa en vivo de la ruta y las próximas paradas destacadas.

### 👨‍👩‍👧 Representante (Padre)
- Acceso por **Magic Link** o ID de alumno.
- Ver **estado en vivo** de su hijo (próxima parada, en camino, a bordo, entregado, ausente).
- Mapa interactivo con la unidad en tiempo real, dirección de recogida, contacto con el conductor por WhatsApp/teléfono.

---

## 8. Algoritmo de Optimización (`routeCalculator.ts`)

1. **Filtro de alumnos**: según modalidad de servicio (`ida`/`vuelta`) y **excluye alumnos con `activo_en_rutas === false`**.
2. **Secuencia óptima (TSP)**: Nearest Neighbor + 2-Opt heuristic (máx. 30 iteraciones) entre origen → paradas → colegio (ida) o colegio → paradas → origen (vuelta).
3. **Geometría real**: consulta a OSRM (`router.project-osrm.org`) con **rutas alternativas por tramo** (la ruta principal viene de una consulta de todo el recorrido; la alternativa se arma consultando los 3 tramos más largos A→B con `alternatives=true` + caché, y reemplazando esos segmentos). Fallback geométrico (factor 1.25 urbano + interpolación). La ruta elegida se persiste en `ruta_elegida` (`0` principal / `1..n` alternativa).
4. **Tiempos**: `T_manejo` (con factor tráfico 1.12 estándar / 1.35 tráfico real) + `T_abordaje = N × minutos_por_alumno`.
5. **Salida inversa**: `H_salida = H_llegada_limite − T_total` (trayecto ida) o desde hora fija (vuelta).
6. **ETAs por parada**: acumulación de tiempo de manejo + abordaje por parada.
7. **Orden manual (`ordenManual`)**: si el usuario reordena paradas (flechas ↑/↓, **drag & drop** o **modo "Editar Orden en Mapa"**), la secuencia se respeta tal cual y la variante pasa a **"Manual"** (rojo). Un orden parcial desde el mapa se completa con el resto de paradas en su orden relativo.

---

## 9. Historial y Revisión de Rutas (`routeHistory.ts`)

- Cada vez que se guarda una ruta (`handleSaveRoute`), se persiste un **snapshot completo** (`RouteHistoryEntry`) con: id, fecha, colegio, conductor, estado, horarios, distancia, tiempos, nº paradas, recogidos/ausentes, modo, trayecto, `created_at` y la **ruta completa** (paradas + polyline).
- Almacenamiento: **localStorage** (clave `rutaescolar_route_history`, tope 200 entradas) + sync best-effort a InstantDB.
- **Link de revisión**: `GET /?view=review&routeId=<id>` muestra la vista `RouteReviewView` (mapa + itinerario + resumen) **sin opciones de edición y SIN login**. Busca primero en el historial local y, si no está, **carga la ruta desde la nube (InstantDB)**, por lo que funciona en cualquier dispositivo con el enlace.
- **Informe PDF**: `generateRoutePdf(entry)` (`src/services/pdfReport.ts`) descarga un informe A4 de texto con encabezado, resumen y tabla de paradas coloreada por estado — accesible desde Historial y Ver Recorrido.
- Acciones del historial: ver recorrido, **generar PDF**, copiar link, **usar hoy** (replica la ruta con fecha actual y paradas en pendiente), eliminar.

---

## 10. Autenticación

- **Puerta de acceso obligatoria** (`LoginGateway`) antes de cualquier vista operativa.
- **Dueño/admin**: acceso directo con `admin@demo.com` / `123456` (botón 1-click) — es el superadmin. **Otros usuarios** (admin de colegio / conductor): login por **InstantDB Magic Code** (email + código de 6 dígitos); al autenticar se resuelve rol y cliente desde `usuarios.email` o `conductores.email`.
- **Representante**: acceso por ID de alumno o Magic Link (`?magic=<token>&student=<id>`).
- Sesión persistida en `localStorage` (`rutaescolar_staff_session`, `rutaescolar_parent_student_id`).
- Badge `InstantSyncBadge` en el header muestra estado de conexión/autenticación; el modal `InstantAuthModal` permite auth de InstantDB y reseed (herramienta de desarrollo).

---

## 11. API del Servidor (`server.ts`)

| Ruta | Método | Descripción |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/tracking` | POST | Registra punto GPS (routeId, lat, lng, velocidad, rumbo) |
| `/api/tracking/:routeId` | GET | Último tracking de una ruta |

En dev, Vite sirve el frontend; en producción se sirve `dist/` (SPA fallback a `index.html`).

---

## 11.1 Sistema de Eventos y Webhook n8n (`webhookNotifier.ts`)

Cada evento de ejecución de ruta dispara automáticamente un **POST JSON silencioso** al webhook de n8n:

**URL:** `https://joel-n8n-2026.rddxeh.easypanel.host/webhook/not-ruta`

| Evento | Disparador |
|---|---|
| `ruta_iniciada` | Conductor presiona EMPEZAR RUTA (estado → `en_curso`, registra `hora_salida_real`) |
| `parada_recogida` | Parada marcada como `recogido` |
| `parada_ausente` | Parada marcada como `ausente` |
| `parada_revertida` | Parada devuelta a `pendiente` |
| `ruta_completada` | Auto: todas las paradas procesadas con ruta `en_curso` (registra `hora_llegada_real`) · Manual: botón FINALIZAR RUTA en la cabina |

### Estructura del JSON enviado

```json
{
  "evento": "ruta_iniciada | parada_recogida | parada_ausente | parada_revertida | ruta_completada",
  "fecha_evento": "2026-08-23T09:15:00.000-05:00",
  "app": "RutaEscolar",
  "ruta": {
    "id", "nombre": "Ruta IDA - <Colegio> - <fecha>",
    "fecha", "dia_semana", "tipo_trayecto", "estado", "modo_optimizacion", "variante",
    "hora_llegada_objetivo", "hora_salida_estimada", "hora_salida_real", "hora_llegada_real",
    "tiempo_manejo_estimado_min", "tiempo_abordaje_total_min", "tiempo_total_estimado_min", "distancia_total_km",
    "origen": { "direccion", "lat", "lng" },
    "colegio": { "id", "nombre", "direccion", "lat", "lng", "hora_llegada_limite", "contacto_telefono" },
    "conductor": { "id", "nombre", "telefono", "licencia", "vehiculo_modelo", "vehiculo_placa", "capacidad_pasajeros" },
    "resumen": { "total_paradas", "recogidos", "ausentes", "pendientes" },
    "paradas": [ { "...datos parada...", "alumno": { "...ver abajo..." } } ]
  },
  "parada": { "id", "ruta_id", "orden", "estado", "hora_estimada", "hora_real", "lat", "lng" },
  "alumno": {
    "id", "nombre", "grado", "direccion_recogida", "lat", "lng",
    "notas_medicas", "modalidad_servicio", "activo_en_rutas", "dias_ruta",
    "representante": { "id", "nombre", "telefono_whatsapp", "email" },
    "colegio": { "id", "nombre", "direccion", "hora_llegada_limite" }
  }
}
```

> `parada` y `alumno` solo se incluyen en eventos de paradas. En `parada_*`, la ruta incluye el `resumen` actualizado tras el cambio.

### Confiabilidad (todo silencioso, nunca visible en la UI)

- POST con timeout de 10 s y **reintentos internos** con backoff (inmediato → 1 s → 5 s).
- Si todos los intentos fallan, el evento queda en **cola local** (`localStorage`: `rutaescolar_webhook_queue`, tope 100) y se reintenta en el próximo evento o al cargar la app.
- Cada envío se audita en InstantDB: `eventos_ruta` (el evento y su payload completo) + `webhook_logs` (estado del envío, intentos, HTTP status, duración, error).
- Errores solo en consola; la app jamás muestra errores ni confirmaciones por el webhook.

### Auditoría en InstantDB (write-only)

- `logEventoRutaInstant()` → guarda cada evento en `eventos_ruta`.
- `createWebhookLogInstant()` / `updateWebhookLogInstant()` → gestionan el registro de cada envío en `webhook_logs`.
- Estas entidades **no están en `db.useQuery`** de `App.tsx`, por lo que no aparecen en ninguna vista. Solo consulta directa desde el dashboard de InstantDB.

---

## 12. Estado Actual y Mejoras Recientes

### ✅ Implementado
- [x] Rediseño completo **Soft UI / Bento Grid** (tema claro global).
- [x] Sidebar lateral + header + drawer móvil con la nueva estética.
- [x] Dashboard Inicio con KPIs, gauge, timeline y feed.
- [x] **Cabina del conductor simplificada** (empezar ruta, marcar recogido/ausente/pendiente, ver rutas asignadas).
- [x] **Toggle Activo en Rutas** por alumno (excluido del cálculo de paradas).
- [x] **Días de ruta por alumno** (checkboxes Lun–Vie) con carga automática del listado según día + modalidad.
- [x] **Variantes de ruta**: cálculo de 4 alternativas (Óptima 2-Opt, Vecino Cercano, Extremos Primero, Aleatoria), cada una con **color propio en el mapa**, distancia mostrada y badge **MÁS CORTA**.
- [x] **Reordenamiento manual** de paradas con variante "Manual" en rojo.
- [x] **Itinerario desplegable** (acordeón, cerrado por defecto): al colapsarlo el mapa crece a `calc(100vh-320px)` para planificar con más contexto.
- [x] **Reorden por arrastre (drag & drop)** en el itinerario (motion `Reorder`): asa ⋮⋮ por fila; al soltar se renumera todo (mover la #1 al final hace que #2 pase a ser la #1) y se recalcula la ruta.
- [x] **Reorden desde el mapa**: botón "✏️ Editar Orden en Mapa" — toca los marcadores en el nuevo orden (verde + nueva posición, progreso `X/N`, "Aplicar" admite orden parcial, "Cancelar" aborta). **Re-tocar una parada la desmarca** (toggle) y el mapa mantiene su tamaño/zoom durante la marcación.
- [x] **Ruta completa con jornadas**: una sola ruta guarda **ida + vuelta** (tipo `RutaTrayecto`). El planificador guarda cada jornada por separado y luego el "registro completo"; la cabina del conductor tiene selector de jornada, y el historial/revisión/PDF muestran ambas jornadas.
- [x] **Rutas alternativas estilo Google Maps**: OSRM con `alternatives=true` devuelve ruta principal + alternativa (mismas paradas, calles distintas) en **dos colores**; selector "Rutas sugeridas (calles)" en el Planificador (persiste `ruta_elegida`) y toggle en la cabina del conductor.
- [x] **Actualización PWA visible**: banner "Nueva versión disponible · Actualizar" + indicador de versión `v{APP_VERSION}` en el header + service worker `rutaescolar-v4` (network-first HTML, `SKIP_WAITING`).
- [x] **Multiusuarios (multi-tenant real)**: entidad `clientes` + `cliente_id` en todas las entidades, login por rol (`superadmin`/`admin`/`conductor` vía Magic Code, backdoor demo solo en dev), aislamiento de datos por cliente, gestor de clientes con activación, planes, respaldo descargable e importador CSV de alumnos. *(Requiere configurar el dashboard de InstantDB para activarlo — Fase 13.)*
- [x] **Historial de rutas** con snapshot completo y persistencia.
- [x] **Informe en PDF** de cada ruta (`jspdf` + `jspdf-autotable`): encabezado con colegio/fecha/trayecto, resumen con conductor y tiempos, tabla de paradas (# · Alumno · Ubicación · Hora · Dist. · Estado) con colores por estado — solo texto, sin mapas/imágenes. Botones "Generar PDF" (Historial) y "Descargar PDF" (Ver Recorrido).
- [x] **Link de revisión solo lectura** (`?view=review&routeId=`).
- [x] **Botones de navegación y contacto** por parada: Waze, Google Maps, Llamar Representante, WhatsApp (en revisión, cabina, historial y cards de alumnos).
- [x] SQL oculto del menú (acceso por URL).
- [x] PWA instalable (manifest + service worker).
- [x] Mapa Leaflet con paradas numeradas, polyline y unidad en vivo.
- [x] **ErrorBoundary global** (nunca pantalla en blanco).
- [x] **Fix deploy**: assets relativos (`base: './'`), fallback SPA solo sin extensión, service worker network-first (`v3`).
- [x] **Fix datos**: `normalizeDays()` (días como string JSON de InstantDB), `modalidad_servicio` mapeado desde InstantDB.
- [x] **Webhook n8n para eventos de ejecución** (`ruta_iniciada`, `parada_recogida`, `parada_ausente`, `parada_revertida`, `ruta_completada`) con reintentos silenciosos y cola local — ver sección 11.1.
- [x] **Auditoría en InstantDB**: tablas write-only `eventos_ruta` + `webhook_logs` (no visibles en la app).
- [x] **Auto-finalización de ruta**: al procesarse todas las paradas la ruta pasa a `completada` automáticamente.
- [x] **Botón FINALIZAR RUTA** manual en la cabina del conductor (visible solo con ruta en curso).

### 🔒 Seguridad (auditoría completada — ver `docs/SEGURIDAD.md`)
- ✅ `npm audit`: **0 vulnerabilidades** (323 dependencias).
- ⚠️ 7 hallazgos de severidad Alta (headers Express, backdoor demo, sesión localStorage, magic tokens, portal por ID, PII local) — **prototipo demo, no apto para producción real sin hardening**.

### 🔜 Pendientes / Ideas de mejora
- [ ] **🔔 Notificación de cercanía del conductor** (para que el alumno se aliste antes de la llegada):
  - **Concepto:** cuando el bus esté a X km / Y minutos de la parada de un alumno, notificar automáticamente a su representante ("El bus está cerca, alista a tu hijo").
  - **Base existente:** `ParentPortal.tsx` ya calcula en vivo la distancia bus→alumno (`distanceToStudentKm`) con las coordenadas GPS de `/api/tracking`.
  - **Disparo sugerido:** umbral configurable (ej. < 500 m o ETA < 3 min) evaluado en cada punto de tracking; disparar una sola vez por alumno/ruta (flag anti-duplicados).
  - **Canales candidatos:** Web Push API (PWA ya instalable) y/o flujo n8n → WhatsApp/SMS usando `telefono_whatsapp` del representante.
  - **Datos necesarios:** posición GPS en curso (ya existe), parada pendiente del alumno (ya existe), token push o webhook n8n (infraestructura de eventos ya implementada).
- [ ] Vista de perfil por conductor con login propio (email/código) que filtre automáticamente sus rutas.
- [ ] Notificaciones push (PWA) al representante cuando el bus está cerca.
- [ ] Reporte semanal/mensual de asistencia (recogidos vs ausentes por alumno).
- [ ] Exportar rutas a PDF/CSV desde el historial.
- [ ] Multi-colegio con selección persistente por usuario.
- [ ] Pantalla de completado con resumen (al llegar al colegio).
- [ ] Modo offline completo con cola de sincronización (hoy localStorage es el fallback).

---

## 13. Datos Demo (Quito, Ecuador)

> ⚠️ **La app NO genera datos demo.** No hay auto-seed ni botones de seed en la UI; la fuente de verdad es siempre InstantDB. Los datos demo (`src/services/mockData.ts`) solo existen como definición y `seedInstantDatabase()` no se invoca desde la app.

- **Colegio:** Colegio San Gabriel (Av. América y Mariana de Jesús) — llegada límite 07:45.
- **Conductores:** Juan Carlos Guamán (PBX-4521), Maritza Villacís (PCZ-8910), Segundo Toapanta (PAA-3322).
- **Alumnos:** 5 alumnos con modalidades mixtas (ida y vuelta, solo ida, solo vuelta).
- **Origen:** Base de operaciones, Sector La Pradera.
- **Credenciales demo staff:** `admin@demo.com` / `123456` (acceso del dueño/superadmin).

---

## 14. Comandos Útiles

```bash
# Desarrollo
npm run dev

# Typecheck
npm run lint          # = tsc --noEmit

# Build producción
npm run build

# Commit + push
git add -A
git commit -m "mensaje"
git push origin main
```

---

*Documento mantenido manualmente. Actualizar tras cada cambio relevante en el sistema.*
