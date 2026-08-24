# 🧠 Memoria del Proyecto — RutaEscolar PWA

> **Propósito:** Este documento es la memoria histórica del proyecto. Registra el contexto, las decisiones tomadas, el porqué de cada elección y el estado mental del desarrollo. Sirve para retomar el trabajo en cualquier momento con todo el contexto.
> **Última actualización:** 24/08/2026

---

## 1. Qué es este proyecto (en una frase)

**RutaEscolar** es una PWA de optimización y seguimiento de transporte escolar: calcula rutas óptimas de recogida con algoritmo de salida inversa, permite al conductor ejecutarlas marcando recogidos/ausentes, y permite a los representantes seguir a sus hijos en vivo.

**Repositorio:** https://github.com/iamnocodeveloper/ruta-colegios
**Rama:** `main`

---

## 2. Historia y contexto

### Origen
- El repositorio nació como una plantilla de **Google AI Studio** (`google-gemini/aistudio-repository-template`), orientada a prototipos generados con IA (contiene `metadata.json`, `assets/.aistudio`, `requestFramePermissions: geolocation`).
- El proyecto fue inicializado como **"RutaEscolar PWA"** con el commit `2e9354e` ("feat: initialize RutaEscolar PWA project").
- Los datos demo están geolocalizados en **Quito, Ecuador** (migrados desde un dataset inicial de Caracas, Venezuela — la app aún contiene lógica de migración de Caracas→Quito en `App.tsx`).

### Evolución principal (orden cronológico)
1. **Base**: PWA + InstantDB + algoritmo de salida inversa + mapa Leaflet.
2. **Rediseño completo a Soft UI / Bento Grid** (tema oscuro → tema claro `#F4F6FA`).
3. **Cabina del conductor simplificada** (reemplazó al DriverPanel complejo de 1.479 líneas).
4. **Historial de rutas + link de revisión solo lectura**.
5. **Variantes de ruta con colores + reordenamiento manual + días por alumno**.
6. **Botones de navegación** (Waze/Google Maps/Llamar/WhatsApp) en paradas.
7. **Fixes de estabilidad**: ErrorBoundary global, normalización de días, service worker network-first.
8. **Webhook n8n + auditoría**: cada evento de ejecución de ruta se envía a n8n y se audita en InstantDB (`eventos_ruta`, `webhook_logs`).
9. **Itinerario desplegable + reorden por arrastre y desde el mapa**: acordeón cerrado por defecto (mapa más grande), drag & drop con `motion` Reorder y modo "Editar Orden en Mapa".
10. **Informe de ruta en PDF**: descarga directa con jsPDF + autoTable (texto vectorial, sin mapas/imágenes), accesible desde Historial y Ver Recorrido.
11. **Ruta completa con jornadas (ida + vuelta)**: un solo registro guarda ambos trayectos (`RutaTrayecto` embebido); el planificador guarda cada jornada y el "registro completo"; cabina con selector de jornada.

---

## 3. Decisiones clave y su porqué

| Decisión | Por qué | Cuándo |
|---|---|---|
| **InstantDB como base de datos** | Requiere cero backend propio, tiempo real por suscripción, auth por magic code incluida, y se adapta al entorno AI Studio. | Inicio |
| **localStorage como capa de resiliencia** | InstantDB puede fallar/rate-limitear; la app debe seguir funcionando offline o con red lenta. Todo se escribe en ambos lados. | Inicio |
| **Tema claro Soft UI** | Petición explícita del dueño del proyecto con un design system definido (fondo #F4F6FA, azul #0084FF, lima #D2F638). | Sesión de rediseño |
| **Cabina del conductor SIMPLE en vez del panel completo** | El DriverPanel original (1.479 líneas) era inmanejable; el conductor necesita solo: ver rutas, empezar, marcar recogido/ausente. | Feature request |
| **Historial en localStorage (snapshot completo)** | Persistir la ruta entera (paradas, conductor, polyline) permite el link de revisión sin backend. Tope: 200 entradas. | Feature request |
| **Link de revisión sin login** | Un link de "solo lectura" debe ser compartible; no tiene sentido exigir sesión para ver algo no editable. | Fix de pantalla en blanco |
| **Variantes de ruta (4 algoritmos)** | El usuario pidió "buscar la ruta más corta y poder elegir"; se generan 2-Opt, Vecino Cercano, Extremos Primero y Aleatoria, cada una con color. | Feature request |
| **Días por alumno (Lun–Vie)** | El usuario pidió marcar qué días asiste cada alumno; el listado del planificador se filtra automáticamente por día + modalidad + activo. | Feature request |
| **Itinerario desplegable (cerrado por defecto)** | El usuario pidió dar más espacio al mapa; la sección del itinerario es un acordeón que arranca cerrado y el mapa crece a `calc(100vh-320px)`. | Feature request |
| **Reorden por arrastre (drag & drop)** | El usuario pidió mover una parada a una posición exacta (ej. "la #1 al final, que la #2 pase a ser la #1"). Se usó `motion` `Reorder` (ya instalado, sin dependencias nuevas) con asa ⋮⋮, manteniendo las flechas ↑/↓ como alternativa accesible. | Feature request |
| **Reorden desde el mapa** | El usuario pidió poder reordenar también tocando los marcadores. Se implementó el modo "Editar Orden en Mapa" (progreso X/N, aplicar/cancelar, orden parcial) vía `onMarkerClick` + `reorderProgress` en `SchoolRouteMap`. | Feature request |
| **`applyManualOrder` centralizado** | Flechas, drag & drop y reorden en mapa recalcular con el mismo camino: `setOrderedStudentIds` + `ordenManual` + variante "Manual". Evita lógica duplicada. | Refactor |
| **Informe de ruta en PDF (jsPDF)** | El usuario pidió un informe imprimible "además del link". Se eligió jsPDF + autoTable (descarga directa, texto vectorial, colores por estado) en vez de print-to-PDF para controlar el archivo y los estilos, y en vez de html2canvas para no rasterizar (requisito: sin imágenes/mapas). | Feature request |
| **Ruta combinada ida+vuelta** | El usuario pidió guardar ambas jornadas en un mismo registro ("guardar ruta ida y ruta vuelta, luego el registro completo"). Se modeló `RutaTrayecto` embebido en `RutaDiaria` (`ida`/`vuelta`), con `ruta.paradas` = concatenación para compatibilidad de vistas legacy, y helpers centralizados en `routeJourneys.ts`. | Feature request |
| **Service worker network-first para HTML** | El cache-first servía el index.html viejo → errores MIME text/html en producción tras redesplegar. | Fix de producción |
| **ErrorBoundary global** | Un error de runtime (ej. `ruta.paradas[0]` con paradas undefined) daba pantalla en blanco total. Ahora muestra fallback con mensaje. | Fix de producción |

---

## 4. Stack y por qué cada pieza

| Pieza | Versión | Rol | Alternativa considerada |
|---|---|---|---|
| React 19 | ^19.0.1 | UI | — |
| TypeScript 5.8 | ~5.8.2 | Tipado | — |
| Vite 6 | ^6.2.3 | Bundler/dev server | — |
| Tailwind CSS 4 | ^4.1.14 | Estilos (tokens vía `@theme`) | — |
| InstantDB | @instantdb/react ^1.0.65 | DB tiempo real + auth | Firebase, Supabase |
| Leaflet 1.9 | ^1.9.4 | Mapas (tiles CartoDB Voyager) | Mapbox GL |
| Express 4 | ^4.21.2 | Servidor (dev middleware + prod static) | — |
| lucide-react | ^0.546.0 | Iconos | — |
| motion | ^12.23.24 | Animaciones + `Reorder` (drag & drop de paradas) | framer-motion |
| jspdf + jspdf-autotable | ^4.2.1 / ^5.0.8 | Informes de ruta en PDF (texto vectorial) | pdfmake, print-to-PDF |
| canvas-confetti | ^1.9.4 | Confeti al completar ruta | — |
| Bun | — | Lockfile original (`bun.lock`) | npm |

---

## 5. Estado mental / verdades incómodas (para no repetir errores)

- ⚠️ **El "login" de admin es una verificación en cliente** (`admin@demo.com`/`123456` hardcodeada). NO es seguro para producción real; es un demo. Documentado en `docs/SEGURIDAD.md`.
- ⚠️ **Los magic tokens de representantes son estáticos y de baja entropía**; cualquier usuario con el App ID público de InstantDB puede leerlos. Es un sistema demo.
- ⚠️ **PII de menores (notas médicas) se guarda en localStorage en claro**. Para producción real con datos reales: migrar a backend con permisos + cifrado.
- ⚠️ **El `DriverPanel.tsx` original (1.479 líneas) ya no se usa** (fue reemplazado por `DriverPanelSimple.tsx`). Está huérfano: se puede eliminar en una limpieza futura, pero NO se tocó por respeto a "no cambiar funciones".
- ⚠️ **`@google/genai` está declarado pero no se usa** en el código. Candidato a limpieza.
- ℹ️ **`INSTANT_APP_ID` es público por diseño** (cliente), no es un secreto.

---

## 6. Datos demo (para probar rápido)

| Rol | Credencial |
|---|---|
| Staff/Admin | `admin@demo.com` / `123456` (o botón 1-click) |
| Representante | ID de alumno: `e3000000-0000-4000-8000-000000000001` (Mateo) o magic link |

**Alumnos demo (5):**
- Mateo Mendoza — Ida y Vuelta — Lun–Vie
- Camila Silva — Ida y Vuelta — Lun, Mié, Vie
- Santiago Gómez — Solo Ida — Lun–Jue
- Valeria Rodríguez — Solo Vuelta — Mar, Jue
- Lucas Morales — Ida y Vuelta — Lun–Vie

**Conductores:** Juan Carlos Guamán (PBX-4521), Maritza Villacís (PCZ-8910), Segundo Toapanta (PAA-3322).
**Colegio:** Colegio San Gabriel (llegada límite 07:45).

---

## 7. URLs / accesos útiles

| Qué | URL |
|---|---|
| Inicio | `/?view=home` |
| Cabina conductor | `/?view=driver` |
| Planificador | `/?view=planner` |
| Historial | `/?view=history` |
| Revisión de ruta (público) | `/?view=review&routeId=<id>` |
| Esquema SQL (oculto) | `/?view=sql` |
| Portal representante | `/?magic=<token>&student=<id>` |

---

## 8. Comandos de memoria rápida

```bash
npm run dev      # dev server en :3000 (usa tsx server.ts)
npm run lint     # tsc --noEmit (typecheck)
npm run build    # vite build + esbuild server → dist/
npm run start    # sirve dist/ (producción)
```

> ⚠️ En el entorno local, el puerto 3000 puede estar ocupado por otro servicio (ej. Remotion Studio). Si ves un HTML de Remotion en lugar de la app, es conflicto de puerto.

---

## 9. Documentos hermanos

- `docs/DESCRIPCION_SISTEMA.md` — descripción funcional y técnica profunda
- `docs/AVANCES.md` — registro cronológico de avances (changelog)
- `docs/SEGURIDAD.md` — auditoría de seguridad y hardening
- `docs/GUIA_DESARROLLO.md` — guía para desarrolladores
- `DOCUMENTACION.md` — índice general y referencia rápida
