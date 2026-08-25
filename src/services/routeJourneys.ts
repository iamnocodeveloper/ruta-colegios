/**
 * Journey helpers for combined routes (ida + vuelta en una sola RutaDiaria).
 * A combined route keeps `ruta.ida` and `ruta.vuelta` (each with its own paradas
 * and metrics); `ruta.paradas` is the concatenation of both journeys so legacy
 * views (Home, Parent) keep working.
 */

import { RutaDiaria, RutaTrayecto, EstadoRuta } from '../types';

export type JourneyKey = 'ida' | 'vuelta';

export function hasJourney(ruta: RutaDiaria): boolean {
  return !!ruta.ida || !!ruta.vuelta;
}

export function isCombinedRuta(ruta: RutaDiaria): boolean {
  return !!(ruta.ida && ruta.vuelta);
}

export function getJourney(ruta: RutaDiaria, key: JourneyKey): RutaTrayecto | undefined {
  return key === 'ida' ? ruta.ida : ruta.vuelta;
}

/** Journeys in canonical order (ida first, then vuelta). Empty for legacy routes. */
export function getJourneys(ruta: RutaDiaria): RutaTrayecto[] {
  const list: RutaTrayecto[] = [];
  if (ruta.ida) list.push(ruta.ida);
  if (ruta.vuelta) list.push(ruta.vuelta);
  return list;
}

/** Find which journey holds a parada by id ('ida' | 'vuelta'), or null for legacy. */
export function getJourneyByParadaId(ruta: RutaDiaria, paradaId: string): JourneyKey | null {
  if (ruta.ida?.paradas.some((p) => p.id === paradaId)) return 'ida';
  if (ruta.vuelta?.paradas.some((p) => p.id === paradaId)) return 'vuelta';
  return null;
}

/**
 * Build a "single-journey view" of the route: top-level journey-specific fields
 * mirror the given journey (used by webhooks and consumers that read ruta.paradas).
 */
export function journeyView(ruta: RutaDiaria, key?: JourneyKey): RutaDiaria {
  const j = key ? getJourney(ruta, key) : undefined;
  if (!j) return ruta;
  return {
    ...ruta,
    tipo_trayecto: j.tipo_trayecto,
    paradas: j.paradas,
    hora_salida_estimada: j.hora_salida_estimada,
    hora_llegada_objetivo: j.hora_llegada_objetivo,
    hora_salida_deseada: j.hora_salida_deseada,
    hora_llegada_deseada: j.hora_llegada_deseada,
    horario_valido: j.horario_valido,
    mensaje_horario: j.mensaje_horario,
    hora_llegada_estimada: j.hora_llegada_estimada,
    tramos_elegidos: j.tramos_elegidos,
    hora_salida_real: j.hora_salida_real,
    hora_llegada_real: j.hora_llegada_real,
    tiempo_manejo_estimado_min: j.tiempo_manejo_estimado_min,
    tiempo_abordaje_total_min: j.tiempo_abordaje_total_min,
    tiempo_total_estimado_min: j.tiempo_total_estimado_min,
    distancia_total_km: j.distancia_total_km,
    variante: j.variante || ruta.variante,
    polyline_geometry: j.polyline_geometry,
  };
}

/** Derived overall estado from the journeys (combined) or the top-level estado (legacy). */
export function computeRutaEstado(ruta: RutaDiaria): EstadoRuta {
  const journeys = getJourneys(ruta);
  if (journeys.length === 0) return ruta.estado;

  const allDone = journeys.every(
    (j) =>
      j.estado === 'completada' ||
      (j.paradas.length > 0 && j.paradas.every((p) => p.estado === 'recogido' || p.estado === 'ausente'))
  );
  if (allDone) return 'completada';

  const anyStarted = journeys.some((j) => j.estado === 'en_curso' || j.estado === 'completada');
  if (anyStarted) return 'en_curso';

  return 'planificada';
}

/** Concatenated paradas of all journeys (fallback: ruta.paradas). */
export function getAllParadas(ruta: RutaDiaria): RutaDiaria['paradas'] {
  const journeys = getJourneys(ruta);
  if (journeys.length === 0) return ruta.paradas || [];
  return journeys.flatMap((j) => j.paradas || []);
}

/**
 * Apply a patch to one journey and rebuild the derived top-level fields
 * (ruta.paradas = concatenation, ruta.estado = computed from journeys).
 */
export function updateJourney(
  ruta: RutaDiaria,
  key: JourneyKey,
  patch: Partial<RutaTrayecto>
): RutaDiaria {
  const j = getJourney(ruta, key);
  if (!j) return ruta;
  const updatedJourney: RutaTrayecto = { ...j, ...patch };
  const next: RutaDiaria = { ...ruta, [key]: updatedJourney };
  next.paradas = getAllParadas(next);
  next.estado = computeRutaEstado(next);
  return next;
}
