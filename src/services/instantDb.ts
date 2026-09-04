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
  Cliente,
  Colegio,
  Conductor,
  Pago,
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
    clientes: i.entity({
      nombre: i.string(),
      plan: i.string().optional(),   // basico | pro | premium | escolar_*
      activo: i.boolean(),
      created_at: i.string().optional(),
    }),
    colegios: i.entity({
      nombre: i.string(),
      direccion: i.string(),
      lat: i.number(),
      lng: i.number(),
      hora_llegada_limite: i.string(),
      contacto_telefono: i.string().optional(),
      cliente_id: i.string().optional(),
      created_at: i.string().optional(),
    }),
    representantes: i.entity({
      nombre: i.string(),
      telefono_whatsapp: i.string(),
      magic_token: i.string(),
      email: i.string().optional(),
      cliente_id: i.string().optional(),
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
      activo_en_rutas: i.boolean().optional(),
      dias_ruta: i.json().optional(),
      hermano_ids: i.json().optional(),
      cuota_mensual: i.number().optional(),
      cliente_id: i.string().optional(),
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
      cliente_id: i.string().optional(),
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
      dia_semana: i.string().optional(),
      variante: i.string().optional(),
      hora_llegada_objetivo: i.string(),
      hora_salida_estimada: i.string(),
      hora_salida_deseada: i.string().optional(),
      hora_llegada_deseada: i.string().optional(),
      horario_valido: i.boolean().optional(),
      hora_llegada_estimada: i.string().optional(),
      tramos_elegidos_json: i.string().optional(),
      hora_salida_real: i.string().optional(),
      hora_llegada_real: i.string().optional(),
      tiempo_manejo_estimado_min: i.number(),
      tiempo_abordaje_total_min: i.number(),
      tiempo_total_estimado_min: i.number(),
      distancia_total_km: i.number(),
      estado: i.string(),
      tiempo_abordaje_por_alumno_min: i.number(),
      cliente_id: i.string().optional(),
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
      cliente_id: i.string().optional(),
      created_at: i.string().optional(),
    }),
    pagos: i.entity({
      alumno_id: i.string(),
      representante_id: i.string(),
      monto: i.number(),
      fecha_pago: i.string(),
      mes_cobrado: i.string(),
      concepto: i.string(),
      metodo_pago: i.string(),
      estado: i.string(),
      notas: i.string().optional(),
      cliente_id: i.string().optional(),
      created_at: i.string().optional(),
    }),
    tracking_logs: i.entity({
      ruta_id: i.string(),
      lat: i.number(),
      lng: i.number(),
      velocidad_kmh: i.number().optional(),
      rumbo_grados: i.number().optional(),
      cliente_id: i.string().optional(),
      timestamp: i.string(),
    }),
    usuarios: i.entity({
      email: i.string(),
      nombre: i.string(),
      rol: i.string(),             // superadmin | admin | conductor
      cliente_id: i.string().optional(),
      created_at: i.string().optional(),
    }),
    // ===== AUDITORÍA (write-only, NO se consultan desde la app) =====
    eventos_ruta: i.entity({
      evento: i.string(),               // ruta_iniciada | parada_recogida | parada_ausente | parada_revertida | ruta_completada
      ruta_id: i.string(),
      fecha_ruta: i.string().optional(), // YYYY-MM-DD de la ruta
      colegio_id: i.string().optional(),
      colegio_nombre: i.string().optional(),
      conductor_id: i.string().optional(),
      conductor_nombre: i.string().optional(),
      parada_id: i.string().optional(),
      orden_parada: i.number().optional(),
      alumno_id: i.string().optional(),
      alumno_nombre: i.string().optional(),
      estado_anterior: i.string().optional(),
      estado_nuevo: i.string().optional(),
      hora_evento: i.string(),           // ISO 8601 del evento
      detalle_json: i.json().optional(), // payload completo enviado al webhook
      cliente_id: i.string().optional(),
      created_at: i.string().optional(),
    }),
    webhook_logs: i.entity({
      evento: i.string(),
      url_destino: i.string(),
      payload_json: i.string().optional(),
      estado_envio: i.string(),          // pendiente | enviado | fallido
      intentos: i.number().optional(),
      http_status: i.number().optional(),
      duracion_ms: i.number().optional(),
      error_mensaje: i.string().optional(),
      cliente_id: i.string().optional(),
      timestamp: i.string(),             // ISO 8601
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
          activo_en_rutas: alu.activo_en_rutas !== false,
          dias_ruta: alu.dias_ruta || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
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
      ...(multitenantEnabled() ? { cliente_id: colegio.cliente_id || '' } : {}),
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
      ...(multitenantEnabled() ? { cliente_id: rep.cliente_id || '' } : {}),
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
        ...(multitenantEnabled() ? { cliente_id: rep.cliente_id || '' } : {}),
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
      activo_en_rutas: alumno.activo_en_rutas !== false,
      dias_ruta: alumno.dias_ruta || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
      hermano_ids: alumno.hermano_ids || [],
      cuota_mensual: Number(alumno.cuota_mensual || 0),
      ...(multitenantEnabled() ? { cliente_id: alumno.cliente_id || '' } : {}),
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
 * Upsert a payment record in InstantDB
 */
export async function upsertPagoInstant(pago: Pago) {
  const pagoId = ensureUUID(pago.id);
  await db.transact([
    tx.pagos[pagoId].update({
      alumno_id: ensureUUID(pago.alumno_id),
      representante_id: ensureUUID(pago.representante_id),
      monto: Number(pago.monto),
      fecha_pago: pago.fecha_pago,
      mes_cobrado: pago.mes_cobrado,
      concepto: pago.concepto || '',
      metodo_pago: pago.metodo_pago,
      estado: pago.estado,
      notas: pago.notas || '',
      ...(multitenantEnabled() ? { cliente_id: pago.cliente_id || '' } : {}),
      created_at: pago.created_at || new Date().toISOString(),
    }),
  ]);
  return pagoId;
}

/**
 * Delete a payment record from InstantDB
 */
export async function deletePagoInstant(pagoId: string) {
  const safeId = ensureUUID(pagoId);
  await db.transact([tx.pagos[safeId].delete()]);
}

/**
 * Toggle a student's availability for routes (activo_en_rutas)
 */
export async function updateAlumnoActivoRutasInstant(alumnoId: string, activo: boolean) {
  const safeId = ensureUUID(alumnoId);
  await db.transact([
    tx.alumnos[safeId].update({
      activo_en_rutas: activo,
    }),
  ]);
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
      ...(multitenantEnabled() ? { cliente_id: conductor.cliente_id || '' } : {}),
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

// ===========================================================================
// MULTI-TENANT: CLIENTES
// ===========================================================================

/** Cliente raíz: agrupa los datos de la instalación actual (migración v2). */
export const ROOT_CLIENT_ID = 'c0000000-0000-4000-8000-000000000001';
const MIGRATION_KEY = 'rutaescolar_migrated_v2';
const MULTITENANT_KEY = 'rutaescolar_multitenant_enabled';

/**
 * Multi-tenant activado (solo tras configurar el dashboard de InstantDB y
 * habilitarlo). Mientras esté desactivado, los upserts NO envían `cliente_id`,
 * por lo que la instalación actual funciona igual.
 */
export function multitenantEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(MULTITENANT_KEY) === '1';
}
export function setMultitenantEnabled(on: boolean) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(MULTITENANT_KEY, on ? '1' : '0');
}
export function isMigrationDone(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(MIGRATION_KEY) === 'done';
}

// ===========================================================================
// LIMPIEZA DE DATOS DEMO (solo filas que siguen siendo exactamente demo)
// ===========================================================================

interface DemoRecord {
  entity: 'alumnos' | 'conductores' | 'representantes' | 'colegios';
  id: string;
  name: string;
}

// IDs + nombre ORIGINAL de cada dato demo. Solo se elimina una fila si su ID y
// nombre coinciden EXACTAMENTE (una fila editada/renombrada no se toca).
const DEMO_RECORDS: DemoRecord[] = [
  // Alumnos
  { entity: 'alumnos', id: 'e3000000-0000-4000-8000-000000000001', name: 'Mateo Mendoza' },
  { entity: 'alumnos', id: 'e3000000-0000-4000-8000-000000000002', name: 'Camila Silva' },
  { entity: 'alumnos', id: 'e3000000-0000-4000-8000-000000000003', name: 'Santiago Gómez' },
  { entity: 'alumnos', id: 'e3000000-0000-4000-8000-000000000004', name: 'Valeria Rodríguez' },
  { entity: 'alumnos', id: 'e3000000-0000-4000-8000-000000000005', name: 'Lucas Morales' },
  // Conductores
  { entity: 'conductores', id: 'e7000000-0000-4000-8000-000000000001', name: 'Juan Carlos Guamán' },
  { entity: 'conductores', id: 'e7000000-0000-4000-8000-000000000002', name: 'Maritza Villacís' },
  { entity: 'conductores', id: 'e7000000-0000-4000-8000-000000000003', name: 'Segundo Toapanta' },
  // Representantes
  { entity: 'representantes', id: 'e2000000-0000-4000-8000-000000000001', name: 'Carlos Mendoza' },
  { entity: 'representantes', id: 'e2000000-0000-4000-8000-000000000002', name: 'Mariana Silva' },
  { entity: 'representantes', id: 'e2000000-0000-4000-8000-000000000003', name: 'Roberto Gómez' },
  { entity: 'representantes', id: 'e2000000-0000-4000-8000-000000000004', name: 'Elena Rodríguez' },
  { entity: 'representantes', id: 'e2000000-0000-4000-8000-000000000005', name: 'Andrés Morales' },
  // Colegio secundario demo
  { entity: 'colegios', id: 'e1000000-0000-4000-8000-000000000002', name: 'Colegio Americano de Quito' },
];

const DEMO_ROUTE_ID = 'e5000000-0000-4000-8000-000000000001';

/**
 * Elimina SOLO los datos que siguen siendo exactamente demo (mismo id + mismo
 * nombre original). Conserva el usuario admin, el colegio "San Gabriel" y toda
 * fila creada/editada por el usuario. Devuelve la lista de elementos eliminados.
 */
export async function cleanupDemoData(data: any): Promise<string[]> {
  const toList = (raw: any): any[] => (!raw ? [] : Array.isArray(raw) ? raw : Object.values(raw));
  const transactions: any[] = [];
  const removed: string[] = [];

  const norm = (s: string) => String(s || '').trim().toLowerCase();

  for (const entity of ['alumnos', 'conductores', 'representantes', 'colegios'] as const) {
    const rows = toList(data?.[entity]);
    for (const row of rows) {
      const demo = DEMO_RECORDS.find(
        (d) => d.entity === entity && ensureUUID(d.id) === ensureUUID(row.id)
      );
      if (demo && norm(row.nombre) === norm(demo.name)) {
        transactions.push((tx as any)[entity][ensureUUID(row.id)].delete());
        removed.push(`${entity}:${row.nombre}`);
      }
    }
  }

  // Ruta inicial demo + sus paradas (solo si sigue 'planificada')
  const routeRow = toList(data?.rutas_diarias).find(
    (r) => ensureUUID(r.id) === ensureUUID(DEMO_ROUTE_ID)
  );
  if (routeRow && routeRow.estado === 'planificada') {
    transactions.push(tx.rutas_diarias[DEMO_ROUTE_ID].delete());
    removed.push(`rutas_diarias:${routeRow.nombre || routeRow.id}`);
    const demoParadas = toList(data?.paradas_ruta).filter(
      (p) => ensureUUID(p.ruta_id) === ensureUUID(DEMO_ROUTE_ID)
    );
    for (const p of demoParadas) {
      transactions.push(tx.paradas_ruta[ensureUUID(p.id)].delete());
      removed.push(`paradas_ruta:${p.id}`);
    }
  }

  if (transactions.length > 0) {
    await db.transact(transactions);
  }
  return removed;
}

/**
 * Upsert de un cliente (tenant). No borra datos; solo crea/actualiza la fila.
 */
export async function upsertClienteInstant(cliente: Cliente) {
  const cid = ensureUUID(cliente.id);
  await db.transact([
    tx.clientes[cid].update({
      nombre: cliente.nombre,
      plan: cliente.plan || 'basico',
      activo: cliente.activo !== false,
      created_at: cliente.created_at || new Date().toISOString(),
    }),
  ]);
  return cid;
}

/**
 * Baja lógica de un cliente (activo = false). No elimina sus datos.
 */
export async function deactivateClienteInstant(clienteId: string) {
  const cid = ensureUUID(clienteId);
  await db.transact([tx.clientes[cid].update({ activo: false })]);
}

/**
 * Migración NO destructiva a multi-tenant:
 *  - Crea el cliente raíz "Mi Instalación" si no existe.
 *  - Asigna `cliente_id` = raíz a todas las filas existentes que no lo tengan.
 *  - Sube el rol del usuario admin demo a `superadmin`.
 * Solo escribe `cliente_id`/`rol`; no borra ni re-crea ninguna fila.
 * Idempotente (controlada por flag local).
 */
export async function migrateToClientes(data: any): Promise<boolean> {
  try {
    if (!multitenantEnabled()) return false;
    if (typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATION_KEY) === 'done') {
      return true;
    }
    const toList = (raw: any): any[] =>
      !raw ? [] : Array.isArray(raw) ? raw : Object.values(raw);

    const transactions: any[] = [];
    const root = ROOT_CLIENT_ID;

    // 1. Asegurar cliente raíz
    const clientes = toList(data?.clientes);
    if (clientes.length === 0) {
      transactions.push(
        tx.clientes[root].update({
          nombre: 'Mi Instalación',
          plan: 'premium',
          activo: true,
          created_at: new Date().toISOString(),
        })
      );
    } else {
      // Si ya hay clientes, el raíz es el primero que exista
      // (no re-crear; solo asegurar que las filas sin cliente van al primero).
    }

    // 2. Asignar cliente_id raíz a filas existentes sin cliente
    const ENTITIES = [
      'colegios',
      'representantes',
      'alumnos',
      'conductores',
      'rutas_diarias',
      'paradas_ruta',
      'pagos',
      'tracking_logs',
      'usuarios',
      'eventos_ruta',
      'webhook_logs',
    ] as const;

    for (const entity of ENTITIES) {
      const rows = toList(data?.[entity]);
      for (const row of rows) {
        const rowId = ensureUUID(row.id);
        if (!row.cliente_id) {
          (transactions as any[]).push(
            (tx as any)[entity][rowId].update({ cliente_id: root })
          );
        }
      }
    }

    // 3. El usuario admin demo pasa a superadmin
    const adminRow = toList(data?.usuarios).find(
      (u: any) => String(u.email || '').toLowerCase() === 'admin@demo.com'
    );
    if (adminRow) {
      const adminId = ensureUUID(adminRow.id);
      if (adminRow.rol !== 'superadmin' || !adminRow.cliente_id) {
        transactions.push(
          tx.usuarios[adminId].update({
            rol: 'superadmin',
            cliente_id: adminRow.cliente_id || root,
          })
        );
      }
    }

    if (transactions.length > 0) {
      await db.transact(transactions);
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MIGRATION_KEY, 'done');
    }
    return true;
  } catch (err) {
    console.warn('[instantDb] Migración a clientes no completada (se reintentará):', err);
    return false;
  }
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
      dia_semana: ruta.dia_semana || '',
      variante: ruta.variante || '',
      hora_llegada_objetivo: ruta.hora_llegada_objetivo,
      hora_salida_estimada: ruta.hora_salida_estimada,
      hora_salida_deseada: ruta.hora_salida_deseada || '',
      hora_llegada_deseada: ruta.hora_llegada_deseada || '',
      horario_valido: ruta.horario_valido !== false,
      hora_llegada_estimada: ruta.hora_llegada_estimada || '',
      tramos_elegidos_json: JSON.stringify(ruta.tramos_elegidos || {}),
      hora_salida_real: ruta.hora_salida_real || '',
      hora_llegada_real: ruta.hora_llegada_real || '',
      tiempo_manejo_estimado_min: Number(ruta.tiempo_manejo_estimado_min || 0),
      tiempo_abordaje_total_min: Number(ruta.tiempo_abordaje_total_min || 0),
      tiempo_total_estimado_min: Number(ruta.tiempo_total_estimado_min || 0),
      distancia_total_km: Number(ruta.distancia_total_km || 0),
      estado: ruta.estado,
      tiempo_abordaje_por_alumno_min: Number(ruta.tiempo_abordaje_por_alumno_min || 2.5),
      ...(multitenantEnabled() ? { cliente_id: ruta.cliente_id || '' } : {}),
      created_at: ruta.created_at || new Date().toISOString(),
      polyline_json: JSON.stringify(ruta.polyline_geometry || []),
      // Ruta combinada (ida + vuelta en un mismo registro): snapshot completo de cada
      // jornada (estado, horas reales, paradas) para que TODOS los dispositivos/sesiones
      // puedan reconstruir el progreso exacto en tiempo real, no solo el que lo generó.
      ida_json: ruta.ida ? JSON.stringify(ruta.ida) : '',
      vuelta_json: ruta.vuelta ? JSON.stringify(ruta.vuelta) : '',
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
          ...(multitenantEnabled() ? { cliente_id: ruta.cliente_id || '' } : {}),
          created_at: new Date().toISOString(),
        })
      );
    }
  }

  await db.transact(transactions);
  return rutaId;
}

/**
 * Delete a daily route and all of its stops from InstantDB (cloud-wide — reflected on
 * every session/device, since the route history is read live from this same data).
 * `data` is the already-fetched live query result (e.g. from App.tsx's useQuery), used
 * to find the route's `paradas_ruta` rows to delete along with it.
 */
export async function deleteRutaInstant(rutaId: string, data?: any) {
  const safeId = ensureUUID(rutaId);
  const toList = (raw: any): any[] => (!raw ? [] : Array.isArray(raw) ? raw : Object.values(raw));
  const paradas = toList(data?.paradas_ruta).filter((p) => p && ensureUUID(p.ruta_id) === safeId);

  const transactions: any[] = [tx.rutas_diarias[safeId].delete()];
  for (const p of paradas) {
    transactions.push(tx.paradas_ruta[ensureUUID(p.id)].delete());
  }
  await db.transact(transactions);
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
  rumbo?: number,
  clienteId?: string
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
      ...(multitenantEnabled() ? { cliente_id: clienteId || '' } : {}),
      timestamp: new Date().toISOString(),
    }),
  ]);
  return logId;
}

// ===========================================================================
// AUDITORÍA (write-only): eventos de ejecución de rutas y envíos al webhook.
// Estas entidades NO se incluyen en db.useQuery de App.tsx, por lo que nunca
// se muestran en la interfaz. Solo sirven como registro/auditoría en la nube.
// ===========================================================================

export interface EventoRutaRegistro {
  evento: string;
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
  hora_evento: string; // ISO 8601
  detalle_json?: any;  // payload completo enviado al webhook
  cliente_id?: string;
}

/**
 * Registra un evento de ejecución de ruta en la entidad `eventos_ruta`.
 */
export async function logEventoRutaInstant(registro: EventoRutaRegistro) {
  const logId = id();
  const safeRutaId = ensureUUID(registro.ruta_id);
  await db.transact([
    tx.eventos_ruta[logId].update({
      evento: registro.evento,
      ruta_id: safeRutaId,
      fecha_ruta: registro.fecha_ruta || '',
      colegio_id: registro.colegio_id ? ensureUUID(registro.colegio_id) : '',
      colegio_nombre: registro.colegio_nombre || '',
      conductor_id: registro.conductor_id ? ensureUUID(registro.conductor_id) : '',
      conductor_nombre: registro.conductor_nombre || '',
      parada_id: registro.parada_id ? ensureUUID(registro.parada_id) : '',
      orden_parada: registro.orden_parada !== undefined ? Number(registro.orden_parada) : 0,
      alumno_id: registro.alumno_id ? ensureUUID(registro.alumno_id) : '',
      alumno_nombre: registro.alumno_nombre || '',
      estado_anterior: registro.estado_anterior || '',
      estado_nuevo: registro.estado_nuevo || '',
      hora_evento: registro.hora_evento,
      detalle_json: registro.detalle_json ?? {},
      ...(multitenantEnabled() ? { cliente_id: registro.cliente_id || '' } : {}),
      created_at: new Date().toISOString(),
    }),
  ]);
  return logId;
}

/**
 * Crea un registro de envío a webhook (estado inicial `pendiente`).
 * Devuelve el id para poder actualizarlo con el resultado del POST.
 */
export async function createWebhookLogInstant(registro: {
  evento: string;
  url_destino: string;
  payload_json?: string;
  cliente_id?: string;
}) {
  const logId = id();
  await db.transact([
    tx.webhook_logs[logId].update({
      evento: registro.evento,
      url_destino: registro.url_destino,
      payload_json: registro.payload_json || '',
      estado_envio: 'pendiente',
      intentos: 0,
      ...(multitenantEnabled() ? { cliente_id: registro.cliente_id || '' } : {}),
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }),
  ]);
  return logId;
}

/**
 * Actualiza el resultado de un envío a webhook (estado, intentos, HTTP status...).
 * Solo sobrescribe los campos proporcionados.
 */
export async function updateWebhookLogInstant(
  logId: string,
  resultado: {
    estado_envio: 'pendiente' | 'enviado' | 'fallido';
    intentos?: number;
    http_status?: number;
    duracion_ms?: number;
    error_mensaje?: string;
  }
) {
  const updateData: Record<string, any> = { estado_envio: resultado.estado_envio };
  if (resultado.intentos !== undefined) updateData.intentos = Number(resultado.intentos);
  if (resultado.http_status !== undefined) updateData.http_status = Number(resultado.http_status);
  if (resultado.duracion_ms !== undefined) updateData.duracion_ms = Number(resultado.duracion_ms);
  if (resultado.error_mensaje !== undefined) updateData.error_mensaje = String(resultado.error_mensaje).slice(0, 500);
  await db.transact([tx.webhook_logs[ensureUUID(logId)].update(updateData)]);
}

