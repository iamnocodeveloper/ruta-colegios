# 📚 Documentación del Sistema — RutaEscolar PWA

> **Documento vivo**: actualizar siempre que haya avances, mejoras o cambios en el sistema.
> Última actualización: **22/08/2026**

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
| **Persistencia local** | localStorage (fallback resiliente) |
| **Animación** | motion |
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
| `colegios` | nombre, direccion, lat, lng, hora_llegada_limite, contacto_telefono |
| `representantes` | nombre, telefono_whatsapp, magic_token, email |
| `alumnos` | nombre, colegio_id, representante_id, direccion_recogida, lat, lng, grado, notas_medicas, tiempo_abordaje_estimado_min, modalidad_servicio, **activo_en_rutas** |
| `conductores` | nombre, telefono, licencia, vehiculo_modelo, vehiculo_placa, capacidad_pasajeros, activo |
| `rutas_diarias` | fecha, colegio_id, conductor_id, origen_lat/lng, modo_optimizacion, tipo_trayecto, hora_llegada_objetivo, hora_salida_estimada, tiempos, distancia_total_km, estado, polyline_json |
| `paradas_ruta` | ruta_id, alumno_id, orden, hora_estimada, hora_real, estado, lat, lng, distancias |
| `tracking_logs` | ruta_id, lat, lng, velocidad_kmh, rumbo_grados, timestamp |
| `usuarios` | email, nombre, rol |

### Tipos de estado

- **Ruta:** `planificada` → `en_curso` → `completada` | `cancelada`
- **Parada:** `pendiente` → `recogido` | `ausente`
- **Modalidad de servicio:** `ida_y_vuelta` | `solo_ida` | `solo_vuelta`
- **Tipo de trayecto:** `ida` (mañana) | `vuelta` (tarde)

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
| Historial de Rutas | sidebar / `?view=history` |
| Revisión de Ruta (solo lectura) | `?view=review&routeId=<id>` |
| Esquema SQL (oculto) | `?view=sql` |
| Portal Representante | `?magic=<token>` / `?student=<id>` |

---

## 7. Funcionalidades por Rol

### 👨‍💼 Staff / Administrador
- **Inicio (Dashboard Bento):** ruta de hoy con salida/llegada/distancia/paradas, KPIs de recogidos y matrícula, gauge de progreso, timeline de paradas, feed de actividad.
- **Cabina del Conductor (simplificada):** selección de conductor, ruta de hoy con botón EMPEZAR, próximas paradas con RECOGIDO/AUSENTE/PENDIENTE, mapa de la ruta, lista de mis rutas.
- **Planificador:** cálculo de ruta (IDA/VUELTA), selección de colegio, conductor, origen, modo (estándar/tráfico real), tiempo de abordaje, orden manual de paradas, itinerario con ETA.
- **Gestión de Alumnos:** CRUD completo + **toggle Activo en Rutas** (alumno desactivado no entra en el cálculo de paradas) + copiar Magic Link + ver portal.
- **Gestión de Colegios:** CRUD con hora límite de llegada y GPS.
- **Gestión de Conductores:** CRUD con vehículo, placa, capacidad, estado activo.
- **Historial de Rutas:** listado de todas las rutas creadas con datos completos (paradas, horarios, conductor, colegio, km, tiempos), acciones: **Ver Recorrido** (solo lectura), **Copiar Link de Revisión**, **Usar Hoy**, **Ver Todos los Datos**, **Eliminar**.

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
3. **Geometría real**: consulta a OSRM (`router.project-osrm.org`) con fallback geométrico (factor 1.25 urbano + interpolación).
4. **Tiempos**: `T_manejo` (con factor tráfico 1.12 estándar / 1.35 tráfico real) + `T_abordaje = N × minutos_por_alumno`.
5. **Salida inversa**: `H_salida = H_llegada_limite − T_total` (trayecto ida) o desde hora fija (vuelta).
6. **ETAs por parada**: acumulación de tiempo de manejo + abordaje por parada.

---

## 9. Historial y Revisión de Rutas (`routeHistory.ts`)

- Cada vez que se guarda una ruta (`handleSaveRoute`), se persiste un **snapshot completo** (`RouteHistoryEntry`) con: id, fecha, colegio, conductor, estado, horarios, distancia, tiempos, nº paradas, recogidos/ausentes, modo, trayecto, `created_at` y la **ruta completa** (paradas + polyline).
- Almacenamiento: **localStorage** (clave `rutaescolar_route_history`, tope 200 entradas) + sync best-effort a InstantDB.
- **Link de revisión**: `GET /?view=review&routeId=<id>` carga la ruta desde el historial y muestra la vista `RouteReviewView` (mapa + itinerario + resumen) **sin opciones de edición**.
- Acciones del historial: ver recorrido, copiar link, **usar hoy** (replica la ruta con fecha actual y paradas en pendiente), eliminar.

---

## 10. Autenticación

- **Puerta de acceso obligatoria** (`LoginGateway`) antes de cualquier vista operativa.
- **Staff**: login 1-click demo (`admin@demo.com` / `123456`) o **Magic Code** de InstantDB (email + código de 6 dígitos).
- **Representante**: acceso por ID de alumno o Magic Link (`?magic=<token>&student=<id>`).
- Sesión persistida en `localStorage` (`rutaescolar_staff_session`, `rutaescolar_parent_student_id`).
- Badge `InstantSyncBadge` en el header muestra estado de conexión/autenticación; el modal `InstantAuthModal` permite auth de InstantDB y reseed.

---

## 11. API del Servidor (`server.ts`)

| Ruta | Método | Descripción |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/tracking` | POST | Registra punto GPS (routeId, lat, lng, velocidad, rumbo) |
| `/api/tracking/:routeId` | GET | Último tracking de una ruta |

En dev, Vite sirve el frontend; en producción se sirve `dist/` (SPA fallback a `index.html`).

---

## 12. Estado Actual y Mejoras Recientes

### ✅ Implementado
- [x] Rediseño completo **Soft UI / Bento Grid** (tema claro global).
- [x] Sidebar lateral + header + drawer móvil con la nueva estética.
- [x] Dashboard Inicio con KPIs, gauge, timeline y feed.
- [x] **Cabina del conductor simplificada** (empezar ruta, marcar recogido/ausente/pendiente, ver rutas asignadas).
- [x] **Toggle Activo en Rutas** por alumno (excluido del cálculo de paradas).
- [x] **Historial de rutas** con snapshot completo y persistencia.
- [x] **Link de revisión solo lectura** (`?view=review&routeId=`).
- [x] SQL oculto del menú (acceso por URL).
- [x] PWA instalable (manifest + service worker).
- [x] Mapa Leaflet con paradas numeradas, polyline y unidad en vivo.

### 🔜 Pendientes / Ideas de mejora
- [ ] Vista de perfil por conductor con login propio (email/código) que filtre automáticamente sus rutas.
- [ ] Notificaciones push (PWA) al representante cuando el bus está cerca.
- [ ] Reporte semanal/mensual de asistencia (recogidos vs ausentes por alumno).
- [ ] Exportar rutas a PDF/CSV desde el historial.
- [ ] Multi-colegio con selección persistente por usuario.
- [ ] Pantalla de completado con resumen (al llegar al colegio).
- [ ] Modo offline completo con cola de sincronización (hoy localStorage es el fallback).

---

## 13. Datos Demo (Quito, Ecuador)

- **Colegio:** Colegio San Gabriel (Av. América y Mariana de Jesús) — llegada límite 07:45.
- **Conductores:** Juan Carlos Guamán (PBX-4521), Maritza Villacís (PCZ-8910), Segundo Toapanta (PAA-3322).
- **Alumnos:** 5 alumnos con modalidades mixtas (ida y vuelta, solo ida, solo vuelta).
- **Origen:** Base de operaciones, Sector La Pradera.
- **Credenciales demo staff:** `admin@demo.com` / `123456`.

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
