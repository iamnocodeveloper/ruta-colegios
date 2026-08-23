/**
 * Webhook Event Notifier — RutaEscolar → n8n
 *
 * Envía silenciosamente (sin errores ni confirmaciones visibles en la app)
 * un JSON completo a n8n cada vez que ocurre un evento de ejecución de ruta:
 *
 *   - ruta_iniciada      : el conductor presionó EMPEZAR RUTA
 *   - parada_recogida    : alumno marcado como recogido
 *   - parada_ausente     : alumno marcado como ausente
 *   - parada_revertida   : parada devuelta a pendiente
 *   - ruta_completada    : todas las paradas procesadas o cierre manual
 *
 * Comportamiento:
 *   1. Registra auditoría del evento en InstantDB (`eventos_ruta`, write-only).
 *   2. Crea registro de envío en `webhook_logs` y hace POST al webhook con
 *      reintentos internos (backoff 1s → 5s, timeout 10s por intento).
 *   3. Si todos los intentos fallan, guarda el evento en una cola local
 *      (localStorage, tope MAX_QUEUE) que se reintenta en el siguiente evento
 *      o al cargar la app.
 *   4. Actualiza el resultado del envío en `webhook_logs`.
 */

import { Alumno, ParadaRuta, RutaDiaria } from '../types';
import {
  logEventoRutaInstant,
  createWebhookLogInstant,
  updateWebhookLogInstant,
} from './instantDb';

export const WEBHOOK_URL = 'https://joel-n8n-2026.rddxeh.easypanel.host/webhook/not-ruta';

const QUEUE_KEY = 'rutaescolar_webhook_queue';
const MAX_QUEUE = 100;
const RETRY_DELAYS_MS = [0, 1000, 5000]; // intento inmediato + 2 reintentos internos
const FETCH_TIMEOUT_MS = 10000;
const FLUSH_BATCH = 10;

export type TipoEventoRuta =
  | 'ruta_iniciada'
  | 'parada_recogida'
  | 'parada_ausente'
  | 'parada_revertida'
  | 'ruta_completada';

interface QueuedEvent {
  queueId: string;
  logId?: string; // id del registro webhook_logs asociado (para actualizar al reintentar)
  payload: Record<string, any>;
  fecha_evento: string;
}

// ===========================================================================
// Builders del payload JSON
// ===========================================================================

function buildRouteName(ruta: RutaDiaria): string {
  const trayecto = (ruta.tipo_trayecto || 'ida').toUpperCase();
  const colegioNombre = ruta.colegio?.nombre || 'Colegio';
  return `Ruta ${trayecto} - ${colegioNombre} - ${ruta.fecha}`;
}

function buildProgress(paradas: ParadaRuta[]) {
  return {
    total_paradas: paradas.length,
    recogidos: paradas.filter((p) => p.estado === 'recogido' || p.estado === 'completado').length,
    ausentes: paradas.filter((p) => p.estado === 'ausente').length,
    pendientes: paradas.filter((p) => p.estado === 'pendiente').length,
  };
}

function buildAlumnoPayload(alumno?: Alumno): Record<string, any> | null {
  if (!alumno) return null;
  return {
    id: alumno.id,
    nombre: alumno.nombre || '',
    grado: alumno.grado || '',
    direccion_recogida: alumno.direccion_recogida || '',
    lat: Number(alumno.lat) || null,
    lng: Number(alumno.lng) || null,
    notas_medicas: alumno.notas_medicas || '',
    modalidad_servicio: alumno.modalidad_servicio || 'ida_y_vuelta',
    activo_en_rutas: alumno.activo_en_rutas !== false,
    dias_ruta: alumno.dias_ruta || [],
    representante: alumno.representante
      ? {
          id: alumno.representante.id,
          nombre: alumno.representante.nombre || '',
          telefono_whatsapp: alumno.representante.telefono_whatsapp || '',
          email: alumno.representante.email || '',
        }
      : null,
    colegio: alumno.colegio
      ? {
          id: alumno.colegio.id,
          nombre: alumno.colegio.nombre || '',
          direccion: alumno.colegio.direccion || '',
          hora_llegada_limite: alumno.colegio.hora_llegada_limite || '',
        }
      : null,
  };
}

function buildParadaPayload(parada: ParadaRuta): Record<string, any> {
  return {
    id: parada.id,
    ruta_id: parada.ruta_id,
    orden: parada.orden,
    estado: parada.estado,
    hora_estimada: parada.hora_estimada,
    hora_real: parada.hora_real || null,
    lat: Number(parada.lat),
    lng: Number(parada.lng),
    distancia_desde_anterior_km: parada.distancia_desde_anterior_km ?? null,
    tiempo_desde_anterior_min: parada.tiempo_desde_anterior_min ?? null,
  };
}

function buildRutaPayload(ruta: RutaDiaria): Record<string, any> {
  return {
    id: ruta.id,
    nombre: buildRouteName(ruta),
    fecha: ruta.fecha,
    dia_semana: ruta.dia_semana || null,
    tipo_trayecto: ruta.tipo_trayecto || 'ida',
    estado: ruta.estado,
    modo_optimizacion: ruta.modo_optimizacion,
    variante: ruta.variante || null,
    hora_llegada_objetivo: ruta.hora_llegada_objetivo,
    hora_salida_estimada: ruta.hora_salida_estimada,
    hora_salida_real: ruta.hora_salida_real || null,
    hora_llegada_real: ruta.hora_llegada_real || null,
    tiempo_manejo_estimado_min: Number(ruta.tiempo_manejo_estimado_min || 0),
    tiempo_abordaje_total_min: Number(ruta.tiempo_abordaje_total_min || 0),
    tiempo_total_estimado_min: Number(ruta.tiempo_total_estimado_min || 0),
    distancia_total_km: Number(ruta.distancia_total_km || 0),
    origen: {
      direccion: ruta.origen_direccion || '',
      lat: Number(ruta.origen_lat),
      lng: Number(ruta.origen_lng),
    },
    colegio: ruta.colegio
      ? {
          id: ruta.colegio.id,
          nombre: ruta.colegio.nombre || '',
          direccion: ruta.colegio.direccion || '',
          lat: Number(ruta.colegio.lat),
          lng: Number(ruta.colegio.lng),
          hora_llegada_limite: ruta.colegio.hora_llegada_limite || '',
          contacto_telefono: ruta.colegio.contacto_telefono || '',
        }
      : null,
    conductor: ruta.conductor
      ? {
          id: ruta.conductor.id,
          nombre: ruta.conductor.nombre || '',
          telefono: ruta.conductor.telefono || '',
          licencia: ruta.conductor.licencia || '',
          vehiculo_modelo: ruta.conductor.vehiculo_modelo || '',
          vehiculo_placa: ruta.conductor.vehiculo_placa || '',
          capacidad_pasajeros: ruta.conductor.capacidad_pasajeros ?? null,
        }
      : null,
    resumen: buildProgress(ruta.paradas || []),
    paradas: (ruta.paradas || []).map((p) => ({
      ...buildParadaPayload(p),
      alumno: buildAlumnoPayload(p.alumno),
    })),
  };
}

// ===========================================================================
// Cola de reintentos (localStorage) — nunca visible para el usuario
// ===========================================================================

function readQueue(): QueuedEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_QUEUE) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedEvent[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE)));
  } catch {
    // storage lleno o no disponible: se descarta silenciosamente
  }
}

function enqueue(event: QueuedEvent) {
  const queue = readQueue();
  queue.push(event);
  writeQueue(queue);
}

async function postOnce(payload: Record<string, any>): Promise<{ ok: boolean; httpStatus?: number; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true, httpStatus: res.status };
    return { ok: false, httpStatus: res.status, error: `HTTP ${res.status}` };
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'timeout' : err?.message || 'network error';
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reintenta enviar los eventos que quedaron en cola tras fallos previos.
 * Procesa hasta FLUSH_BATCH eventos por invocación. Nunca lanza excepciones.
 */
export async function flushWebhookQueue() {
  const queue = readQueue();
  if (queue.length === 0) return;

  const batch = queue.slice(0, FLUSH_BATCH);
  const rest = queue.slice(FLUSH_BATCH);
  const stillFailed: QueuedEvent[] = [];

  for (const item of batch) {
    try {
      const result = await postOnce(item.payload);
      if (result.ok) {
        if (item.logId) {
          updateWebhookLogInstant(item.logId, { estado_envio: 'enviado' }).catch(() => {});
        }
      } else {
        stillFailed.push(item);
      }
    } catch {
      stillFailed.push(item);
    }
  }

  writeQueue([...stillFailed, ...rest]);
}

// Reintentar pendientes al cargar la app (silencioso, sin bloquear)
if (typeof window !== 'undefined') {
  setTimeout(() => {
    flushWebhookQueue().catch(() => {});
  }, 5000);
}

// ===========================================================================
// Emisión central de eventos
// ===========================================================================

interface AuditMeta {
  ruta_id: string;
  fecha_ruta?: string;
  colegio_id?: string;
  colegio_nombre?: string;
  conductor_id?: string;
  conductor_nombre?: string;
  parada_id?: string;
  orden_parada?: number;
  alumno_id?: string;
  alumno_nombre?: string;
  estado_anterior?: string;
  estado_nuevo?: string;
}

async function deliverEvent(
  evento: TipoEventoRuta,
  payloadBody: Record<string, any>,
  audit: AuditMeta
) {
  const fechaEvento = new Date().toISOString();
  const payload: Record<string, any> = {
    evento,
    fecha_evento: fechaEvento,
    app: 'RutaEscolar',
    ...payloadBody,
  };

  // 1) Auditoría del evento en InstantDB (fire & forget)
  logEventoRutaInstant({
    evento,
    ruta_id: audit.ruta_id,
    fecha_ruta: audit.fecha_ruta,
    colegio_id: audit.colegio_id,
    colegio_nombre: audit.colegio_nombre,
    conductor_id: audit.conductor_id,
    conductor_nombre: audit.conductor_nombre,
    parada_id: audit.parada_id,
    orden_parada: audit.orden_parada,
    alumno_id: audit.alumno_id,
    alumno_nombre: audit.alumno_nombre,
    estado_anterior: audit.estado_anterior,
    estado_nuevo: audit.estado_nuevo,
    hora_evento: fechaEvento,
    detalle_json: payload,
  }).catch((e) => console.warn('[webhook] auditoría eventos_ruta falló:', e));

  // 2) Registro inicial del envío en webhook_logs
  let logId: string | undefined;
  try {
    logId = await createWebhookLogInstant({
      evento,
      url_destino: WEBHOOK_URL,
      payload_json: JSON.stringify(payload).slice(0, 20000),
    });
  } catch (e) {
    console.warn('[webhook] creación webhook_logs falló:', e);
  }

  // 3) POST con reintentos internos (backoff)
  const startedAt = Date.now();
  let attempts = 0;
  let lastStatus: number | undefined;
  let lastError = '';

  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await sleep(delay);
    attempts++;
    try {
      const result = await postOnce(payload);
      if (result.ok) {
        if (logId) {
          updateWebhookLogInstant(logId, {
            estado_envio: 'enviado',
            intentos: attempts,
            http_status: result.httpStatus,
            duracion_ms: Date.now() - startedAt,
          }).catch(() => {});
        }
        return; // entregado
      }
      lastStatus = result.httpStatus;
      lastError = result.error || '';
    } catch (err: any) {
      lastError = err?.message || 'error desconocido';
    }
  }

  // 4) Todos los intentos fallaron → marcar log y dejar en cola para reintento posterior
  console.warn(`[webhook] evento ${evento} no entregado tras ${attempts} intentos: ${lastError}`);
  if (logId) {
    updateWebhookLogInstant(logId, {
      estado_envio: 'fallido',
      intentos: attempts,
      http_status: lastStatus,
      duracion_ms: Date.now() - startedAt,
      error_mensaje: lastError,
    }).catch(() => {});
  }
  enqueue({ queueId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, logId, payload, fecha_evento: fechaEvento });
}

// ===========================================================================
// API pública — funciones llamadas desde App.tsx
// ===========================================================================

/** El conductor inició la ruta (estado → en_curso). */
export function notifyRutaIniciada(ruta: RutaDiaria) {
  deliverEvent('ruta_iniciada', { ruta: buildRutaPayload(ruta) }, {
    ruta_id: ruta.id,
    fecha_ruta: ruta.fecha,
    colegio_id: ruta.colegio_id,
    colegio_nombre: ruta.colegio?.nombre,
    conductor_id: ruta.conductor_id,
    conductor_nombre: ruta.conductor?.nombre,
    estado_nuevo: 'en_curso',
  }).catch(() => {});
}

/** Se cambió el estado de una parada durante la ejecución de la ruta. */
export function notifyParadaActualizada(
  ruta: RutaDiaria,
  parada: ParadaRuta,
  estadoNuevo: 'recogido' | 'ausente' | 'pendiente',
  estadoAnterior?: string
) {
  const evento: TipoEventoRuta =
    estadoNuevo === 'recogido' ? 'parada_recogida' :
    estadoNuevo === 'ausente' ? 'parada_ausente' :
    'parada_revertida';

  deliverEvent(evento, {
    ruta: buildRutaPayload(ruta),
    parada: buildParadaPayload(parada),
    alumno: buildAlumnoPayload(parada.alumno),
  }, {
    ruta_id: ruta.id,
    fecha_ruta: ruta.fecha,
    colegio_id: ruta.colegio_id,
    colegio_nombre: ruta.colegio?.nombre,
    conductor_id: ruta.conductor_id,
    conductor_nombre: ruta.conductor?.nombre,
    parada_id: parada.id,
    orden_parada: parada.orden,
    alumno_id: parada.alumno_id,
    alumno_nombre: parada.alumno?.nombre,
    estado_anterior: estadoAnterior,
    estado_nuevo: estadoNuevo,
  }).catch(() => {});
}

/** La ruta finalizó (todas las paradas procesadas o cierre manual). */
export function notifyRutaCompletada(ruta: RutaDiaria) {
  deliverEvent('ruta_completada', { ruta: buildRutaPayload(ruta) }, {
    ruta_id: ruta.id,
    fecha_ruta: ruta.fecha,
    colegio_id: ruta.colegio_id,
    colegio_nombre: ruta.colegio?.nombre,
    conductor_id: ruta.conductor_id,
    conductor_nombre: ruta.conductor?.nombre,
    estado_nuevo: 'completada',
  }).catch(() => {});
}
