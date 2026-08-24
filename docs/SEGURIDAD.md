# 🔒 Seguridad y Auditoría — RutaEscolar PWA

> **Auditoría de seguridad estática** + recomendaciones de hardening.
> **Última actualización:** 24/08/2026 · **Estado:** auditoría completada, no se modificó código.
>
> **Nota (v1.4.0):** se aplicó un primer hardening — login real por rol vía InstantDB Magic Code y el backdoor demo `admin@demo.com/123456` queda **solo en desarrollo** (`import.meta.env.DEV`); el dueño resuelve como `superadmin`. Siguen pendientes el resto de la Prioridad 1 (sesión firmada/cookie, helmet, limpieza de PII opcional).

---

## 1. Resumen ejecutivo

| Severidad | Cantidad | Temas |
|---|---|---|
| 🔴 Alta | 7 | Headers de seguridad ausentes; backdoor admin demo; sesión forjable; magic tokens débiles; portal parental por ID; PII en localStorage |
| 🟠 Media | 10 | XSS potencial en Leaflet; PII demo; sin RBAC; validación mínima de formularios |
| 🟡 Baja | 9 | Express 4 EOL; API sin validación; etc. |
| ⚪ Info | 10+ | `INSTANT_APP_ID` público por diseño; `npm audit` 0 vulnerabilidades; inyección en URLs bien mitigada |

**✅ `npm audit`: 0 vulnerabilidades** (323 dependencias auditadas).

---

## 2. Hallazgos detallados

### 2.1 Secretos expuestos

| # | Hallazgo | Severidad | Detalle |
|---|---|---|---|
| 1.1 | `INSTANT_APP_ID` en `src/services/instantDb.ts:28` | ⚪ Info | Público por diseño (cliente). No es secreto. |
| 1.2 | Credenciales demo `admin@demo.com` / `123456` hardcodeadas (`LoginGateway.tsx:46,88,242`, `InstantAuthModal.tsx`) | 🔴 Alta → 🟠 Parcial | Backdoor oculto en producción (solo dev); login por Magic Code + rol. Sigue habiendo demo en `InstantAuthModal` (herramienta dev). |
| 1.3 | Magic tokens estáticos en seed (`mockData.ts:72-100`) | 🟠 Media | Formato predecible `tok-<nombre>-<hex>`. |
| 1.4 | `GEMINI_API_KEY` placeholder | ⚪ Info | Solo ejemplo; `.env*` está en .gitignore. |
| 1.5 | `MAPBOX_ACCESS_TOKEN` vacío | ⚪ Info | No usado. |
| 1.6 | PII demo (nombres, licencias, placas, teléfonos) en `mockData.ts` | 🟠 Media | Parecen datos reales; riesgo de privacidad. |
| 1.7 | Usuario admin sembrado en nube | 🟠 Media | Legible por cualquiera con el App ID. |

### 2.2 Headers de seguridad en Express

| # | Hallazgo | Severidad |
|---|---|---|
| 3.1 | Sin `helmet` ni middleware de seguridad en `server.ts:5-8` | 🔴 Alta |
| 3.2 | `express.static` sin `setHeaders` → embebible en iframes (clickjacking), sin `nosniff` | 🔴 Alta |
| 3.3 | API `/api/*` sin headers ni rate limiting | 🟠 Media |
| 3.4 | Sin límite de body explícito en `express.json()` | 🟡 Baja |
| 3.5 | Sin meta-CSP en `index.html` (solo SRI en hoja Leaflet) | 🟠 Media |

### 2.3 Inyección en URLs

**Veredicto: riesgo BAJO.** Las URLs usan coordenadas numéricas y `encodeURIComponent` correctamente:
- OSRM: `p.lng.toFixed(6)` → números (seguro).
- Nominatim search: `encodeURIComponent` (correcto).
- Google Maps / Waze: coordenadas numéricas (seguro).
- WhatsApp / tel: teléfono sanitizado con `.replace(/[^0-9]/g, '')` (seguro).

### 2.4 XSS

| # | Hallazgo | Severidad |
|---|---|---|
| 5.1 | Sin `dangerouslySetInnerHTML` en React | ⚪ Info |
| 5.2 | `L.divIcon({ html })` en Leaflet interpola nombres/direcciones crudos (`SchoolRouteMap.tsx`, `LocationPicker.tsx`) | 🟠 Media |
| 5.3 | `bindPopup` con HTML crudo | 🟠 Media |

**Riesgo:** datos manipulados en InstantDB (por un tercero con acceso) podrían ejecutar HTML en el mapa. **Mitigación actual:** solo escriben staff autenticado. **Recomendación:** escapar con `escapeHtml()` antes de interpolar.
> Nota: el modo reorden de paradas (`reorderProgress` en `SchoolRouteMap.tsx`, commit `a03dd2a`) también interpola el nombre del alumno en el HTML del marcador — mismo patrón y misma mitigación aplican.

### 2.5 Autenticación

| # | Hallazgo | Severidad |
|---|---|---|
| 6.1 | Login admin = comparación hardcodeada en cliente + botón 1-click sin contraseña | 🔴 Alta → 🟠 Parcial | En v1.4.0 el login es por InstantDB Magic Code con resolución de rol (`usuarios`/`conductores`); el botón 1-click solo en dev. |
| 6.2 | Sesión en localStorage sin firma, forjable, sin expiración | 🔴 Alta |
| 6.3 | Rol de sesión no aplica permisos (sin RBAC) | 🟠 Media |
| 6.4 | Magic tokens baja entropía + en URL + legibles desde InstantDB | 🔴 Alta |
| 6.5 | Portal parental por ID de alumno visible/adivinable | 🔴 Alta |
| 6.6 | `?student=` autentica sin verificación | 🟠 Media |

### 2.6 Dependencias

| # | Hallazgo | Severidad |
|---|---|---|
| 7.1 | Express 4 (EOL; Express 5 es estable) | 🟡 Baja |
| 7.2 | Leaflet 1.9.4 sin CVEs activos | ⚪ Info |
| 7.3 | Vite 6.4.3 dentro de rango | ⚪ Info |
| 7.4 | `@google/genai` declarado pero NO usado | ⚪ Info |
| 7.6 | **npm audit: 0 vulnerabilidades** | ✅ |

### 2.7 PWA / Service Worker

| # | Hallazgo | Severidad |
|---|---|---|
| 8.1 | Estrategia razonable: network-first HTML, cache-first assets, API nunca cacheada | ⚪ Info |
| 8.2 | Versión de caché manual (`rutaescolar-v4`) | 🟡 Baja |
| 8.3 | Cachea HTML de error si responde 200 | 🟡 Baja |

### 2.8 Datos sensibles en localStorage

| # | Hallazgo | Severidad |
|---|---|---|
| 9.1 | PII de menores + **notas médicas** en localStorage en claro, no limpiadas al cerrar sesión | 🔴 Alta |
| 9.2 | Magic tokens en localStorage | 🟠 Media |
| 9.3 | Sin httpOnly/SameSite (localStorage) | 🟠 Media |

### 2.9 Validación de inputs

| # | Hallazgo | Severidad |
|---|---|---|
| 10.1 | Validación mínima (solo required + trim) en formularios | 🟠 Media |
| 10.2 | `foto_url` acepta cualquier URL (tracking potencial) | 🟡 Baja |
| 10.3 | Sin clamp de rangos en handlers (solo UI) | 🟡 Baja |

---

## 3. Recomendaciones de hardening (prioridad)

### 🔴 Prioridad 1 — Hacer ahora
1. **Eliminar/condicionar el backdoor admin demo** en producción (no el botón 1-click ni la comparación hardcodeada; validar contra InstantDB con permisos).
2. **Firmar/validar la sesión** de localStorage o migrar a cookie httpOnly + SameSite; **limpiar PII al cerrar sesión**.
3. **Agregar `helmet`** en `server.ts` (CSP, X-Frame-Options, nosniff, Referrer-Policy) + rate limit en `/api/*`.

### 🟠 Prioridad 2 — Próximo sprint
4. **Escapear HTML** en `L.divIcon` / `bindPopup` de Leaflet (función `escapeHtml`).
5. **Reemplazar magic tokens** por tokens criptográficos rotados validados server-side.
6. **Validación de inputs**: longitudes, email, teléfono, rangos lat/lng en los 3 gestores.

### 🟡 Prioridad 3 — Deuda técnica
7. Migrar Express 4 → 5.
8. Limpiar `@google/genai` y `DriverPanel.tsx` huérfano.
9. `start_url` relativo en manifest si se despliega bajo subruta.

---

## 4. Notas metodológicas

- La auditoría es **estática** sobre el código en disco; no se ejecutó la app ni se modificó ningún archivo.
- `INSTANT_APP_ID` no se reporta como vulnerabilidad por ser público por diseño (cliente).
- Los hallazgos de "Alta" severidad son en su mayoría **inherentes a un prototipo demo**; el sistema NO está diseñado para producción con datos reales sin aplicar el hardening.

---

## 5. Normativas relevantes

- **LOPDP Ecuador** (Ley Orgánica de Protección de Datos Personales): los datos de menores (notas médicas, direcciones) son categoría sensible → cifrado, consentimiento, minimización.
- **GDPR** (si aplica): datos de niños = categoría especial.
- **OWASP Top 10**: los hallazgos mapean principalmente a A01 (control de acceso roto), A05 (configuración de seguridad incorrecta), A03 (inyección — bajo riesgo aquí).
