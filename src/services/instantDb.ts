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
  ParadaRuta,
  Representante,
  RutaDiaria,
  TrackingLog
} from '../types';
import {
  INITIAL_ALUMNOS,
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
      created_at: i.string().optional(),
    }),
    rutas_diarias: i.entity({
      fecha: i.string(),
      colegio_id: i.string(),
      origen_lat: i.number(),
      origen_lng: i.number(),
      origen_direccion: i.string().optional(),
      modo_optimizacion: i.string(),
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
 * Seed initial real school, representatives, students, and default route into InstantDB.
 * Creates records across all 6 entities in InstantDB.
 */
export async function seedInstantDatabase(force: boolean = false) {
  try {
    const transactions: any[] = [];

    // 1. Seed School
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

    // Also seed a second default school for variety
    const secondSchoolId = 'col_02';
    transactions.push(
      tx.colegios[secondSchoolId].update({
        nombre: 'Colegio Emil Friedman',
        direccion: 'Calle Los Cedros, Los Campitos, Caracas',
        lat: 10.4560,
        lng: -66.8620,
        hora_llegada_limite: '07:45:00',
        contacto_telefono: '+58 212 978 2211',
        created_at: new Date().toISOString(),
      })
    );

    // 2. Seed Representantes
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

    // 3. Seed Alumnos
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
          created_at: new Date().toISOString(),
        })
      );
    }

    // 4. Seed Admin Demo User
    transactions.push(
      tx.usuarios['user_admin_01'].update({
        email: 'admin@demo.com',
        nombre: 'Administrador Demo',
        rol: 'admin',
        created_at: new Date().toISOString(),
      })
    );

    // 5. Seed Initial Route & Stops
    const today = new Date().toISOString().substring(0, 10);
    const initialRouteId = 'ruta_hoy_' + today;
    transactions.push(
      tx.rutas_diarias[initialRouteId].update({
        fecha: today,
        colegio_id: INITIAL_SCHOOL.id,
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
      transactions.push(
        tx.paradas_ruta[`parada_${alu.id}`].update({
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
  const colId = colegio.id || `col_${id()}`;
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
  await db.transact([tx.colegios[colegioId].delete()]);
}

/**
 * Upsert a representative in InstantDB
 */
export async function upsertRepresentanteInstant(rep: Representante) {
  const repId = rep.id || `rep_${id()}`;
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
  let repId = alumno.representante_id;

  if (rep) {
    repId = rep.id || `rep_${id()}`;
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

  const aluId = alumno.id || `alu_${id()}`;
  transactions.push(
    tx.alumnos[aluId].update({
      nombre: alumno.nombre,
      colegio_id: alumno.colegio_id,
      representante_id: repId,
      direccion_recogida: alumno.direccion_recogida,
      lat: Number(alumno.lat),
      lng: Number(alumno.lng),
      grado: alumno.grado || '',
      notas_medicas: alumno.notas_medicas || '',
      tiempo_abordaje_estimado_min: Number(alumno.tiempo_abordaje_estimado_min || 2.5),
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
  await db.transact([tx.alumnos[alumnoId].delete()]);
}

/**
 * Save / Update Full Daily Route with Stops in InstantDB
 */
export async function saveRutaInstant(ruta: RutaDiaria) {
  const rutaId = ruta.id || `ruta_${id()}`;
  const transactions: any[] = [];

  transactions.push(
    tx.rutas_diarias[rutaId].update({
      fecha: ruta.fecha,
      colegio_id: ruta.colegio_id,
      origen_lat: Number(ruta.origen_lat),
      origen_lng: Number(ruta.origen_lng),
      origen_direccion: ruta.origen_direccion || '',
      modo_optimizacion: ruta.modo_optimizacion,
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
      const pId = p.id || `parada_${p.alumno_id}`;
      transactions.push(
        tx.paradas_ruta[pId].update({
          ruta_id: rutaId,
          alumno_id: p.alumno_id,
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
  await db.transact([
    tx.paradas_ruta[paradaId].update({
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
  const updateData: any = { estado };
  if (extra?.hora_salida_real) updateData.hora_salida_real = extra.hora_salida_real;
  if (extra?.hora_llegada_real) updateData.hora_llegada_real = extra.hora_llegada_real;
  await db.transact([tx.rutas_diarias[rutaId].update(updateData)]);
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
  await db.transact([
    tx.tracking_logs[logId].update({
      ruta_id: rutaId,
      lat: Number(lat),
      lng: Number(lng),
      velocidad_kmh: velocidad !== undefined ? Number(velocidad) : 0,
      rumbo_grados: rumbo !== undefined ? Number(rumbo) : 0,
      timestamp: new Date().toISOString(),
    }),
  ]);
  return logId;
}

