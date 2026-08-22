/**
 * Route History Service
 * Persists every created route (with all its stops, driver, school, geometry) so it can be
 * reviewed later or reused. Storage: localStorage (primary) + InstantDB (cloud sync).
 */
import { RutaDiaria } from '../types';
import { db, tx, ensureUUID } from './instantDb';

const HISTORY_KEY = 'rutaescolar_route_history';

export interface RouteHistoryEntry {
  id: string;              // route id (uuid)
  fecha: string;           // YYYY-MM-DD
  colegio_nombre: string;
  conductor_nombre: string;
  conductor_id?: string;
  estado: string;
  hora_salida_estimada: string;
  hora_llegada_objetivo: string;
  distancia_total_km: number;
  tiempo_total_estimado_min: number;
  total_paradas: number;
  recogidos: number;
  ausentes: number;
  modo_optimizacion: string;
  tipo_trayecto: string;
  created_at: string;      // ISO timestamp
  ruta: RutaDiaria;        // full snapshot
}

function loadHistoryLocal(): RouteHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistoryLocal(entries: RouteHistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Error saving route history to localStorage:', e);
  }
}

/**
 * Build a history entry from a full route snapshot.
 */
export function buildHistoryEntry(ruta: RutaDiaria): RouteHistoryEntry {
  return {
    id: ensureUUID(ruta.id),
    fecha: ruta.fecha,
    colegio_nombre: ruta.colegio?.nombre || 'Colegio',
    conductor_nombre: ruta.conductor?.nombre || 'Sin conductor',
    conductor_id: ruta.conductor_id,
    estado: ruta.estado,
    hora_salida_estimada: ruta.hora_salida_estimada,
    hora_llegada_objetivo: ruta.hora_llegada_objetivo,
    distancia_total_km: ruta.distancia_total_km,
    tiempo_total_estimado_min: ruta.tiempo_total_estimado_min,
    total_paradas: ruta.paradas?.length || 0,
    recogidos: (ruta.paradas || []).filter((p) => p.estado === 'recogido' || p.estado === 'completado').length,
    ausentes: (ruta.paradas || []).filter((p) => p.estado === 'ausente').length,
    modo_optimizacion: ruta.modo_optimizacion,
    tipo_trayecto: ruta.tipo_trayecto || 'ida',
    created_at: new Date().toISOString(),
    ruta: JSON.parse(JSON.stringify(ruta)) as RutaDiaria,
  };
}

/**
 * Save (or upsert) a route into the history list. Most recent first.
 */
export async function saveRouteToHistory(ruta: RutaDiaria): Promise<RouteHistoryEntry> {
  const entry = buildHistoryEntry(ruta);
  const entries = loadHistoryLocal();
  const existingIdx = entries.findIndex((e) => e.id === entry.id);
  if (existingIdx >= 0) {
    entries[existingIdx] = { ...entries[existingIdx], ...entry, created_at: entries[existingIdx].created_at };
  } else {
    entries.unshift(entry);
  }
  // Cap at 200 entries
  const capped = entries.slice(0, 200);
  saveHistoryLocal(capped);

  // Best-effort cloud sync to InstantDB (rutas_diarias already has the route; store a snapshot ref)
  try {
    await db.transact([
      tx.rutas_diarias[entry.id].update({
        fecha: entry.fecha,
        colegio_id: ensureUUID(ruta.colegio_id),
        estado: ruta.estado,
        hora_salida_estimada: ruta.hora_salida_estimada,
        hora_llegada_objetivo: ruta.hora_llegada_objetivo,
      }),
    ]);
  } catch (e) {
    console.warn('Route history cloud sync warning:', e);
  }

  return entry;
}

/**
 * Get full history list (most recent first).
 */
export function getRouteHistory(): RouteHistoryEntry[] {
  return loadHistoryLocal();
}

/**
 * Find a single history entry by route id.
 */
export function getRouteHistoryById(routeId: string): RouteHistoryEntry | undefined {
  const entries = loadHistoryLocal();
  return entries.find((e) => e.id === routeId || e.id === ensureUUID(routeId));
}

/**
 * Delete a route from history.
 */
export function deleteRouteHistory(routeId: string): RouteHistoryEntry[] {
  const entries = loadHistoryLocal().filter((e) => e.id !== routeId && e.id !== ensureUUID(routeId));
  saveHistoryLocal(entries);
  return entries;
}

/**
 * Generate a shareable review link for a route (read-only view).
 */
export function buildRouteReviewLink(routeId: string): string {
  return `${window.location.origin}/?view=review&routeId=${encodeURIComponent(routeId)}`;
}
