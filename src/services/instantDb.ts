/**
 * InstantDB Real-Time Synchronization & Authentication Service
 * App ID: 9bfbca9b-1445-4948-98f4-70bfcf2164a2
 *
 * Provides real-time synchronization, relational data schemas,
 * InstantDB authentication (Magic Code email auth), and transactional mutations.
 */

import { init, i, id, tx } from '@instantdb/react';
import {
  Alumno,
  Colegio,
  Conductor,
  ParadaRuta,
  Representante,
  RutaDiaria,
  TrackingLog
} from '../types';
import {
  INITIAL_ALUMNOS,
  INITIAL_CONDUCTORES,
  INITIAL_DRIVER_ORIGIN,
  INITIAL_REPRESENTANTES,
  INITIAL_SCHOOL
} from './mockData';

// InstantDB App ID provided by user
export const INSTANT_APP_ID = '9bfbca9b-1445-4948-98f4-70bfcf2164a2';

// Schema Definition for InstantDB
const _schema = i.schema({
  entities: {
    colegios: i.entity({
      nombre: i.string(),
      direccion: i.string(),
      lat: i.number(),
      lng: i.number(),
      hora_llegada_limite: i.string(),
      contacto_telefono: i.string().optional(),
      created_at: i.string().optional(),
    }),
    representantes: i.entity({
      nombre: i.string(),
      telefono_whatsapp: i.string(),
      magic_token: i.string(),
      email: i.string().optional(),
      created_at: i.string().optional(),
    }),
    alumnos: i.entity({
      nombre: i.string(),
      colegio_id: i.string(),
      representante_id: i.string(),
      direccion_recogida: i.string(),
      lat: i.number(),
      lng: i.number(),
      grado: i.string().optional(),
      notas_medicas: i.string().optional(),
      tiempo_abordaje_estimado_min: i.number().optional(),
      modalidad_servicio: i.string().optional(),
      created_at: i.string().optional(),
    }),
    conductores: i.entity({
      nombre: i.string(),
      telefono: i.string(),
      email: i.string().optional(),
      licencia: i.string().optional(),
      vehiculo_modelo: i.string().optional(),
      vehiculo_placa: i.string().optional(),
      capacidad_pasajeros: i.number().optional(),
      foto_url: i.string().optional(),
      activo: i.boolean(),
      created_at: i.string().optional(),
    }),
    rutas_diarias: i.entity({
      fecha: i.string(),
      colegio_id: i.string(),
      conductor_id: i.string().optional(),
      origen_lat: i.number(),
      origen_lng: i.number(),
      origen_direccion: i.string().optional(),
      modo_optimizacion: i.string(),
      tipo_trayecto: i.string().optional(),
      hora_llegada_objetivo: i.string(),
      hora_salida_estimada: i.string(),
      hora_salida_real: i.string().optional(),
      hora_llegada_real: i.string().optional(),
      tiempo_manejo_estimado_min: i.number(),
      tiempo_abordaje_total_min: i.number(),
      tiempo_total_estimado_min: i.number(),
      distancia_total_km: i.number(),
      estado: i.string(),
      tiempo_abordaje_por_alumno_min: i.number(),
      created_at: i.string().optional(),
      polyline_json: i.string().optional(),
    }),
    paradas_ruta: i.entity({
      ruta_id: i.string(),
      alumno_id: i.string(),
      orden: i.number(),
      hora_estimada: i.string(),
      hora_real: i.string().optional(),
      estado: i.string(),
      distancia_desde_anterior_km: i.number().optional(),
      tiempo_desde_anterior_min: i.number().optional(),
      lat: i.number(),
      lng: i.number(),
      created_at: i.string().optional(),
    }),
    tracking_logs: i.entity({
      ruta_id: i.string(),
      lat: i.number(),
      lng: i.number(),
      velocidad_kmh: i.number().optional(),
      rumbo_grados: i.number().optional(),
      timestamp: i.string(),
    }),
    usuarios: i.entity({
      email: i.string(),
      nombre: i.string(),
      rol: i.string(),
      created_at: i.string().optional(),
    }),
  },
});

export type Schema = typeof _schema;

// Initialize InstantDB client instance
export const db = init<Schema>({ appId: INSTANT_APP_ID });
export { tx, id };

/**
 * Check if a string is a valid UUID format
 */
export function isValidUUID(str?: string): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Ensures an ID is a valid UUID, otherwise generates a valid one via id()
 */
export function ensureUUID(existingId?: string): string {
  if (existingId && isValidUUID(existingId)) {
    return existingId;
  }
  return id();
}

/**
 * Seed initial real school, representatives, students, and default route into InstantDB.
 * Creates records across all 6 entities in InstantDB using valid UUIDs.
 */
export async function seedInstantDatabase(force: boolean = false) {
  try {
    const transactions: any[] = [];

    // 1. Seed School 1 & School 2 (using valid UUIDs)
    transactions.push(
      tx.colegios[INITIAL_SCHOOL.id].update({
        nombre: INITIAL_SCHOOL.nombre,
        direccion: INITIAL_SCHOOL.direccion,
        lat: INITIAL_SCHOOL.lat,
        lng: INITIAL_SCHOOL.lng,
        hora_llegada_limite: INITIAL_SCHOOL.hora_llegada_limite,
        contacto_telefono: INITIAL_SCHOOL.contacto_telefono || '',
        created_at: new Date().toISOString(),
      })
    );

    // Also seed a second default school for variety (Colegio Americano de Quito)
    transactions.push(
      tx.colegios['e1000000-0000-4000-8000-000000000002'].update({
        nombre: 'Colegio Americano de Quito',
        direccion: 'Av. Manuel Córdova Galarza y Carcelén, Quito, Ecuador',
        lat: -0.0985,
        lng: -78.4835,
        hora_llegada_limite: '07:30:00',
        contacto_telefono: '+593 2 397 6300',
        created_at: new Date().toISOString(),
      })
    );

    // 2. Seed Representantes (UUIDs)
    for (const rep of INITIAL_REPRESENTANTES) {
      transactions.push(
        tx.representantes[rep.id].update({
          nombre: rep.nombre,
          telefono_whatsapp: rep.telefono_whatsapp,
          magic_token: rep.magic_token,
          email: rep.email || '',
          created_at: new Date().toISOString(),
        })
      );
    }

    // 3. Seed Alumnos (UUIDs)
    for (const alu of INITIAL_ALUMNOS) {
      transactions.push(
        tx.alumnos[alu.id].update({
          nombre: alu.nombre,
          colegio_id: alu.colegio_id,
          representante_id: alu.representante_id,
          direccion_recogida: alu.direccion_recogida,
          lat: alu.lat,
          lng: alu.lng,
          grado: alu.grado || '',
          notas_medicas: alu.notas_medicas || '',
          tiempo_abordaje_estimado_min: alu.tiempo_abordaje_estimado_min || 2.5,
          modalidad_servicio: alu.modalidad_servicio || 'ida_y_vuelta',
          created_at: new Date().toISOString(),
        })
      );
    }

    // 4. Seed Conductores (UUIDs)
    for (const cond of INITIAL_CONDUCTORES) {
      transactions.push(
        tx.conductores[cond.id].update({
          nombre: cond.nombre,
          telefono: cond.telefono,
          email: cond.email || '',
          licencia: cond.licencia || '',
          vehiculo_modelo: cond.vehiculo_modelo || '',
          vehiculo_placa: cond.vehiculo_placa || '',
          capacidad_pasajeros: cond.capacidad_pasajeros || 16,
          foto_url: cond.foto_url || '',
          activo: cond.activo,
          created_at: new Date().toISOString(),
        })
      );
    }

    // 5. Seed Admin Demo User (UUID)
    const adminUserId = 'e4000000-0000-4000-8000-000000000001';
    transactions.push(
      tx.usuarios[adminUserId].update({
        email: 'admin@demo.com',
        nombre: 'Administrador Demo',
        rol: 'admin',
        created_at: new Date().toISOString(),
      })
    );

    // 6. Seed Initial Route & Stops (UUIDs)
    const today = new Date().toISOString().substring(0, 10);
    const initialRouteId = 'e5000000-0000-4000-8000-000000000001';
    transactions.push(
      tx.rutas_diarias[initialRouteId].update({
        fecha: today,
        colegio_id: INITIAL_SCHOOL.id,
        conductor_id: INITIAL_CONDUCTORES[0].id,
        origen_lat: INITIAL_DRIVER_ORIGIN.lat,
        origen_lng: INITIAL_DRIVER_ORIGIN.lng,
        origen_direccion: INITIAL_DRIVER_ORIGIN.direccion,
        modo_optimizacion: 'fijo',
        hora_llegada_objetivo: INITIAL_SCHOOL.hora_llegada_limite,
        hora_salida_estimada: '07:18:00',
        tiempo_manejo_estimado_min: 27.5,
        tiempo_abordaje_total_min: 12.5,
        tiempo_total_estimado_min: 40.0,
        distancia_total_km: 9.4,
        estado: 'planificada',
        tiempo_abordaje_por_alumno_min: 2.5,
        created_at: new Date().toISOString(),
      })
    );

    for (let idx = 0; idx < INITIAL_ALUMNOS.length; idx++) {
      const alu = INITIAL_ALUMNOS[idx];
      const paradaId = `e6000000-0000-4000-8000-00000000000${idx + 1}`;
      transactions.push(
        tx.paradas_ruta[paradaId].update({
          ruta_id: initialRouteId,
          alumno_id: alu.id,
          orden: idx + 1,
          hora_estimada: `07:${20 + idx * 6}:00`,
          estado: 'pendiente',
          lat: alu.lat,
          lng: alu.lng,
          distancia_desde_anterior_km: 1.8,
          tiempo_desde_anterior_min: 5.5,
          created_at: new Date().toISOString(),
        })
      );
    }

    await db.transact(transactions);
    console.log('[InstantDB] Seeded all 6 tables successfully to InstantDB App ID:', INSTANT_APP_ID);
    return true;
  } catch (err) {
    console.error('[InstantDB] Error seeding data:', err);
    return false;
  }
}

/**
 * Upsert a school in InstantDB
 */
export async function upsertColegioInstant(colegio: Colegio) {
  const colId = ensureUUID(colegio.id);
  await db.transact([
    tx.colegios[colId].update({
      nombre: colegio.nombre,
      direccion: colegio.direccion,
      lat: Number(colegio.lat),
      lng: Number(colegio.lng),
      hora_llegada_limite: colegio.hora_llegada_limite,
      contacto_telefono: colegio.contacto_telefono || '',
      created_at: colegio.created_at || new Date().toISOString(),
    }),
  ]);
  return colId;
}

/**
 * Delete a school from InstantDB
 */
export async function deleteColegioInstant(colegioId: string) {
  const safeId = ensureUUID(colegioId);
  await db.transact([tx.colegios[safeId].delete()]);
}

/**
 * Upsert a representative in InstantDB
 */
export async function upsertRepresentanteInstant(rep: Representante) {
  const repId = ensureUUID(rep.id);
  await db.transact([
    tx.representantes[repId].update({
      nombre: rep.nombre,
      telefono_whatsapp: rep.telefono_whatsapp,
      magic_token: rep.magic_token || `tok-${id()}`,
      email: rep.email || '',
      created_at: rep.created_at || new Date().toISOString(),
    }),
  ]);
  return repId;
}

/**
 * Upsert student (and optionally representative) in InstantDB
 */
export async function upsertAlumnoInstant(alumno: Alumno, rep?: Representante) {
  const transactions: any[] = [];
  let repId = alumno.representante_id ? ensureUUID(alumno.representante_id) : id();

  if (rep) {
    repId = ensureUUID(rep.id);
    transactions.push(
      tx.representantes[repId].update({
        nombre: rep.nombre,
        telefono_whatsapp: rep.telefono_whatsapp,
        magic_token: rep.magic_token || `tok-${id()}`,
        email: rep.email || '',
        created_at: rep.created_at || new Date().toISOString(),
      })
    );
  }

  const aluId = ensureUUID(alumno.id);
  const targetColegioId = ensureUUID(alumno.colegio_id);

  transactions.push(
    tx.alumnos[aluId].update({
      nombre: alumno.nombre,
      colegio_id: targetColegioId,
      representante_id: repId,
      direccion_recogida: alumno.direccion_recogida,
      lat: Number(alumno.lat),
      lng: Number(alumno.lng),
      grado: alumno.grado || '',
      notas_medicas: alumno.notas_medicas || '',
      tiempo_abordaje_estimado_min: Number(alumno.tiempo_abordaje_estimado_min || 2.5),
      modalidad_servicio: alumno.modalidad_servicio || 'ida_y_vuelta',
      created_at: alumno.created_at || new Date().toISOString(),
    })
  );

  await db.transact(transactions);
  return aluId;
}

/**
 * Delete student from InstantDB
 */
export async function deleteAlumnoInstant(alumnoId: string) {
  const safeId = ensureUUID(alumnoId);
  await db.transact([tx.alumnos[safeId].delete()]);
}

/**
 * Upsert a Driver / Conductor in InstantDB
 */
export async function upsertConductorInstant(conductor: Conductor) {
  const condId = ensureUUID(conductor.id);
  await db.transact([
    tx.conductores[condId].update({
      nombre: conductor.nombre,
      telefono: conductor.telefono,
      email: conductor.email || '',
      licencia: conductor.licencia || '',
      vehiculo_modelo: conductor.vehiculo_modelo || '',
      vehiculo_placa: conductor.vehiculo_placa || '',
      capacidad_pasajeros: Number(conductor.capacidad_pasajeros || 16),
      foto_url: conductor.foto_url || '',
      activo: conductor.activo ?? true,
      created_at: conductor.created_at || new Date().toISOString(),
    }),
  ]);
  return condId;
}

/**
 * Delete a Driver / Conductor from InstantDB
 */
export async function deleteConductorInstant(conductorId: string) {
  const safeId = ensureUUID(conductorId);
  await db.transact([tx.conductores[safeId].delete()]);
}

/**
 * Save / Update Full Daily Route with Stops in InstantDB
 */
export async function saveRutaInstant(ruta: RutaDiaria) {
  const rutaId = ensureUUID(ruta.id);
  const targetColId = ensureUUID(ruta.colegio_id);
  const transactions: any[] = [];

  transactions.push(
    tx.rutas_diarias[rutaId].update({
      fecha: ruta.fecha,
      colegio_id: targetColId,
      conductor_id: ruta.conductor_id || '',
      origen_lat: Number(ruta.origen_lat),
      origen_lng: Number(ruta.origen_lng),
      origen_direccion: ruta.origen_direccion || '',
      modo_optimizacion: ruta.modo_optimizacion,
      tipo_trayecto: ruta.tipo_trayecto || 'ida',
      hora_llegada_objetivo: ruta.hora_llegada_objetivo,
      hora_salida_estimada: ruta.hora_salida_estimada,
      hora_salida_real: ruta.hora_salida_real || '',
      hora_llegada_real: ruta.hora_llegada_real || '',
      tiempo_manejo_estimado_min: Number(ruta.tiempo_manejo_estimado_min || 0),
      tiempo_abordaje_total_min: Number(ruta.tiempo_abordaje_total_min || 0),
      tiempo_total_estimado_min: Number(ruta.tiempo_total_estimado_min || 0),
      distancia_total_km: Number(ruta.distancia_total_km || 0),
      estado: ruta.estado,
      tiempo_abordaje_por_alumno_min: Number(ruta.tiempo_abordaje_por_alumno_min || 2.5),
      created_at: ruta.created_at || new Date().toISOString(),
      polyline_json: JSON.stringify(ruta.polyline_geometry || []),
    })
  );

  if (ruta.paradas && ruta.paradas.length > 0) {
    for (const p of ruta.paradas) {
      const pId = ensureUUID(p.id);
      const aluId = ensureUUID(p.alumno_id);
      transactions.push(
        tx.paradas_ruta[pId].update({
          ruta_id: rutaId,
          alumno_id: aluId,
          orden: Number(p.orden),
          hora_estimada: p.hora_estimada,
          hora_real: p.hora_real || '',
          estado: p.estado,
          distancia_desde_anterior_km: Number(p.distancia_desde_anterior_km || 0),
          tiempo_desde_anterior_min: Number(p.tiempo_desde_anterior_min || 0),
          lat: Number(p.lat),
          lng: Number(p.lng),
          created_at: new Date().toISOString(),
        })
      );
    }
  }

  await db.transact(transactions);
  return rutaId;
}

/**
 * Update single stop status (e.g. 'recogido', 'ausente') in InstantDB in real time
 */
export async function updateParadaEstadoInstant(
  paradaId: string,
  estado: 'pendiente' | 'recogido' | 'completado' | 'ausente',
  horaReal?: string
) {
  const safeId = ensureUUID(paradaId);
  await db.transact([
    tx.paradas_ruta[safeId].update({
      estado,
      hora_real: horaReal || new Date().toLocaleTimeString(),
    }),
  ]);
}

/**
 * Update Route status (e.g. 'en_curso', 'completada')
 */
export async function updateRutaEstadoInstant(
  rutaId: string,
  estado: 'planificada' | 'en_curso' | 'completada' | 'cancelada',
  extra?: { hora_salida_real?: string; hora_llegada_real?: string }
) {
  const safeId = ensureUUID(rutaId);
  const updateData: any = { estado };
  if (extra?.hora_salida_real) updateData.hora_salida_real = extra.hora_salida_real;
  if (extra?.hora_llegada_real) updateData.hora_llegada_real = extra.hora_llegada_real;
  await db.transact([tx.rutas_diarias[safeId].update(updateData)]);
}

/**
 * Log Driver GPS coordinate into tracking_logs collection in real time
 */
export async function recordTrackingInstant(
  rutaId: string,
  lat: number,
  lng: number,
  velocidad?: number,
  rumbo?: number
) {
  const logId = id();
  const safeRutaId = ensureUUID(rutaId);
  await db.transact([
    tx.tracking_logs[logId].update({
      ruta_id: safeRutaId,
      lat: Number(lat),
      lng: Number(lng),
      velocidad_kmh: velocidad !== undefined ? Number(velocidad) : 0,
      rumbo_grados: rumbo !== undefined ? Number(rumbo) : 0,
      timestamp: new Date().toISOString(),
    }),
  ]);
  return logId;
}

