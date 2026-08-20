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

import { Alumno, Colegio, ModoOptimizacion, RouteOptimizationResult } from '../types';

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
 * Estimated driving speed in urban school bus conditions (km/h)
 */
function getEstimatedSpeedKmh(mode: ModoOptimizacion): number {
  // In urban areas with stops, turns, speed bumps:
  // Base speed ~ 26 km/h. Under real traffic ~ 19 km/h
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
 * Start: Origin, End: School (Fixed endpoints)
 */
export function solveOptimalSequence(
  origin: { lat: number; lng: number },
  school: { lat: number; lng: number },
  students: Alumno[]
): Alumno[] {
  if (students.length <= 1) return [...students];

  // Nearest Neighbor from Origin to School
  const remaining = [...students];
  const ordered: Alumno[] = [];
  let currentPos = origin;

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
      // Distance to next + slight penalty if too far from destination school
      const distToSchool = calculateHaversineDistance(
        s.lat,
        s.lng,
        school.lat,
        school.lng
      );
      const totalScore = distFromCurrent * 1.5 + distToSchool * 0.5;

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
        const dCurrent = calculateTotalRouteDistance(origin, school, ordered);
        // Swap segment
        const swapped = [
          ...ordered.slice(0, i),
          ...ordered.slice(i, j + 1).reverse(),
          ...ordered.slice(j + 1)
        ];
        const dSwapped = calculateTotalRouteDistance(origin, school, swapped);

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
  origin: { lat: number; lng: number },
  school: { lat: number; lng: number },
  sequence: Alumno[]
): number {
  if (sequence.length === 0) {
    return calculateHaversineDistance(origin.lat, origin.lng, school.lat, school.lng);
  }
  let total = calculateHaversineDistance(origin.lat, origin.lng, sequence[0].lat, sequence[0].lng);
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
    school.lat,
    school.lng
  );
  return total;
}

/**
 * Fetches real road polyline and accurate driving duration using OSRM public routing or fallback
 */
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
 * Main Inverse Departure Algorithm (Cálculo de Salida Inversa)
 */
export async function calculateOptimizedRoute(
  origin: { lat: number; lng: number; direccion?: string },
  school: Colegio,
  students: Alumno[],
  options: {
    modo?: ModoOptimizacion;
    tiempoAbordajeMin?: number;
    horaLlegadaLimite?: string;
    ordenManual?: string[]; // student ids
  }
): Promise<RouteOptimizationResult> {
  const modo = options.modo || 'fijo';
  const tiempoAbordajeMin = options.tiempoAbordajeMin ?? 2.5;
  const horaLlegadaStr = options.horaLlegadaLimite || school.hora_llegada_limite || '08:00:00';
  const horaLlegadaMinutos = timeStringToMinutes(horaLlegadaStr);

  // 1. Determine stop sequence
  let orderedStudents: Alumno[] = [];
  if (options.ordenManual && options.ordenManual.length === students.length) {
    const map = new Map(students.map((s) => [s.id, s]));
    orderedStudents = options.ordenManual.map((id) => map.get(id)!).filter(Boolean);
  } else {
    orderedStudents = solveOptimalSequence(origin, { lat: school.lat, lng: school.lng }, students);
  }

  // 2. Build full waypoint array: [Origin, Stop1, Stop2, ... StopN, School]
  const fullWaypoints = [
    { lat: origin.lat, lng: origin.lng },
    ...orderedStudents.map((s) => ({ lat: s.lat, lng: s.lng })),
    { lat: school.lat, lng: school.lng }
  ];

  // 3. Obtain realistic road geometry and total driving time
  const { polyline, realDrivingMinutes, totalDistanceKm } = await fetchRoadGeometryAndDuration(
    fullWaypoints,
    modo
  );

  // 4. Calculate boarding time
  const N = orderedStudents.length;
  const tiempoAbordajeTotal = Math.round(N * tiempoAbordajeMin * 10) / 10;

  // 5. Total time: T_total = T_manejo + (N * T_abordaje)
  const tiempoTotalMin = Math.round((realDrivingMinutes + tiempoAbordajeTotal) * 10) / 10;

  // 6. Inverse Departure Time: H_salida = H_llegada - T_total
  const horaSalidaMinutos = horaLlegadaMinutos - tiempoTotalMin;
  const horaSalidaEstimada = minutesToTimeString(horaSalidaMinutos);

  // 7. Calculate individual stop ETAs
  let runningTimeMinutes = horaSalidaMinutos;
  let previousPoint = { lat: origin.lat, lng: origin.lng };
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

    // Add boarding duration before heading to next
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
    paradas_ordenadas: paradasOrdenadas,
    polyline_geometry: polyline,
    traffic_factor: modo === 'trafico_real' ? 1.35 : 1.12
  };
}
