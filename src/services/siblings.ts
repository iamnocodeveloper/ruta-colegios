import { Alumno } from '../types';

interface StopLike {
  alumno_id: string;
  lat: number;
  lng: number;
}

/** Normaliza hermano_ids a un array seguro y sin duplicados. */
export function normalizeSiblingIds(ids?: string[]): string[] {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter(Boolean))];
}

/**
 * Devuelve el conjunto completo del grupo de hermanos (el propio alumno + sus
 * hermano_ids + los hermano_ids de cada uno). Útil para mantener simetría.
 */
export function getSiblingGroup(alumno: Alumno, alumnosMap: Map<string, Alumno>): string[] {
  const set = new Set<string>([alumno.id, ...normalizeSiblingIds(alumno.hermano_ids)]);
  for (const id of [...set]) {
    const sib = alumnosMap.get(id);
    if (sib) normalizeSiblingIds(sib.hermano_ids).forEach((h) => set.add(h));
  }
  return [...set];
}

/**
 * Cuántos hermanos (incluido el alumno de la parada) comparten la MISMA
 * ubicación exacta (lat/lng) dentro de la misma lista de paradas.
 */
export function countSiblingsInStop(
  parada: StopLike,
  allParadas: StopLike[],
  alumnosMap: Map<string, Alumno>
): number {
  const alumno = alumnosMap.get(parada.alumno_id);
  if (!alumno) return 1;

  const group = getSiblingGroup(alumno, alumnosMap);
  if (group.length <= 1) return 1;

  const inRoute = allParadas.filter((p) => group.includes(p.alumno_id));
  const sameSpot = inRoute.filter(
    (p) => Number(p.lat) === Number(parada.lat) && Number(p.lng) === Number(parada.lng)
  );

  return sameSpot.length >= 1 ? sameSpot.length : 1;
}
