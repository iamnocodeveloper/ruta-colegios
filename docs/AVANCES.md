# 🚀 Avances del Proyecto — RutaEscolar PWA

> **Registro cronológico de avances.** Cada entrada incluye el commit, la fecha y qué se implementó.
> **Última actualización:** 24/08/2026

---

## Historial de commits

| Commit | Descripción | Fecha aprox. |
|---|---|---|
| `c0e0cd6` | Initial commit (plantilla AI Studio) | — |
| `2e9354e` | feat: initialize RutaEscolar PWA project | — |
| `d67c5c6` | feat: add driver management and route journey types | — |
| `6dd5931` | feat(ruta): persist active route and refine filtering | — |
| `91f7445` | feat(routes): implement route re-sync functionality | — |
| `323be86` | Cabina conductor simplificada, historial de rutas, toggle alumnos, revisión solo lectura | 22/08 |
| `5b15311` | fix: toggle activo en rutas no actualizaba la UI inmediatamente | 22/08 |
| `6e89a6e` | chore: ignore tsc-output.txt | 22/08 |
| `e66688a` | Variantes de ruta con colores, reordenamiento manual, días por alumno | 22/08 |
| `cef91c1` | Botones Waze/Maps/Llamar/WhatsApp + fix filtros alumnos | 22/08 |
| `3b11272` | fix: pantalla en blanco — accesos seguros + ErrorBoundary | 22/08 |
| `88f09b6` | fix: error MIME text/html en assets (base './' + fallback SPA) | 22/08 |
| `2cf340a` | fix: service worker network-first para HTML | 22/08 |
| `72126d1` | fix: modalidad de servicio no se reflejaba en lista de ruta | 22/08 |
| `e065b08` | fix: alumnos no aparecían en lista — dias_ruta string JSON | 22/08 |
| `50cd1a8` | docs: documentación completa del proyecto (memoria, avances, descripción, seguridad, guía) | 23/08 |
| `9363a57` | feat: webhook n8n para eventos de ruta + auditoría en InstantDB | 23/08 |
| `a03dd2a` | feat: itinerario desplegable + reordenar paradas por arrastre y desde el mapa | 24/08 |
| `76b24ea` | feat: informe de ruta en PDF (jsPDF + autoTable) desde Historial y Ver Recorrido | 24/08 |
| `e01e581` | feat: ruta completa con jornadas de ida y vuelta en un solo registro | 24/08 |

---

## Fase 1 — Fundación (commits c0e0cd6 → 91f7445)

### ✅ Lo que se logró
- PWA instalable (manifest, service worker, iconos).
- Integración **InstantDB** con schema completo (8 entidades) y seed de datos Quito.
- **Algoritmo de optimización** (`routeCalculator.ts`): salida inversa, TSP Nearest Neighbor + 2-Opt, OSRM para geometría real, ETAs por parada.
- Mapa Leaflet interactivo con paradas numeradas, polyline y unidad en vivo.
- CRUD de alumnos, colegios, conductores y representantes.
- Portal del representante con seguimiento en vivo (polling `/api/tracking`).
- Cabina del conductor completa (DriverPanel original, 1.479 líneas).

---

## Fase 2 — Rediseño Soft UI / Bento Grid (commit 323be86)

### ✅ Lo que se logró
- Tema claro global con **design system propio** en `index.css` (`@theme` tokens).
- **Sidebar izquierdo** con pastilla activa blanca + **header superior** + drawer móvil.
- **Dashboard Inicio (Bento)**: card principal "Ruta de Hoy", KPIs, gauge circular negro/lima, timeline de paradas, feed "Lo nuevo".
- SQL **oculto del menú** (acceso por `?view=sql`).
- Migración de los 13 componentes al tema claro.

### 📝 Notas
- Los ítems del menú conservan sus `id` (`nav-*`, `btn-*`, `tab-*`) para automatización.

---

## Fase 3 — Cabina conductor + Historial + Toggle alumnos (commit 323be86)

### ✅ Lo que se logró
- **`DriverPanelSimple.tsx`** (451 líneas vs 1.479 del original): rutas asignadas, empezar ruta, marcar recogido/ausente/pendiente, mapa opcional.
- **`routeHistory.ts`**: snapshot completo de cada ruta guardada (localStorage, tope 200) + sync best-effort a InstantDB.
- **`RouteHistory.tsx`**: listado con ver recorrido, copiar link de revisión, usar hoy, eliminar.
- **`RouteReviewView.tsx`**: vista solo lectura con mapa + itinerario.
- **Toggle "Activo en Rutas"** por alumno (`activo_en_rutas`), excluye del cálculo.

---

## Fase 4 — Variantes, reordenamiento, días por alumno (commit e66688a)

### ✅ Lo que se logró
- **`generateRouteVariants()`**: 4 variantes (2-Opt, Vecino Cercano, Extremos Primero, Aleatoria).
- **Colores por variante** en el mapa (`polylineColor`/`polylineDash` en SchoolRouteMap).
- **Badge "MÁS CORTA"** con distancia haversine de cada variante (`variantDistance()`).
- **Reordenamiento manual** → variante "Manual" en rojo.
- **`dias_ruta`** (Lun–Vie) por alumno con checkboxes en el formulario y chips en la card.
- **Selector de día** en el planificador con contador de alumnos por día.
- **Carga automática** del listado según día + modalidad + activo.
- Ruta guardada persiste `dia_semana` y `variante`.

---

## Fase 5 — Botones de navegación y contacto (commit cef91c1)

### ✅ Lo que se logró
- **Waze + Google Maps + Llamar Representante + WhatsApp** en cada parada de:
  - `RouteReviewView` (detalles de ruta)
  - `DriverPanelSimple` (paradas de hoy + rutas asignadas)
  - `RouteHistory` (paradas expandidas)
  - `StudentManager` (cards de alumnos)
- Fix: filtros de servicio en Alumnos ya no se cortan (`py-2.5`).

---

## Fase 6 — Estabilidad y fixes de producción (commits 3b11272 → e065b08)

### ✅ Lo que se logró
- **`ErrorBoundary.tsx`** global: nunca más pantalla en blanco, fallback con mensaje y recarga.
- Vista de revisión **sin login** (link público) + estado "Ruta no encontrada".
- Accesos seguros (`ruta.paradas?.[0]`, `ruta.paradas || []`) en HomeDashboard, DriverPanelSimple, RouteReviewView.
- **Fix MIME text/html**: `base: './'` en Vite + fallback SPA solo para rutas sin extensión en server.ts.
- **Service worker network-first** para HTML (invalida caché vieja, `rutaescolar-v3`).
- **Fix modalidad**: el mapeo de InstantDB ahora copia `modalidad_servicio` (antes todos caían a `ida_y_vuelta`).
- **Fix días**: `normalizeDays()` maneja array/string JSON/CSV (InstantDB devolvía string que rompía el filtro → lista vacía).

---

## Fase 7 — Itinerario desplegable + Reorden por arrastre y desde el mapa (commit a03dd2a)

### ✅ Lo que se logró
- **Itinerario desplegable (acordeón)**: la sección "Itinerario de Recogida/Entrega" se colapsa/expande con una flecha y arranca **cerrada por defecto**, agrandando el mapa a `calc(100vh-320px)` para planificar con más contexto geográfico.
- **Drag & drop** en el itinerario (`motion` `Reorder.Group`/`Reorder.Item` + `useDragControls`): cada fila tiene un asa ⋮⋮ para arrastrarla a cualquier posición; al soltar se renumera todo (mover la #1 al final hace que #2 pase a ser la #1) y se **recalcula la ruta** con `ordenManual` (variante "Manual" en rojo).
- **Reorden desde el mapa**: botón flotante **"✏️ Editar Orden en Mapa"** sobre el mapa. En ese modo se tocan los marcadores en el nuevo orden: los ya elegidos se pintan en verde con su nueva posición, hay progreso `X/N`, y al completar las N paradas (o con "Aplicar" para un orden parcial) se aplica y recalcula automáticamente. Botón "Cancelar" para abortar.
- Refactor: `moveStudent` se generalizó en **`applyManualOrder(newOrder)`**, reutilizado por las flechas ↑/↓, el drag & drop y el reorden en el mapa.
- `SchoolRouteMap` ahora acepta `onMarkerClick` y `reorderProgress` para renderizar el modo reorden.

### 📝 Notas
- Sin dependencias nuevas: se usa `motion` (ya declarado), que re-exporta `Reorder` y `useDragControls` de framer-motion.
- El reorden por mapa permite **orden parcial**: los marcadores tocados van primero y el resto conserva su orden relativo.

---

## Fase 8 — Informe de ruta en PDF (commit 76b24ea)

### ✅ Lo que se logró
- **`src/services/pdfReport.ts`** → `generateRoutePdf(entry)` descarga directa de un PDF (jsPDF + jspdf-autotable, A4, **solo texto/negritas/colores, sin mapas ni imágenes**).
- **Estructura del informe:**
  - Encabezado con barra color primario `#0084FF` ("RutaEscolar" + "INFORME DE RUTA"), colegio + dirección, fecha y día de la ruta, trayecto, estado, variante, modo y fecha de generación.
  - Bloque **Resumen**: conductor + unidad, salida/llegada, distancia, tiempo total (manejo + abordaje), nº paradas, ID de ruta, y contadores **Recogidos/Ausentes/Pendientes** con color (verde/rojo/ámbar).
  - **Tabla de paradas**: `# · Alumno · Ubicación · Hora est. · Dist. ant. · Estado`, con fila sombreada y texto coloreado según estado, salto de página automático y pie "Generado por RutaEscolar · página X".
  - Nombre de archivo: `Informe_Ruta_<colegio>_<YYYY-MM-DD>.pdf` (slug sanitizado).
- **Botones**: "Generar PDF" en cada tarjeta del **Historial de Rutas** y "Descargar PDF" en **Ver Recorrido** (`RouteReviewView`).
- Dependencias nuevas: `jspdf ^4.2.1` + `jspdf-autotable ^5.0.8`.

---

## Fase 9 — Ruta completa con jornadas de IDA y VUELTA (commit e01e581)

### ✅ Lo que se logró
- **Una sola `RutaDiaria` guarda ambas jornadas**: nuevo tipo `RutaTrayecto` con sus propias paradas y métricas, y campos opcionales `ruta.ida` / `ruta.vuelta` (`src/types.ts`).
- **Planificador por jornadas**: el usuario configura y presiona **"Guardar Plan IDA"** y **"Guardar Plan VUELTA"** (cada uno con su variante/orden), y luego **"GUARDAR REGISTRO COMPLETO"** persiste un único registro con ambos trayectos (o uno solo si solo guardó una jornada, comportamiento legacy).
- **`ruta.paradas` = concatenación ida + vuelta** para que las vistas legacy (Home/Padres) sigan funcionando; cada jornada conserva su propio orden, horarios, polyline y variante.
- **Cabina del conductor con selector de jornada** (🌅 IDA / 🌇 VUELTA): inicia/finaliza cada jornada por separado y marca paradas de la jornada correcta (estado derivado `computeRutaEstado`).
- **Historial y Ver Recorrido** muestran ambas jornadas agrupadas (chips "Ida N · Vuelta M", secciones por trayecto con su mapa).
- **PDF del informe** incluye una tabla por jornada ("Recorrido IDA", "Recorrido VUELTA") y contadores totales.
- **Helpers `src/services/routeJourneys.ts`**: `getJourneys`, `getJourneyByParadaId`, `journeyView`, `updateJourney`, `computeRutaEstado`, `getAllParadas`.
- Webhooks n8n envían la **vista de la jornada** en curso (`journeyView`).

### 📝 Notas
- El `activeRuta` ahora se persiste también en localStorage al guardar (sobrevive a recargas).
- `saveRutaInstant` guarda la concatenación de paradas en la nube; la integridad de jornadas vive en el snapshot local del historial.

---

## Pendientes / Ideas futuras

- [ ] Login real por conductor (email/código) que filtre sus rutas automáticamente.
- [ ] Notificaciones push PWA al representante.
- [ ] Reporte semanal/mensual de asistencia.
- [ ] Exportar rutas a PDF/CSV.
- [ ] Eliminar código huérfano (`DriverPanel.tsx` original, `@google/genai`).
- [ ] Hardening de seguridad (ver `docs/SEGURIDAD.md`).
