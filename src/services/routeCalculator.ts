/**
 * Inverse Departure Time Algorithm & Route Optimization Engine
 * Calculates:
 *   1. Optimal stop sequence (TSP / Mapbox Optimization / OSRM)
 *   2. Driving duration (T_manejo) with traffic multipliers
 *   3. Boarding buffer (N * T_abordaje)
 *   4. T_total = T_manejo + (N * T_abordaje)
 *   5. H_salida_estimada = H_llegada - T_total
 *   6. Step-by-step intermediate ETAs for each student stop
 */

import { Alumno, Colegio, ModoOptimizacion, RouteAlternative, RouteOptimizationResult, RutaLeg, TipoTrayecto } from '../types';

// ===========================================================================
// VALIDACIÓN DE HORARIO ELEGIDO (H_salida + H_llegada) PARA EL TRAYECTO
// ===========================================================================

export interface ScheduleValidation {
  valido: boolean;
  mensaje: string;
  minutosDisponibles: number;  // H_llegada_deseada - H_salida_deseada
  tiempoTotalMin: number;      // T_total (manejo + abordaje de TODAS las paradas)
  minutosFaltantes: number;    // cuántos minutos faltan (0 si es válido)
  horaLlegadaEstimada: string; // H_salida_deseada + T_total
  horaSalidaRecomendada: string; // H_llegada_deseada - T_total
  numParadas: number;
}

/**
 * Valida si un horario elegido por el usuario (hora de salida + hora de llegada)
 * cubre el trayecto completo (TODAS las paradas):
 *   H_llegada_deseada - H_salida_deseada >= T_total
 *
 * Devuelve un mensaje claro en español indicando si las horas coinciden o no
 * ("Las horas no coinciden para el trayecto") con la sugerencia corregida.
 */
export function validateSchedule(
  horaSalidaDeseada: string,
  horaLlegadaDeseada: string,
  tiempoTotalMin: number,
  numParadas: number = 0
): ScheduleValidation {
  const salida = timeStringToMinutes(horaSalidaDeseada);
  const llegada = timeStringToMinutes(horaLlegadaDeseada);

  // Normalizar a "HH:MM:SS"
  const norm = (t: string) => (t.length === 5 ? `${t}:00` : t);

  let minutosDisponibles = llegada - salida;
  // Si la llegada es al día siguiente (ej. salida 23:30, llegada 00:15)
  if (minutosDisponibles < 0) minutosDisponibles += 24 * 60;

  const minutosFaltantes = Math.max(0, Math.round((tiempoTotalMin - minutosDisponibles) * 10) / 10);
  const valido = minutosDisponibles >= tiempoTotalMin;

  const horaSalidaRecomendada = minutesToTimeString(llegada - tiempoTotalMin);
  const horaLlegadaEstimada = minutesToTimeString(salida + tiempoTotalMin);

  let mensaje: string;
  if (valido) {
    mensaje =
      `Horario válido: saliendo a las ${norm(horaSalidaDeseada).substring(0, 5)} y llegando a las ` +
      `${norm(horaLlegadaDeseada).substring(0, 5)}, hay ${minutosDisponibles} min disponibles y el trayecto ` +
      `(${numParadas} paradas) necesita ${tiempoTotalMin} min.`;
  } else {
    mensaje =
      `⚠️ Las horas NO coinciden para el trayecto: entre la salida (${norm(horaSalidaDeseada).substring(0, 5)}) ` +
      `y la llegada (${norm(horaLlegadaDeseada).substring(0, 5)}) solo hay ${minutosDisponibles} min, pero la ruta ` +
      `completa con ${numParadas} paradas necesita ${tiempoTotalMin} min (manejo + abordaje). Faltan ` +
      `${minutosFaltantes} min. Sugerencia: sal a las ${horaSalidaRecomendada.substring(0, 5)} ` +
      `(o llega a las ${horaLlegadaEstimada.substring(0, 5)}).`;
  }

  return {
    valido,
    mensaje,
    minutosDisponibles,
    tiempoTotalMin,
    minutosFaltantes,
    horaLlegadaEstimada,
    horaSalidaRecomendada,
    numParadas,
  };
}

/**
 * Reconstruye la polyline de la ruta concatenando la alternativa elegida de
 * CADA tramo (leg). `choices` mapea legIndex -> índice de alternativa
 * (0 = principal del tramo, 1..n = alternativa). Si no hay choices o legs,
 * devuelve [].
 */
export function buildPolylineFromLegs(
  legs: RutaLeg[],
  choices?: Record<number, number>
): [number, number][] {
  if (!legs || legs.length === 0) return [];
  const polyline: [number, number][] = [];
  legs.forEach((leg, i) => {
    const choice = (choices && choices[i] !== undefined ? choices[i] : 0) as number;
    const alt = choice > 0 ? leg.alternatives[choice - 1] : undefined;
    const chosen = alt || leg.main;
    if (chosen && chosen.polyline && chosen.polyline.length > 0) {
      // Evitar duplicar el punto de unión entre tramos consecutivos
      const pts = chosen.polyline;
      if (polyline.length > 0 && pts.length > 0) {
        const last = polyline[polyline.length - 1];
        const first = pts[0];
        if (Math.abs(last[0] - first[0]) < 1e-9 && Math.abs(last[1] - first[1]) < 1e-9) {
          polyline.push(...pts.slice(1));
        } else {
          polyline.push(...pts);
        }
      } else {
        polyline.push(...pts);
      }
    }
  });
  return polyline;
}

/**
 * Calculates Haversine distance in kilometers between two geo coordinates
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Filter students eligible for the given journey type (ida vs vuelta)
 * Excludes students marked as inactive for routes (activo_en_rutas === false)
 * Optionally filters by day of week (dias_ruta)
 */
export function filterStudentsForJourney(
  students: Alumno[],
  tipoTrayecto: TipoTrayecto = 'ida',
  dia?: string
): Alumno[] {
  return students.filter((s) => {
    if (s.activo_en_rutas === false) return false;

    // Day filter: if a specific day is requested, only include students attending that day
    if (dia) {
      const dias = normalizeDays(s.dias_ruta);
      if (!dias.includes(dia)) return false;
    }

    const mod = s.modalidad_servicio || 'ida_y_vuelta';
    if (tipoTrayecto === 'ida') {
      return mod === 'ida_y_vuelta' || mod === 'solo_ida';
    } else {
      return mod === 'ida_y_vuelta' || mod === 'solo_vuelta';
    }
  });
}

/**
 * Map a Date / weekday index to the label used in dias_ruta.
 */
export function weekdayLabel(date: Date = new Date()): string {
  const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return labels[date.getDay()] || 'Lun';
}

export const DEFAULT_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

/**
 * Normalize dias_ruta: accepts array, JSON string, or undefined/null.
 * Always returns a valid array (defaults to Mon-Fri).
 */
export function normalizeDays(dias: any): string[] {
  if (Array.isArray(dias)) {
    return dias.length > 0 ? dias : DEFAULT_DAYS;
  }
  if (typeof dias === 'string') {
    try {
      const parsed = JSON.parse(dias);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // not JSON — maybe comma separated
      const split = dias.split(',').map((d) => d.trim()).filter(Boolean);
      if (split.length > 0) return split;
    }
  }
  return DEFAULT_DAYS;
}

/**
 * Estimated driving speed in urban school bus conditions (km/h)
 */
function getEstimatedSpeedKmh(mode: ModoOptimizacion): number {
  return mode === 'trafico_real' ? 20.0 : 28.0;
}

/**
 * Parses "HH:MM:SS" or "HH:MM" into total minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  const seconds = parts[2] || 0;
  return hours * 60 + minutes + Math.round(seconds / 60);
}

/**
 * Converts total minutes from midnight into "HH:MM:SS"
 */
export function minutesToTimeString(totalMinutes: number): string {
  let normalized = Math.round(totalMinutes);
  while (normalized < 0) normalized += 24 * 60;
  normalized = normalized % (24 * 60);

  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
}

/**
 * Formats "HH:MM:SS" to friendly 12h format (e.g. "7:15 AM")
 */
export function formatFriendlyTime(timeStr: string): string {
  if (!timeStr) return '--:--';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${(m || 0).toString().padStart(2, '0')} ${period}`;
}

/**
 * Solves TSP (Traveling Salesperson Problem) for stops using Nearest Neighbor + 2-Opt Heuristic
 */
export function solveOptimalSequence(
  startPoint: { lat: number; lng: number },
  endPoint: { lat: number; lng: number },
  students: Alumno[]
): Alumno[] {
  if (students.length <= 1) return [...students];

  // Nearest Neighbor from Start to End
  const remaining = [...students];
  const ordered: Alumno[] = [];
  let currentPos = startPoint;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let minCost = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const distFromCurrent = calculateHaversineDistance(
        currentPos.lat,
        currentPos.lng,
        s.lat,
        s.lng
      );
      const distToEnd = calculateHaversineDistance(
        s.lat,
        s.lng,
        endPoint.lat,
        endPoint.lng
      );
      const totalScore = distFromCurrent * 1.5 + distToEnd * 0.5;

      if (totalScore < minCost) {
        minCost = totalScore;
        bestIdx = i;
      }
    }

    const nextStudent = remaining.splice(bestIdx, 1)[0];
    ordered.push(nextStudent);
    currentPos = { lat: nextStudent.lat, lng: nextStudent.lng };
  }

  // 2-Opt refinement
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 30) {
    improved = false;
    iterations++;

    for (let i = 0; i < ordered.length - 1; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const dCurrent = calculateTotalRouteDistance(startPoint, endPoint, ordered);
        const swapped = [
          ...ordered.slice(0, i),
          ...ordered.slice(i, j + 1).reverse(),
          ...ordered.slice(j + 1)
        ];
        const dSwapped = calculateTotalRouteDistance(startPoint, endPoint, swapped);

        if (dSwapped < dCurrent - 0.05) {
          ordered.splice(0, ordered.length, ...swapped);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return ordered;
}

function calculateTotalRouteDistance(
  startPoint: { lat: number; lng: number },
  endPoint: { lat: number; lng: number },
  sequence: Alumno[]
): number {
  if (sequence.length === 0) {
    return calculateHaversineDistance(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng);
  }
  let total = calculateHaversineDistance(startPoint.lat, startPoint.lng, sequence[0].lat, sequence[0].lng);
  for (let i = 0; i < sequence.length - 1; i++) {
    total += calculateHaversineDistance(
      sequence[i].lat,
      sequence[i].lng,
      sequence[i + 1].lat,
      sequence[i + 1].lng
    );
  }
  total += calculateHaversineDistance(
    sequence[sequence.length - 1].lat,
    sequence[sequence.length - 1].lng,
    endPoint.lat,
    endPoint.lng
  );
  return total;
}

/**
 * Generate alternative route variants with different strategies:
 *   - '2opt': Nearest Neighbor + 2-Opt (shortest, default)
 *   - 'nearest': Pure Nearest Neighbor (greedy)
 *   - 'farthest': Farthest-first (spreads stops, different shape)
 *   - 'random': Random seed (exploration)
 * Returns the sequence of student ids for each variant.
 */
export function generateRouteVariants(
  startPoint: { lat: number; lng: number },
  endPoint: { lat: number; lng: number },
  students: Alumno[]
): { id: string; label: string; description: string; studentIds: string[] }[] {
  if (students.length <= 1) {
    return [{
      id: '2opt',
      label: 'Única (1 parada)',
      description: 'Ruta directa',
      studentIds: students.map((s) => s.id),
    }];
  }

  const variants: { id: string; label: string; description: string; studentIds: string[] }[] = [];

  // 1. 2-Opt (default shortest)
  variants.push({
    id: '2opt',
    label: 'Óptima (2-Opt)',
    description: 'Menor distancia probable',
    studentIds: solveOptimalSequence(startPoint, endPoint, students).map((s) => s.id),
  });

  // 2. Pure nearest neighbor
  const nearest: Alumno[] = [];
  const remainingNN = [...students];
  let curNN = startPoint;
  while (remainingNN.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remainingNN.length; i++) {
      const d = calculateHaversineDistance(curNN.lat, curNN.lng, remainingNN[i].lat, remainingNN[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remainingNN.splice(bestIdx, 1)[0];
    nearest.push(next);
    curNN = { lat: next.lat, lng: next.lng };
  }
  variants.push({
    id: 'nearest',
    label: 'Vecino Cercano',
    description: 'Greedy, rápido',
    studentIds: nearest.map((s) => s.id),
  });

  // 3. Farthest-first (spread)
  const farthest: Alumno[] = [];
  const remainingFF = [...students];
  let curFF = startPoint;
  while (remainingFF.length > 0) {
    let bestIdx = 0;
    let bestDist = -Infinity;
    for (let i = 0; i < remainingFF.length; i++) {
      const d = calculateHaversineDistance(curFF.lat, curFF.lng, remainingFF[i].lat, remainingFF[i].lng);
      if (d > bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remainingFF.splice(bestIdx, 1)[0];
    farthest.push(next);
    curFF = { lat: next.lat, lng: next.lng };
  }
  variants.push({
    id: 'farthest',
    label: 'Extremos Primero',
    description: 'Barrido geográfico',
    studentIds: farthest.map((s) => s.id),
  });

  // 4. Randomized (seeded shuffle + nearest-neighbor reorder)
  const shuffled = [...students].sort(() => Math.random() - 0.5);
  const random: Alumno[] = [];
  const remainingR = [...shuffled];
  let curR = startPoint;
  while (remainingR.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remainingR.length; i++) {
      const d = calculateHaversineDistance(curR.lat, curR.lng, remainingR[i].lat, remainingR[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remainingR.splice(bestIdx, 1)[0];
    random.push(next);
    curR = { lat: next.lat, lng: next.lng };
  }
  variants.push({
    id: 'random',
    label: 'Aleatoria',
    description: 'Exploración',
    studentIds: random.map((s) => s.id),
  });

  return variants;
}

/**
 * Calculate total distance (km) for a given student ordering (using Haversine).
 */
export function variantDistance(
  startPoint: { lat: number; lng: number },
  endPoint: { lat: number; lng: number },
  studentIds: string[],
  alumnosMap: Map<string, Alumno>
): number {
  const points = studentIds
    .map((id) => alumnosMap.get(id))
    .filter((s): s is Alumno => Boolean(s))
    .map((s) => ({ lat: s.lat, lng: s.lng }));

  if (points.length === 0) {
    return calculateHaversineDistance(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng);
  }

  let total = calculateHaversineDistance(startPoint.lat, startPoint.lng, points[0].lat, points[0].lng);
  for (let i = 0; i < points.length - 1; i++) {
    total += calculateHaversineDistance(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  total += calculateHaversineDistance(points[points.length - 1].lat, points[points.length - 1].lng, endPoint.lat, endPoint.lng);
  return Math.round(total * 10) / 10;
}

/**
 * Consulta OSRM con rutas alternativas (alternatives=true → ruta principal + alternativas).
 * Devuelve las rutas crudas ordenadas (main primero). Vacío si falla.
 */
async function fetchOsrmRoutes(points: Array<{ lat: number; lng: number }>): Promise<any[]> {
  if (points.length < 2) return [];
  try {
    // Format coordinate string for OSRM: lon,lat;lon,lat...
    const coordString = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&alternatives=true`;

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        return data.routes;
      }
    }
  } catch {
    // Fallback gracefully below
  }
  return [];
}

/** Convierte una ruta OSRM cruda en RouteAlternative (con factor de tráfico). */
function buildRouteAlternative(route: any, trafficFactor: number): RouteAlternative {
  const coordinates: [number, number][] = route.geometry.coordinates.map(
    ([lon, lat]: [number, number]) => [lat, lon]
  );
  const distanceKm = route.distance / 1000;
  const durationMin = (route.duration / 60) * trafficFactor;
  return {
    polyline: coordinates,
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin: Math.round(durationMin * 10) / 10,
  };
}

/** Longitud de una polyline en km (suma haversine entre puntos consecutivos). */
function polylineDistanceKm(polyline: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    total += calculateHaversineDistance(polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1]);
  }
  return Math.round(total * 10) / 10;
}

/** Índice del punto de la polyline más cercano a una coordenada. */
function nearestIndex(polyline: [number, number][], coord: { lat: number; lng: number }): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const d = calculateHaversineDistance(polyline[i][0], polyline[i][1], coord.lat, coord.lng);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Recorta la polyline principal entre dos coordenadas (por índice más cercano). */
function slicePolylineBetween(
  polyline: [number, number][],
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): [number, number][] {
  const iA = nearestIndex(polyline, a);
  const iB = nearestIndex(polyline, b);
  const lo = Math.min(iA, iB);
  const hi = Math.max(iA, iB);
  return polyline.slice(lo, hi + 1);
}

// ===========================================================================
// Caché de alternativas por tramo A→B (evita saturar OSRM en recálculos)
// ===========================================================================
const LEG_ALT_CACHE = new Map<string, RouteAlternative[]>();

function legCacheKey(a: { lat: number; lng: number }, b: { lat: number; lng: number }, mode: ModoOptimizacion): string {
  return `${a.lng.toFixed(6)},${a.lat.toFixed(6)};${b.lng.toFixed(6)},${b.lat.toFixed(6)}:${mode}`;
}

/**
 * Obtiene las rutas (principal + alternativas) de UN tramo A→B con caché.
 * Devuelve array: [main, ...alts]; si falla, fallback geométrico como único elemento.
 */
async function fetchLegRoutes(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  mode: ModoOptimizacion
): Promise<RouteAlternative[]> {
  const key = legCacheKey(a, b, mode);
  const cached = LEG_ALT_CACHE.get(key);
  if (cached) return cached;

  const trafficFactor = mode === 'trafico_real' ? 1.35 : 1.12;
  const raw = await fetchOsrmRoutes([a, b]);
  let routes: RouteAlternative[];
  if (raw.length > 0) {
    routes = raw.map((r) => buildRouteAlternative(r, trafficFactor));
  } else {
    // Fallback geométrico: solo la línea directa
    const dist = calculateHaversineDistance(a.lat, a.lng, b.lat, b.lng) * 1.25;
    const speed = getEstimatedSpeedKmh(mode);
    const steps = 6;
    const polyline: [number, number][] = [];
    for (let s = 0; s <= steps; s++) {
      const fraction = s / steps;
      polyline.push([a.lat + (b.lat - a.lat) * fraction, a.lng + (b.lng - a.lng) * fraction]);
    }
    routes = [{ polyline, distanceKm: Math.round(dist * 10) / 10, durationMin: Math.round(((dist / speed) * 60 * trafficFactor) * 10) / 10 }];
  }

  // Cap de caché simple (evitar crecer sin límite)
  if (LEG_ALT_CACHE.size > 300) LEG_ALT_CACHE.clear();
  LEG_ALT_CACHE.set(key, routes);
  return routes;
}

/**
 * Obtiene geometría real + duración para una secuencia de puntos, con RUTA ALTERNATIVA
 * (estilo Google Maps) construida POR TRAMO.
 *
 * OSRM público solo devuelve alternativas para consultas A→B (2 puntos), así que:
 *   - La ruta principal viene de una sola consulta de todo el recorrido (calles reales).
 *   - La alternativa se arma consultando los 3 tramos MÁS LARGOS con alternatives=true
 *     y reemplazando esos segmentos en la polyline principal por su alternativa.
 */
export async function fetchRoadGeometryWithAlternatives(
  points: Array<{ lat: number; lng: number }>,
  mode: ModoOptimizacion
): Promise<{
  main: { polyline: [number, number][]; realDrivingMinutes: number; totalDistanceKm: number };
  alternatives: RouteAlternative[];
  legs: RutaLeg[];
}> {
  if (points.length < 2) {
    return {
      main: { polyline: points.map((p) => [p.lat, p.lng]), realDrivingMinutes: 0, totalDistanceKm: 0 },
      alternatives: [],
      legs: [],
    };
  }

  const trafficFactor = mode === 'trafico_real' ? 1.35 : 1.12;
  const routes = await fetchOsrmRoutes(points);

  // Fallback geométrico si OSRM falla para la ruta principal
  if (routes.length === 0) {
    let fallbackDistance = 0;
    const polyline: [number, number][] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const legDist = calculateHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
      fallbackDistance += legDist * 1.25;
      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const fraction = s / steps;
        polyline.push([p1.lat + (p2.lat - p1.lat) * fraction, p1.lng + (p2.lng - p1.lng) * fraction]);
      }
    }
    const speed = getEstimatedSpeedKmh(mode);
    const fallbackDurationMin = (fallbackDistance / speed) * 60;
    return {
      main: {
        polyline,
        realDrivingMinutes: Math.round(fallbackDurationMin * 10) / 10,
        totalDistanceKm: Math.round(fallbackDistance * 10) / 10,
      },
      alternatives: [],
      legs: [],
    };
  }

  // Ruta principal: consulta OSRM de todo el recorrido
  const mainParsed = buildRouteAlternative(routes[0], trafficFactor);
  const main = {
    polyline: mainParsed.polyline,
    realDrivingMinutes: mainParsed.durationMin,
    totalDistanceKm: mainParsed.distanceKm,
  };

  // Tramos entre paradas consecutivas
  const legPairs = points.slice(1).map((b, i) => ({ a: points[i], b, i }));

  // Elegir los 3 tramos más largos (donde el detour tiene más sentido)
  const withDist = legPairs.map((lp) => ({
    ...lp,
    dist: calculateHaversineDistance(lp.a.lat, lp.a.lng, lp.b.lat, lp.b.lng),
  }));
  const longest = [...withDist].sort((x, y) => y.dist - x.dist).slice(0, 3);
  const queriedIndexes = new Set(longest.map((l) => l.i));

  // Consultar alternativas de los tramos elegidos (paralelo + caché)
  const legRoutesByIndex = new Map<number, RouteAlternative[]>();
  await Promise.all(
    longest.map(async (lp) => {
      const routesLeg = await fetchLegRoutes(lp.a, lp.b, mode);
      legRoutesByIndex.set(lp.i, routesLeg);
    })
  );

  // Construir legs (con su alternativa por tramo) + polyline alternativa continua
  const legs: RutaLeg[] = [];
  const altPolyline: [number, number][] = [];
  let altDistanceKm = 0;
  let altDurationMin = 0;

  legPairs.forEach((lp) => {
    const mainSlice = slicePolylineBetween(main.polyline, lp.a, lp.b);
    const legRoutes = legRoutesByIndex.get(lp.i) || [];
    const legMain = legRoutes.length > 0 ? legRoutes[0] : { polyline: mainSlice, distanceKm: polylineDistanceKm(mainSlice), durationMin: (polylineDistanceKm(mainSlice) / getEstimatedSpeedKmh(mode)) * 60 * trafficFactor };
    const legAlts = legRoutes.slice(1);

    legs.push({
      from: { lat: lp.a.lat, lng: lp.a.lng },
      to: { lat: lp.b.lat, lng: lp.b.lng },
      main: legMain,
      alternatives: legAlts,
    });

    // Usar la 1ª alternativa del tramo si existe; si no, el tramo principal
    const chosen = legAlts.length > 0 ? legAlts[0] : legMain;
    altPolyline.push(...chosen.polyline);
    altDistanceKm += chosen.distanceKm;
    altDurationMin += chosen.durationMin;
  });

  const alternatives: RouteAlternative[] =
    altPolyline.length > 0
      ? [
          {
            polyline: altPolyline,
            distanceKm: Math.round(altDistanceKm * 10) / 10,
            durationMin: Math.round(altDurationMin * 10) / 10,
          },
        ]
      : [];

  return { main, alternatives, legs };
}

export async function fetchRoadGeometryAndDuration(
  points: Array<{ lat: number; lng: number }>,
  mode: ModoOptimizacion
): Promise<{ polyline: [number, number][]; realDrivingMinutes: number; totalDistanceKm: number }> {
  if (points.length < 2) {
    return { polyline: points.map((p) => [p.lat, p.lng]), realDrivingMinutes: 0, totalDistanceKm: 0 };
  }

  try {
    // Format coordinate string for OSRM: lon,lat;lon,lat...
    const coordString = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates.map(
          ([lon, lat]: [number, number]) => [lat, lon]
        );
        const distanceKm = route.distance / 1000;
        let durationMin = route.duration / 60;

        // Apply traffic multiplier for school peak hours
        const trafficFactor = mode === 'trafico_real' ? 1.35 : 1.12;
        durationMin = durationMin * trafficFactor;

        return {
          polyline: coordinates,
          realDrivingMinutes: Math.round(durationMin * 10) / 10,
          totalDistanceKm: Math.round(distanceKm * 10) / 10
        };
      }
    }
  } catch {
    // Fallback gracefully to curved geometric road approximation if offline or OSRM rate limited
  }

  // Geometric fallback
  let fallbackDistance = 0;
  const polyline: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const legDist = calculateHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    fallbackDistance += legDist * 1.25; // 1.25 urban street winding factor

    // Intermediate points for smooth visual line
    const steps = 6;
    for (let s = 0; s <= steps; s++) {
      const fraction = s / steps;
      const lat = p1.lat + (p2.lat - p1.lat) * fraction;
      const lng = p1.lng + (p2.lng - p1.lng) * fraction;
      polyline.push([lat, lng]);
    }
  }

  const speed = getEstimatedSpeedKmh(mode);
  const fallbackDurationMin = (fallbackDistance / speed) * 60;

  return {
    polyline,
    realDrivingMinutes: Math.round(fallbackDurationMin * 10) / 10,
    totalDistanceKm: Math.round(fallbackDistance * 10) / 10
  };
}

/**
 * Main Route Optimization & Departure Algorithm (Cálculo de Rutas de Ida y Vuelta)
 */
export async function calculateOptimizedRoute(
  origin: { lat: number; lng: number; direccion?: string },
  school: Colegio,
  students: Alumno[],
  options: {
    modo?: ModoOptimizacion;
    tipoTrayecto?: TipoTrayecto;
    tiempoAbordajeMin?: number;
    horaLlegadaLimite?: string;
    horaSalidaFija?: string; // hora de salida elegida por el usuario (H_salida)
    ordenManual?: string[]; // student ids
  }
): Promise<RouteOptimizationResult> {
  const modo = options.modo || 'fijo';
  const tipoTrayecto: TipoTrayecto = options.tipoTrayecto || 'ida';
  const tiempoAbordajeMin = options.tiempoAbordajeMin ?? 2.5;

  // 1. Filter students according to service modality (ida vs vuelta)
  const eligibleStudents = filterStudentsForJourney(students, tipoTrayecto);

  // 2. Determine Start and End points
  // For 'ida': Driver Origin -> Stops -> School
  // For 'vuelta': School -> Stops -> Driver Origin
  const startPoint = tipoTrayecto === 'ida' ? origin : { lat: school.lat, lng: school.lng };
  const endPoint = tipoTrayecto === 'ida' ? { lat: school.lat, lng: school.lng } : origin;

  // 3. Determine stop sequence
  let orderedStudents: Alumno[] = [];
  if (options.ordenManual && options.ordenManual.length === eligibleStudents.length) {
    const map = new Map(eligibleStudents.map((s) => [s.id, s]));
    orderedStudents = options.ordenManual.map((id) => map.get(id)!).filter(Boolean);
  } else {
    orderedStudents = solveOptimalSequence(startPoint, endPoint, eligibleStudents);
  }

  // 4. Build full waypoint array: [StartPoint, Stop1, Stop2, ... StopN, EndPoint]
  const fullWaypoints = [
    { lat: startPoint.lat, lng: startPoint.lng },
    ...orderedStudents.map((s) => ({ lat: s.lat, lng: s.lng })),
    { lat: endPoint.lat, lng: endPoint.lng }
  ];

  // 5. Obtain realistic road geometry and total driving time (+ ruta alternativa por tramo)
  const { main: mainRoute, alternatives, legs } = await fetchRoadGeometryWithAlternatives(
    fullWaypoints,
    modo
  );
  const { polyline, realDrivingMinutes, totalDistanceKm } = mainRoute;

  // 6. Calculate boarding/drop-off time
  const N = orderedStudents.length;
  const tiempoAbordajeTotal = Math.round(N * tiempoAbordajeMin * 10) / 10;

  // 7. Total time: T_total = T_manejo + (N * T_abordaje)
  const tiempoTotalMin = Math.round((realDrivingMinutes + tiempoAbordajeTotal) * 10) / 10;

  let horaSalidaEstimada: string;
  let runningTimeMinutes: number;

  if (tipoTrayecto === 'ida') {
    if (options.horaSalidaFija) {
      // El usuario ya eligió la hora de salida: las paradas se calculan desde ahí
      horaSalidaEstimada =
        options.horaSalidaFija.length === 5 ? `${options.horaSalidaFija}:00` : options.horaSalidaFija;
      runningTimeMinutes = timeStringToMinutes(horaSalidaEstimada);
    } else {
      // Inverse Departure Time: H_salida = H_llegada - T_total
      const horaLlegadaStr = options.horaLlegadaLimite || school.hora_llegada_limite || '08:00:00';
      const horaLlegadaMinutos = timeStringToMinutes(horaLlegadaStr);
      const horaSalidaMinutos = horaLlegadaMinutos - tiempoTotalMin;
      horaSalidaEstimada = minutesToTimeString(horaSalidaMinutos);
      runningTimeMinutes = horaSalidaMinutos;
    }
  } else {
    // Forward Route from School Departure Time
    const horaSalidaStr = options.horaSalidaFija || options.horaLlegadaLimite || '14:00:00';
    horaSalidaEstimada = horaSalidaStr.length === 5 ? `${horaSalidaStr}:00` : horaSalidaStr;
    runningTimeMinutes = timeStringToMinutes(horaSalidaEstimada);
  }

  // 8. Calculate individual stop ETAs
  let previousPoint = { lat: startPoint.lat, lng: startPoint.lng };
  const speed = (totalDistanceKm / (realDrivingMinutes / 60)) || getEstimatedSpeedKmh(modo);

  const paradasOrdenadas = orderedStudents.map((student, index) => {
    const distFromPrev = calculateHaversineDistance(
      previousPoint.lat,
      previousPoint.lng,
      student.lat,
      student.lng
    ) * 1.2;

    const driveTimeFromPrev = Math.max(1, (distFromPrev / speed) * 60);
    runningTimeMinutes += driveTimeFromPrev;

    const stopEta = minutesToTimeString(runningTimeMinutes);

    // Add boarding / drop-off duration before heading to next
    runningTimeMinutes += tiempoAbordajeMin;
    previousPoint = { lat: student.lat, lng: student.lng };

    return {
      alumno_id: student.id,
      orden: index + 1,
      hora_estimada: stopEta,
      distancia_desde_anterior_km: Math.round(distFromPrev * 10) / 10,
      tiempo_desde_anterior_min: Math.round(driveTimeFromPrev * 10) / 10,
      lat: student.lat,
      lng: student.lng
    };
  });

  return {
    hora_salida_estimada: horaSalidaEstimada,
    tiempo_manejo_min: realDrivingMinutes,
    tiempo_abordaje_total_min: tiempoAbordajeTotal,
    tiempo_total_min: tiempoTotalMin,
    distancia_total_km: totalDistanceKm,
    tipo_trayecto: tipoTrayecto,
    paradas_ordenadas: paradasOrdenadas,
    polyline_geometry: polyline,
    traffic_factor: modo === 'trafico_real' ? 1.35 : 1.12,
    alternativas: alternatives,
    legs: legs,
  };
}
