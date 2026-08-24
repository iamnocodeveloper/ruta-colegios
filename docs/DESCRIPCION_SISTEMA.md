# 🏫 Descripción del Sistema — RutaEscolar PWA

> **Descripción funcional y técnica profunda.** Incluye el modelo de datos completo, referencia de servicios, componentes, flujos y API.
> **Última actualización:** 24/08/2026

---

## 1. Resumen funcional

RutaEscolar es un sistema de **transporte escolar** con 3 roles:

| Rol | Qué puede hacer |
|---|---|
| **Staff / Administrador** | Planificar rutas óptimas, gestionar alumnos/colegios/conductores, ver historial, revisar rutas |
| **Conductor** | Ver sus rutas asignadas, empezar la ruta del día, marcar recogido/ausente/pendiente por parada, navegar a cada parada |
| **Representante (padre)** | Seguir en vivo la posición del bus y el estado de su hijo, contactar al conductor |

El sistema está construido como **SPA + PWA** con **InstantDB** (base de datos en tiempo real en la nube) y **localStorage** como capa de resiliencia local.

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    NAVEGADOR (PWA)                       │
│  React 19 + TypeScript + Tailwind v4 (Soft UI)          │
│  ┌───────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ AppSidebar│  │  AppHeader │  │   Vistas (switch)  │  │
│  │  App.tsx  │  │  (auth)    │  │  Home/Driver/Admin │  │
│  └─────┬─────┘  └─────┬──────┘  └─────────┬──────────┘  │
│        │              │                    │             │
│        └──────────────┼────────────────────┘             │
│                       ▼                                 │
│          ┌──────────────────────────┐                    │
│          │      Servicios           │                    │
│          │  instantDb.ts            │                    │
│          │  routeCalculator.ts      │                    │
│          │  routeHistory.ts         │                    │
│          └──────┬──────────┬────────┘                    │
└─────────────────┼──────────┼────────────────────────────┘
                  │          │
        ┌─────────▼──┐  ┌────▼─────────┐
        │  InstantDB │  │  localStorage│
        │  (nube RT) │  │  (fallback)  │
        └────────────┘  └──────────────┘
                  │
        ┌─────────▼───────────────────────────────┐
        │  Servidor Express (server.ts) :3000      │
        │  - /api/health, /api/tracking            │
        │  - sirve dist/ en producción (SPA)       │
        └──────────────────────────────────────────┘
```

**Servicios externos usados:**
- **OSRM** (`router.project-osrm.org`) — geometría de ruta y tiempos reales.
- **Nominatim** (OSM) — geocoding reverse y búsqueda de direcciones.
- **CartoDB Voyager** — tiles de mapa.
- **Leaflet** — renderizado del mapa.
- **InstantDB** — base de datos + auth magic code.
- **Google Maps / Waze / WhatsApp / tel:** — navegación y contacto (links).

---

## 3. Modelo de datos (types.ts)

### Tipos principales

```ts
interface Colegio { id, nombre, direccion, lat, lng, hora_llegada_limite, contacto_telefono? }
interface Representante { id, nombre, telefono_whatsapp, magic_token, email? }
interface Conductor { id, nombre, telefono, email?, licencia?, vehiculo_modelo?,
                       vehiculo_placa?, capacidad_pasajeros?, foto_url?, activo }
interface Alumno { id, nombre, colegio_id, representante_id, direccion_recogida, lat, lng,
                   grado?, notas_medicas?, tiempo_abordaje_estimado_min?,
                   modalidad_servicio?, activo_en_rutas?, dias_ruta?, colegio?, representante? }
interface ParadaRuta { id, ruta_id, alumno_id, orden, hora_estimada, hora_real?,
                       estado, lat, lng, distancia_desde_anterior_km?, tiempo_desde_anterior_min? }
interface RutaDiaria { id, fecha, colegio_id, origen_lat, origen_lng, modo_optimizacion,
                       tipo_trayecto?, dia_semana?, variante?, hora_llegada_objetivo,
                       hora_salida_estimada, hora_salida_real?, hora_llegada_real?,
                       tiempo_manejo_estimado_min, tiempo_abordaje_total_min,
                       tiempo_total_estimado_min, distancia_total_km, estado,
                       tiempo_abordaje_por_alumno_min, colegio?, conductor_id?, conductor?,
                       paradas, polyline_geometry? }
interface TrackingLog { id?, ruta_id, lat, lng, velocidad_kmh?, rumbo_grados?, timestamp }
```

### Tipos de estado (enums como uniones)

```ts
type ModalidadTransporte = 'ida_y_vuelta' | 'solo_ida' | 'solo_vuelta';
type TipoTrayecto = 'ida' | 'vuelta';
type ModoOptimizacion = 'fijo' | 'trafico_real';
type EstadoRuta = 'planificada' | 'en_curso' | 'completada' | 'cancelada';
type EstadoParada = 'pendiente' | 'recogido' | 'completado' | 'ausente';
```

---

## 4. Referencia de servicios

### 4.1 `src/services/instantDb.ts` — Cliente InstantDB

**Constante:** `INSTANT_APP_ID = '9bfbca9b-1445-4948-98f4-70bfcf2164a2'` (público por diseño).

**Schema (8 entidades):** `colegios`, `representantes`, `alumnos`, `conductores`, `rutas_diarias`, `paradas_ruta`, `tracking_logs`, `usuarios`.

| Función | Firma | Qué hace |
|---|---|---|
| `isValidUUID` | `(str?: string) => boolean` | Valida formato UUID |
| `ensureUUID` | `(existingId?: string) => string` | Devuelve el ID si es UUID válido, si no genera uno |
| `seedInstantDatabase` | `(force?: boolean) => Promise<boolean>` | Siembra colegios, representantes, alumnos, conductores, admin demo, ruta inicial y paradas |
| `upsertColegioInstant` | `(colegio) => Promise<string>` | Crea/actualiza colegio |
| `deleteColegioInstant` | `(colegioId) => Promise<void>` | Elimina colegio |
| `upsertRepresentanteInstant` | `(rep) => Promise<string>` | Crea/actualiza representante |
| `upsertAlumnoInstant` | `(alumno, rep?) => Promise<string>` | Crea/actualiza alumno (+ representante) |
| `deleteAlumnoInstant` | `(alumnoId) => Promise<void>` | Elimina alumno |
| `updateAlumnoActivoRutasInstant` | `(alumnoId, activo) => Promise<void>` | Toggle activo en rutas |
| `upsertConductorInstant` | `(conductor) => Promise<string>` | Crea/actualiza conductor |
| `deleteConductorInstant` | `(conductorId) => Promise<void>` | Elimina conductor |
| `saveRutaInstant` | `(ruta) => Promise<string>` | Guarda ruta + todas sus paradas |
| `updateParadaEstadoInstant` | `(paradaId, estado, horaReal?) => Promise<void>` | Actualiza estado de una parada |
| `updateRutaEstadoInstant` | `(rutaId, estado, extra?) => Promise<void>` | Actualiza estado de la ruta |
| `recordTrackingInstant` | `(rutaId, lat, lng, velocidad?, rumbo?) => Promise<string>` | Registra punto GPS |

**Exports:** `db` (cliente inicializado), `tx`, `id`.

### 4.2 `src/services/routeCalculator.ts` — Algoritmo de rutas

| Función | Firma | Qué hace |
|---|---|---|
| `calculateHaversineDistance` | `(lat1, lon1, lat2, lon2) => number` | Distancia en km entre dos coordenadas |
| `filterStudentsForJourney` | `(students, tipoTrayecto?, dia?) => Alumno[]` | Filtra por modalidad + día + activo |
| `weekdayLabel` | `(date?) => string` | Label del día ('Lun'...'Vie') |
| `normalizeDays` | `(dias: any) => string[]` | Normaliza dias_ruta (array/string JSON/CSV) → array |
| `timeStringToMinutes` | `(timeStr) => number` | "HH:MM:SS" → minutos |
| `minutesToTimeString` | `(totalMinutes) => string` | minutos → "HH:MM:SS" |
| `formatFriendlyTime` | `(timeStr) => string` | "HH:MM:SS" → "7:15 AM" |
| `solveOptimalSequence` | `(start, end, students) => Alumno[]` | TSP Nearest Neighbor + 2-Opt |
| `calculateTotalRouteDistance` | `(start, end, sequence) => number` | Distancia total de una secuencia |
| `generateRouteVariants` | `(start, end, students) => Variant[]` | 4 variantes: 2opt, nearest, farthest, random |
| `variantDistance` | `(start, end, studentIds, alumnosMap) => number` | Distancia haversine de una variante |
| `fetchRoadGeometryAndDuration` | `(points, mode) => Promise<{polyline, realDrivingMinutes, totalDistanceKm}>` | OSRM con fallback geométrico |
| `calculateOptimizedRoute` | `(origin, school, students, options) => Promise<RouteOptimizationResult>` | Motor principal |

**Fórmulas del algoritmo:**
- `T_abordaje = N × tiempoAbordajeMin`
- `T_total = T_manejo + T_abordaje`
- `H_salida(ida) = H_llegada_limite − T_total`
- `H_salida(vuelta) = hora fija` (default 14:00)
- Factor tráfico: `fijo = 1.12`, `trafico_real = 1.35`
- Velocidad estimada fallback: `fijo = 28 km/h`, `trafico_real = 20 km/h`

**`generateRouteVariants` estrategias:**
1. `2opt` — Nearest Neighbor + 2-Opt (menor distancia probable, default)
2. `nearest` — Vecino más cercano puro (greedy)
3. `farthest` — Extremo más lejano primero (barrido geográfico)
4. `random` — Shuffle + reorden greedy (exploración)

**`calculateOptimizedRoute` — opción `ordenManual`:**
- Si `options.ordenManual` coincide en longitud con la lista de alumnos elegibles, la secuencia se respeta tal cual (sin re-optimizar).
- Es el mecanismo detrás de las **flechas ↑/↓**, el **drag & drop** y el **reorden desde el mapa** → la variante activa pasa a `manual` (rojo).
- Si el orden manual está incompleto (orden parcial desde el mapa), `RoutePlanner.buildFullOrder()` completa la secuencia con el resto de paradas en su orden relativo.

### 4.3 `src/services/routeHistory.ts` — Historial de rutas

| Función | Firma | Qué hace |
|---|---|---|
| `buildHistoryEntry` | `(ruta) => RouteHistoryEntry` | Crea snapshot completo de una ruta |
| `saveRouteToHistory` | `(ruta) => Promise<RouteHistoryEntry>` | Guarda/actualiza en historial (localStorage, tope 200) + sync cloud |
| `getRouteHistory` | `() => RouteHistoryEntry[]` | Lista todo el historial |
| `getRouteHistoryById` | `(routeId) => RouteHistoryEntry \| undefined` | Busca una ruta |
| `deleteRouteHistory` | `(routeId) => RouteHistoryEntry[]` | Elimina del historial |
| `buildRouteReviewLink` | `(routeId) => string` | Genera URL de revisión pública |

**Clave localStorage:** `rutaescolar_route_history`

### 4.4 `src/services/mockData.ts` — Datos demo

- `INITIAL_SCHOOL_ID`, `SECOND_SCHOOL_ID`
- `INITIAL_CONDUCTORES` (3), `INITIAL_SCHOOL`, `INITIAL_DRIVER_ORIGIN`
- `INITIAL_REPRESENTANTES` (5), `INITIAL_ALUMNOS` (5 con `dias_ruta` variados)

---

## 5. Referencia de componentes

### Layout
| Componente | Props | Descripción |
|---|---|---|
| `AppSidebar` | `currentView, onNavigate` | Sidebar con marca, 7 ítems (sin SQL), banner CTA |
| `AppHeader` | `currentView, demoUser, onOpenAuthModal, onSignOut, onNavigate, onToggleMobileMenu, mobileMenuOpen` | Top bar + drawer móvil |

### Home
| Componente | Props | Descripción |
|---|---|---|
| `HomeDashboard` | `ruta, colegio, alumnos, conductores, onNavigate` | Dashboard Bento: card Ruta de Hoy, KPIs, gauge, timeline, feed |

### Driver
| Componente | Props | Descripción |
|---|---|---|
| `DriverPanelSimple` | `ruta, colegio, alumnosMap, conductores, currentDriverId, history, onSelectDriver, onUpdateRuta, onUpdateParada, onStartRoute` | Cabina simplificada: rutas asignadas, empezar, marcar paradas, navegación |

### Admin
| Componente | Props | Descripción |
|---|---|---|
| `RoutePlanner` | `colegios, selectedColegio, onSelectColegio, origen, onUpdateOrigen, allAlumnos, alumnosMap, activeRuta, conductores, onSaveRoute, onSwitchToDriver` | Planificador: día, IDA/VUELTA, variantes, itinerario desplegable, reorden por arrastre y desde el mapa, guardar |
| `StudentManager` | `alumnos, representantes, colegios, onSaveAlumno, onDeleteAlumno, onToggleActivoRutas, onOpenParentPortal` | CRUD alumnos + días + modalidad + toggle |
| `SchoolManager` | `colegios, alumnos, onSaveColegio, onDeleteColegio` | CRUD colegios |
| `DriverManager` | `conductores, activeRuta, onSaveConductor, onDeleteConductor, onSelectDriverForCockpit` | CRUD conductores |
| `RouteHistory` | `history, onReview, onUseToday, onDelete, onBack` | Listado historial con acciones |
| `RouteReviewView` | `entry, alumnosMap, onBack` | Vista solo lectura (link público) |
| `SqlSchemaViewer` | — | Visor de esquemas (oculto del menú) |

### Auth
| Componente | Props | Descripción |
|---|---|---|
| `LoginGateway` | `allStudents, onStaffLogin, onParentLogin` | Puerta de login (staff/parent) |
| `InstantAuthModal` | `isOpen, onClose, currentDemoUser, onSetDemoUser` | Modal auth InstantDB + reseed |
| `InstantSyncBadge` | `onOpenAuthModal, demoUser` | Badge de estado de conexión |

### Map
| Componente | Props | Descripción |
|---|---|---|
| `SchoolRouteMap` | `colegio, origen, onOriginChange?, paradas, alumnosMap, vanLocation?, polylineGeometry?, activeStopIndex?, highlightStudentId?, targetArrivalTime?, tipoTrayecto?, onMarkerClick?, polylineColor?, polylineDash?, reorderProgress?, className?` | Mapa Leaflet completo; `onMarkerClick` + `reorderProgress` habilitan el modo reorden (marcadores elegidos en verde con su nueva posición, siguiente a tocar con pulso) |
| `LocationPicker` | `lat, lng, onChange, title, pinType, currentAddress, height` | Picker de coordenadas con búsqueda |

### Otros
| Componente | Props | Descripción |
|---|---|---|
| `ParentPortal` | `alumno, colegio, ruta, alumnosMap, onSelectAnotherStudent, allStudents, onSignOut` | Portal del representante |
| `PWAInstallBanner` | — | Banner de instalación PWA + estado offline |
| `ErrorBoundary` | `children` | Captura errores, evita pantalla en blanco |

---

## 6. Flujos principales

### 6.1 Crear una ruta (Planificador → Guardar)
1. Seleccionar **día** (contador de alumnos por día).
2. Seleccionar **IDA/VUELTA** (filtra modalidad).
3. Lista de alumnos se **carga automáticamente** (día + modalidad + activo).
4. Genera **4 variantes** con colores; elegir una, o **reordenar manualmente**:
   - **Arrastra** las filas del itinerario (sección desplegable, cerrada por defecto) con el asa ⋮⋮.
   - O activa **"✏️ Editar Orden en Mapa"** y toca los marcadores en el orden deseado (progreso `X/N`, "Aplicar"/"Cancelar", admite orden parcial).
   - Cualquier cambio manual pasa la variante a **"Manual"** (rojo) y recalcula ETAs con `ordenManual`; "Restaurar Orden 2-Opt" revierte a la sugerencia algorítmica.
5. "GUARDAR Y ASIGNAR" → `handleSaveAndActivate` → `onSaveRoute` → `handleSaveRoute` (App.tsx) → InstantDB + historial.

### 6.2 Conductor ejecuta la ruta
1. Cabina → seleccionar conductor → ver "Mis Rutas" (del historial filtrado por conductor).
2. "EMPEZAR RUTA" → estado `en_curso` + hora de salida real.
3. Próxima parada destacada → **RECOGIDO / AUSENTE / PENDIENTE**.
4. Navegación rápida: Waze / Google Maps / Llamar rep / WhatsApp rep.

### 6.3 Representante sigue en vivo
1. Acceso por **magic link** o ID de alumno.
2. Hero card con estado (próxima parada / en camino / a bordo / entregado / ausente).
3. Mapa con la unidad (polling `/api/tracking/:routeId` cada 3s).
4. Contacto con conductor por WhatsApp / teléfono.

### 6.4 Revisión de ruta (link público)
1. URL `/?view=review&routeId=<id>`.
2. `App.tsx` busca en historial local → `RouteReviewView` (solo lectura, sin login).
3. Si no existe → "Ruta no encontrada" (porque el historial es local al navegador).

---

## 7. API del servidor (server.ts)

| Ruta | Método | Body | Respuesta |
|---|---|---|---|
| `/api/health` | GET | — | `{status, service, timestamp}` |
| `/api/tracking` | POST | `{routeId, lat, lng, velocidadKmh?, rumboGrados?}` | `{success, tracking}` |
| `/api/tracking/:routeId` | GET | — | `{latest}` o `{latest: null}` |

**Serving:** dev → Vite middleware; producción → `express.static(distPath)` con resolución robusta de dist (cwd/__dirname/../) + fallback SPA solo para rutas sin extensión.

---

## 8. PWA

- **Manifest:** `public/manifest.json` (`start_url: "/"`, theme `#0f172a`, iconos 192/512).
- **Service worker:** `public/sw.js` (`rutaescolar-v3`):
  - Navegación/HTML → **network-first** (fallback caché offline).
  - Assets hasheados (`/assets/index-*.js|css`) → cache-first.
  - API → nunca cacheada.
  - `skipWaiting` + `clients.claim` (actualización inmediata).
- **Meta:** `mobile-web-app-capable` + `apple-mobile-web-app-capable`.
- **Offline:** localStorage como capa de datos.

---

## 9. Variables de entorno (.env.example)

| Variable | Uso | Estado |
|---|---|---|
| `GEMINI_API_KEY` | IA (no usada en código actual) | Placeholder |
| `APP_URL` | URL del host | Placeholder |
| `INSTANT_APP_ID` | App ID de InstantDB (también hardcodeado en instantDb.ts) | Valor real |
| `MAPBOX_ACCESS_TOKEN` | Mapbox (no usado, se usa CartoDB) | Vacío |
