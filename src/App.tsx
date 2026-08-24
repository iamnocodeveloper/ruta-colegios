/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { LogOut } from 'lucide-react';
import {
  Alumno,
  Cliente,
  Colegio,
  Conductor,
  ParadaRuta,
  Representante,
  RutaDiaria
} from './types';
import {
  INITIAL_DRIVER_ORIGIN
} from './services/mockData';
import { calculateOptimizedRoute, normalizeDays } from './services/routeCalculator';
import { DriverPanelSimple } from './components/Driver/DriverPanelSimple';
import { RouteHistory } from './components/Admin/RouteHistory';
import { RouteReviewView } from './components/Admin/RouteReviewView';
import {
  getRouteHistory,
  saveRouteToHistory,
  deleteRouteHistory,
  getRouteHistoryById,
  RouteHistoryEntry
} from './services/routeHistory';
import {
  getJourney,
  getJourneyByParadaId,
  hasJourney,
  journeyView,
  updateJourney
} from './services/routeJourneys';
import { ParentPortal } from './components/Parent/ParentPortal';
import { RoutePlanner } from './components/Admin/RoutePlanner';
import { StudentManager } from './components/Admin/StudentManager';
import { SchoolManager } from './components/Admin/SchoolManager';
import { DriverManager } from './components/Admin/DriverManager';
import { SqlSchemaViewer } from './components/Admin/SqlSchemaViewer';
import { ClientManager } from './components/Admin/ClientManager';
import type { CsvAlumnoRow } from './services/clientCsvImport';
import { PWAInstallBanner } from './components/PWA/PWAInstallBanner';
import { PWAUpdateBanner } from './components/PWA/PWAUpdateBanner';
import { HomeDashboard } from './components/Home/HomeDashboard';
import { AppSidebar, StaffView } from './components/Layout/AppSidebar';
import { AppHeader } from './components/Layout/AppHeader';
import {
  db,
  INSTANT_APP_ID,
  upsertAlumnoInstant,
  deleteAlumnoInstant,
  upsertColegioInstant,
  deleteColegioInstant,
  upsertConductorInstant,
  deleteConductorInstant,
  updateAlumnoActivoRutasInstant,
  saveRutaInstant,
  updateParadaEstadoInstant,
  updateRutaEstadoInstant,
  ensureUUID,
  ROOT_CLIENT_ID,
  multitenantEnabled,
  setMultitenantEnabled,
  isMigrationDone,
  migrateToClientes,
  upsertClienteInstant,
  deactivateClienteInstant,
  cleanupDemoData
} from './services/instantDb';
import {
  notifyRutaIniciada,
  notifyParadaActualizada,
  notifyRutaCompletada
} from './services/webhookNotifier';
import { InstantAuthModal } from './components/Auth/InstantAuthModal';
import { InstantSyncBadge } from './components/Auth/InstantSyncBadge';
import { LoginGateway } from './components/Auth/LoginGateway';

export interface StaffSessionUser {
  email: string;
  rol: string;
  nombre: string;
  clienteId?: string;
  conductorId?: string;
}

export type AuthSession =
  | { type: 'staff'; user: StaffSessionUser }
  | { type: 'parent'; studentId: string }
  | null;

const STAFF_VIEWS: StaffView[] = ['home', 'driver', 'parent', 'planner', 'students', 'schools', 'drivers', 'sql', 'history', 'review', 'clientes'];

/** Normaliza el resultado de db.useQuery a un array (puede venir como objeto keyed por id). */
function toList(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.values(raw);
}

/** Colegio placeholder NEUTRO (sin datos de ejemplo). */
const NEUTRAL_COLEGIO: Colegio = {
  id: '',
  nombre: '',
  direccion: '',
  lat: -0.1872,
  lng: -78.4975,
  hora_llegada_limite: '07:45:00',
};

/**
 * Construye una RouteHistoryEntry leyendo una ruta desde los datos de InstantDB.
 * Permite que el enlace de revisión funcione SIN login y en cualquier dispositivo.
 */
function buildReviewEntryFromCloud(routeId: string, data: any): RouteHistoryEntry | null {
  const rutaId = ensureUUID(routeId);
  const rutaRow = toList(data?.rutas_diarias).find((r) => ensureUUID(r.id) === rutaId);
  if (!rutaRow) return null;

  const colegioRow = toList(data?.colegios).find((c) => ensureUUID(c.id) === ensureUUID(rutaRow.colegio_id)) || null;
  const conductorRow = toList(data?.conductores).find((c) => ensureUUID(c.id) === ensureUUID(rutaRow.conductor_id)) || null;
  const reps = toList(data?.representantes);

  const paradas: ParadaRuta[] = toList(data?.paradas_ruta)
    .filter((p) => ensureUUID(p.ruta_id) === rutaId)
    .sort((a, b) => Number(a.orden) - Number(b.orden))
    .map((p) => {
      const alu = toList(data?.alumnos).find((a) => ensureUUID(a.id) === ensureUUID(p.alumno_id));
      const rep = alu ? reps.find((r) => ensureUUID(r.id) === ensureUUID(alu.representante_id)) : null;
      return {
        id: ensureUUID(p.id),
        ruta_id: rutaId,
        alumno_id: ensureUUID(p.alumno_id),
        orden: Number(p.orden) || 1,
        hora_estimada: p.hora_estimada || '07:00:00',
        hora_real: p.hora_real || undefined,
        estado: (p.estado as any) || 'pendiente',
        lat: Number(p.lat) || 0,
        lng: Number(p.lng) || 0,
        distancia_desde_anterior_km: Number(p.distancia_desde_anterior_km || 0),
        tiempo_desde_anterior_min: Number(p.tiempo_desde_anterior_min || 0),
        alumno: alu
          ? {
              id: ensureUUID(alu.id),
              nombre: alu.nombre || 'Estudiante',
              colegio_id: ensureUUID(alu.colegio_id || rutaRow.colegio_id || ''),
              representante_id: ensureUUID(alu.representante_id || ''),
              direccion_recogida: alu.direccion_recogida || '',
              lat: Number(alu.lat) || 0,
              lng: Number(alu.lng) || 0,
              grado: alu.grado || '',
              notas_medicas: alu.notas_medicas || '',
              modalidad_servicio: (alu.modalidad_servicio as any) || 'ida_y_vuelta',
              activo_en_rutas: alu.activo_en_rutas !== false,
              representante: rep
                ? {
                    id: ensureUUID(rep.id),
                    nombre: rep.nombre || '',
                    telefono_whatsapp: rep.telefono_whatsapp || '',
                    magic_token: rep.magic_token || '',
                  }
                : undefined,
            }
          : undefined,
      };
    });

  let polyline: [number, number][] = [];
  try {
    const parsed = JSON.parse(rutaRow.polyline_json || '[]');
    if (Array.isArray(parsed)) polyline = parsed;
  } catch {}

  const colegio: Colegio | undefined = colegioRow
    ? {
        id: ensureUUID(colegioRow.id),
        nombre: colegioRow.nombre || 'Colegio',
        direccion: colegioRow.direccion || '',
        lat: Number(colegioRow.lat) || 0,
        lng: Number(colegioRow.lng) || 0,
        hora_llegada_limite: colegioRow.hora_llegada_limite || '07:45:00',
        contacto_telefono: colegioRow.contacto_telefono || '',
      }
    : undefined;

  const conductor: Conductor | undefined = conductorRow
    ? {
        id: ensureUUID(conductorRow.id),
        nombre: conductorRow.nombre || 'Conductor',
        telefono: conductorRow.telefono || '',
        vehiculo_modelo: conductorRow.vehiculo_modelo || '',
        vehiculo_placa: conductorRow.vehiculo_placa || '',
        capacidad_pasajeros: Number(conductorRow.capacidad_pasajeros || 0),
        activo: conductorRow.activo !== false,
      }
    : undefined;

  const ruta: RutaDiaria = {
    id: rutaId,
    fecha: rutaRow.fecha || new Date().toISOString().substring(0, 10),
    colegio_id: ensureUUID(rutaRow.colegio_id || ''),
    origen_lat: Number(rutaRow.origen_lat) || 0,
    origen_lng: Number(rutaRow.origen_lng) || 0,
    origen_direccion: rutaRow.origen_direccion || '',
    modo_optimizacion: (rutaRow.modo_optimizacion as any) || 'fijo',
    tipo_trayecto: (rutaRow.tipo_trayecto as any) || 'ida',
    dia_semana: rutaRow.dia_semana || undefined,
    variante: rutaRow.variante || undefined,
    hora_llegada_objetivo: rutaRow.hora_llegada_objetivo || '',
    hora_salida_estimada: rutaRow.hora_salida_estimada || '',
    hora_salida_real: rutaRow.hora_salida_real || undefined,
    hora_llegada_real: rutaRow.hora_llegada_real || undefined,
    tiempo_manejo_estimado_min: Number(rutaRow.tiempo_manejo_estimado_min || 0),
    tiempo_abordaje_total_min: Number(rutaRow.tiempo_abordaje_total_min || 0),
    tiempo_total_estimado_min: Number(rutaRow.tiempo_total_estimado_min || 0),
    distancia_total_km: Number(rutaRow.distancia_total_km || 0),
    estado: (rutaRow.estado as any) || 'planificada',
    tiempo_abordaje_por_alumno_min: Number(rutaRow.tiempo_abordaje_por_alumno_min || 2.5),
    created_at: rutaRow.created_at,
    colegio,
    conductor,
    conductor_id: conductor?.id,
    paradas,
    polyline_geometry: polyline,
  };

  return {
    id: ruta.id,
    fecha: ruta.fecha,
    colegio_nombre: colegio?.nombre || 'Colegio',
    conductor_nombre: conductor?.nombre || 'Sin conductor',
    conductor_id: conductor?.id,
    estado: ruta.estado,
    hora_salida_estimada: ruta.hora_salida_estimada,
    hora_llegada_objetivo: ruta.hora_llegada_objetivo,
    distancia_total_km: ruta.distancia_total_km,
    tiempo_total_estimado_min: ruta.tiempo_total_estimado_min,
    total_paradas: paradas.length,
    recogidos: paradas.filter((p) => p.estado === 'recogido' || p.estado === 'completado').length,
    ausentes: paradas.filter((p) => p.estado === 'ausente').length,
    modo_optimizacion: ruta.modo_optimizacion,
    tipo_trayecto: ruta.tipo_trayecto || 'ida',
    dia_semana: ruta.dia_semana,
    variante: ruta.variante,
    created_at: ruta.created_at || new Date().toISOString(),
    ruta,
  };
}

export default function App() {
  // Navigation State (vista inicial desde URL para que el link de revisión
  // renderice directo, SIN pasar por el login)
  const [currentView, setCurrentView] = useState<StaffView>(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('view');
      if (v && STAFF_VIEWS.includes(v as StaffView)) return v as StaffView;
    } catch {}
    return 'home';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentDriverId, setCurrentDriverId] = useState<string>('d1000000-0000-4000-8000-000000000001');

  // Route History State (el enlace de revisión carga desde historial local o nube)
  const [routeHistory, setRouteHistory] = useState<RouteHistoryEntry[]>(() => getRouteHistory());
  const [reviewEntry, setReviewEntry] = useState<RouteHistoryEntry | null>(() => {
    try {
      const u = new URLSearchParams(window.location.search);
      const routeId = u.get('routeId');
      if (u.get('view') === 'review' && routeId) {
        return getRouteHistoryById(routeId) || null;
      }
    } catch {}
    return null;
  });
  const [reviewLoading, setReviewLoading] = useState<boolean>(() => {
    try {
      const u = new URLSearchParams(window.location.search);
      if (u.get('view') === 'review' && u.get('routeId')) {
        // Si no hay entrada local, queda en loading mientras intenta cargar de la nube
        return !getRouteHistoryById(u.get('routeId')!);
      }
    } catch {}
    return false;
  });

  // Authentication Session (Mandatory Login Gate)
  const [authSession, setAuthSession] = useState<AuthSession>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const studentParam = urlParams.get('student');
      if (studentParam) {
        return { type: 'parent', studentId: studentParam };
      }
      const savedStaff = localStorage.getItem('rutaescolar_staff_session');
      if (savedStaff) {
        return { type: 'staff', user: JSON.parse(savedStaff) };
      }
      const savedParent = localStorage.getItem('rutaescolar_parent_student_id');
      if (savedParent) {
        return { type: 'parent', studentId: savedParent };
      }
      return null;
    } catch {
      return null;
    }
  });

  const [demoUser, setDemoUser] = useState<{ email: string; rol: string; nombre: string } | null>(() => {
    try {
      const saved = localStorage.getItem('rutaescolar_demo_user');
      return saved ? JSON.parse(saved) : { email: 'admin@demo.com', rol: 'admin', nombre: 'Administrador Demo' };
    } catch {
      return { email: 'admin@demo.com', rol: 'admin', nombre: 'Administrador Demo' };
    }
  });

  // Cliente que el superadmin está gestionando (multi-tenant)
  const [manageClienteId, setManageClienteId] = useState<string>(ROOT_CLIENT_ID);

  // Alcance por cliente: superadmin gestiona `manageClienteId`; admin/conductor solo el suyo.
  // El filtro SOLO aplica si multi-cliente está activo Y la migración se completó
  // (evita ocultar datos reales si el dashboard de InstantDB no está configurado).
  const sessionRol = authSession?.type === 'staff' ? authSession.user.rol : '';
  const isSuperadmin = sessionRol === 'superadmin';
  const mtActive = multitenantEnabled() && isMigrationDone();
  const scopeClienteId =
    mtActive && authSession?.type === 'staff'
      ? isSuperadmin
        ? manageClienteId
        : authSession.user.clienteId
      : undefined;

  // 1. InstantDB Live Real-Time Query (filtrada por cliente cuando multi-tenant está activo)
  const query = useMemo(() => {
    const ent = (withScope: boolean) => (withScope ? { $: { where: { cliente_id: scopeClienteId } } } : {});
    const hasScope = !!scopeClienteId;
    const q: any = {
      colegios: ent(hasScope),
      representantes: ent(hasScope),
      alumnos: ent(hasScope),
      conductores: ent(hasScope),
      rutas_diarias: ent(hasScope),
      paradas_ruta: ent(hasScope),
      tracking_logs: ent(hasScope),
      usuarios: {}, // globales (resolución de login / superadmin)
    };
    if (mtActive) q.clientes = {};
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeClienteId, mtActive]);
  const { data: instantData, isLoading: instantLoading } = (db as any).useQuery(query);

  // Migración a multi-tenant (solo escribe cliente_id; idempotente)
  useEffect(() => {
    if (multitenantEnabled() && !instantLoading && instantData) {
      migrateToClientes(instantData).then((ok) => {
        if (ok) console.log('[multi-tenant] Migración a clientes aplicada.');
      });
    }
  }, [instantLoading, instantData]);

  // Automatically seed or migrate InstantDB & LocalStorage to Quito, Ecuador
  useEffect(() => {
    // Check if local storage has outdated Caracas data
    try {
      const savedOrigen = localStorage.getItem('rutaescolar_origen');
      if (savedOrigen) {
        const parsed = JSON.parse(savedOrigen);
        if (parsed.lat > 5 || parsed.direccion?.includes('Caracas') || parsed.direccion?.includes('Chaguaramos')) {
          localStorage.removeItem('rutaescolar_origen');
          localStorage.removeItem('rutaescolar_colegios');
          localStorage.removeItem('rutaescolar_alumnos');
          localStorage.removeItem('rutaescolar_representantes');
          localStorage.removeItem('rutaescolar_rutas');
          setOrigen(INITIAL_DRIVER_ORIGIN);
        }
      }
    } catch (e) {
      console.warn('Error checking local storage migration', e);
    }

    if (!instantLoading && instantData) {
      const rawCols: any[] = Array.isArray(instantData.colegios)
        ? instantData.colegios
        : Object.values(instantData.colegios || {});

      const isOldCaracasData =
        rawCols.length > 0 &&
        (Number(rawCols[0]?.lat) > 5 ||
          rawCols[0]?.direccion?.includes('Caracas') ||
          rawCols[0]?.direccion?.includes('Venezuela'));

      // NUNCA se generan datos demo automáticamente. Solo se siembran si el dueño
      // lo solicita explícitamente (botón de seed con confirmación).
      if (isOldCaracasData) {
        console.log('[InstantDB] Datos legacy de Caracas detectados (no se re-siembra automáticamente).');
      }
    }
  }, [instantLoading, instantData]);

  // Transform InstantDB entities or fallback to local
  const colegios: Colegio[] = useMemo(() => {
    const raw = instantData?.colegios;
    let list: any[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === 'object') {
      list = Object.entries(raw).map(([k, v]: [string, any]) => ({ id: v?.id || k, ...v }));
    }

    if (list.length > 0) {
      return list.map((col: any) => ({
        id: ensureUUID(col.id),
        nombre: col.nombre || 'Colegio',
        direccion: col.direccion || '',
        lat: Number(col.lat) || -0.1872,
        lng: Number(col.lng) || -78.4975,
        hora_llegada_limite: col.hora_llegada_limite || '07:45:00',
        contacto_telefono: col.contacto_telefono || '',
        cliente_id: col.cliente_id || undefined,
        created_at: col.created_at
      }));
    }
    try {
      const saved = localStorage.getItem('rutaescolar_colegios');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [instantData?.colegios]);

  const [selectedColegioId, setSelectedColegioId] = useState<string>('');
  const selectedColegio = useMemo(() => {
    return colegios.find((c) => c.id === selectedColegioId) || colegios[0] || NEUTRAL_COLEGIO;
  }, [colegios, selectedColegioId]);

  const representantes: Representante[] = useMemo(() => {
    const raw = instantData?.representantes;
    let list: any[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === 'object') {
      list = Object.entries(raw).map(([k, v]: [string, any]) => ({ id: v?.id || k, ...v }));
    }

    if (list.length > 0) {
      return list.map((rep: any) => ({
        id: String(rep.id),
        nombre: rep.nombre || 'Representante',
        telefono_whatsapp: rep.telefono_whatsapp || '',
        magic_token: rep.magic_token || `tok-${rep.id}`,
        email: rep.email || '',
        cliente_id: rep.cliente_id || undefined,
        created_at: rep.created_at
      }));
    }
    try {
      const saved = localStorage.getItem('rutaescolar_representantes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [instantData?.representantes]);

  const repsMap = useMemo(() => {
    const map = new Map<string, Representante>();
    representantes.forEach((r) => map.set(r.id, r));
    return map;
  }, [representantes]);

  const colegiosMap = useMemo(() => {
    const map = new Map<string, Colegio>();
    colegios.forEach((c) => map.set(c.id, c));
    return map;
  }, [colegios]);

  // Local override for quick UI feedback when toggling activo_en_rutas / saving students
  // Stores full student snapshots keyed by id (modalidad, dias_ruta, activo, etc.)
  const [alumnosOverride, setAlumnosOverride] = useState<Record<string, Partial<Alumno>> | null>(null);

  const alumnos: Alumno[] = useMemo(() => {
    const raw = instantData?.alumnos;
    let list: any[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === 'object') {
      list = Object.entries(raw).map(([k, v]: [string, any]) => ({ id: v?.id || k, ...v }));
    }

    if (list.length > 0) {
      return list.map((alu: any) => {
        const aluId = String(alu.id);
        const colId = String(alu.colegio_id);
        const repId = String(alu.representante_id);
        const override = alumnosOverride?.[aluId];
        return {
          id: aluId,
          nombre: alu.nombre || 'Estudiante',
          colegio_id: colId,
          representante_id: repId,
          direccion_recogida: alu.direccion_recogida || '',
          lat: Number(alu.lat) || -0.1810,
          lng: Number(alu.lng) || -78.4795,
          grado: alu.grado || '',
          notas_medicas: alu.notas_medicas || '',
          tiempo_abordaje_estimado_min: Number(alu.tiempo_abordaje_estimado_min || 2.5),
          // Apply local override (instant UI feedback) if present, else read from DB
          modalidad_servicio: override?.modalidad_servicio || alu.modalidad_servicio || 'ida_y_vuelta',
          activo_en_rutas: override?.activo_en_rutas ?? alu.activo_en_rutas !== false,
          dias_ruta: override?.dias_ruta || normalizeDays(alu.dias_ruta),
          cliente_id: alu.cliente_id || undefined,
          created_at: alu.created_at,
          colegio: colegiosMap.get(colId) || selectedColegio,
          representante: repsMap.get(repId)
        };
      });
    }
    try {
      const saved = localStorage.getItem('rutaescolar_alumnos');
      if (saved) {
        const parsed = JSON.parse(saved) as Alumno[];
        // Apply override to localStorage-loaded students too
        if (alumnosOverride) {
          return parsed.map((a) => ({
            ...a,
            modalidad_servicio: alumnosOverride[a.id]?.modalidad_servicio || a.modalidad_servicio || 'ida_y_vuelta',
            activo_en_rutas: alumnosOverride[a.id]?.activo_en_rutas ?? a.activo_en_rutas !== false,
            dias_ruta: alumnosOverride[a.id]?.dias_ruta || normalizeDays(a.dias_ruta),
          }));
        }
        return parsed.map((a) => ({
          ...a,
          dias_ruta: normalizeDays(a.dias_ruta),
          modalidad_servicio: a.modalidad_servicio || 'ida_y_vuelta',
        }));
      }
      return [];
    } catch {
      return [];
    }
  }, [instantData?.alumnos, colegiosMap, repsMap, selectedColegio, alumnosOverride]);

  const conductores: Conductor[] = useMemo(() => {
    const raw = instantData?.conductores;
    let list: any[] = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === 'object') {
      list = Object.entries(raw).map(([k, v]: [string, any]) => ({ id: v?.id || k, ...v }));
    }

    if (list.length > 0) {
      return list.map((cond: any) => ({
        id: ensureUUID(cond.id),
        nombre: cond.nombre || 'Conductor',
        telefono: cond.telefono || '',
        email: cond.email || '',
        licencia: cond.licencia || 'Tipo E Profesional',
        vehiculo_modelo: cond.vehiculo_modelo || 'Buseta Escolar',
        vehiculo_placa: cond.vehiculo_placa || '',
        capacidad_pasajeros: Number(cond.capacidad_pasajeros || 16),
        activo: cond.activo !== false,
        foto_url: cond.foto_url || '',
        cliente_id: cond.cliente_id || undefined,
        created_at: cond.created_at
      }));
    }
    try {
      const saved = localStorage.getItem('rutaescolar_conductores');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, [instantData?.conductores]);

  const [origen, setOrigen] = useState(() => {
    try {
      const saved = localStorage.getItem('rutaescolar_origen');
      return saved ? JSON.parse(saved) : INITIAL_DRIVER_ORIGIN;
    } catch {
      return INITIAL_DRIVER_ORIGIN;
    }
  });

  const [selectedParentStudentId, setSelectedParentStudentId] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const studentParam = urlParams.get('student');
      if (studentParam) return studentParam;
      const saved = localStorage.getItem('rutaescolar_parent_student_id');
      return saved || '';
    } catch {
      return '';
    }
  });

  // Active Daily Route with LocalStorage Persistence
  const [activeRuta, setActiveRuta] = useState<RutaDiaria>(() => {
    try {
      const saved = localStorage.getItem('rutaescolar_active_ruta');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.paradas) && parsed.paradas.length > 0) {
          return parsed;
        }
      }
    } catch {}
    // Estado por defecto NEUTRO (sin datos de ejemplo)
    return {
      id: ensureUUID(),
      fecha: new Date().toISOString().substring(0, 10),
      colegio_id: selectedColegio.id,
      colegio: selectedColegio,
      conductor_id: undefined,
      conductor: undefined,
      origen_lat: origen.lat,
      origen_lng: origen.lng,
      origen_direccion: origen.direccion,
      modo_optimizacion: 'fijo',
      hora_llegada_objetivo: selectedColegio.hora_llegada_limite || '07:45:00',
      hora_salida_estimada: '',
      tiempo_manejo_estimado_min: 0,
      tiempo_abordaje_total_min: 0,
      tiempo_total_estimado_min: 0,
      distancia_total_km: 0,
      tiempo_abordaje_por_alumno_min: 2.5,
      estado: 'planificada',
      paradas: []
    };
  });

  // Map for fast O(1) student lookup
  const alumnosMap = useMemo(() => {
    const map = new Map<string, Alumno>();
    alumnos.forEach((a) => map.set(a.id, a));
    return map;
  }, [alumnos]);

  // Students belonging to current selected school (or all if not specified)
  const schoolAlumnos = useMemo(() => {
    const list = alumnos.filter((a) => !a.colegio_id || a.colegio_id === selectedColegio.id);
    return list.length > 0 ? list : alumnos;
  }, [alumnos, selectedColegio.id]);

  // Helper to re-sync active route with all real registered students
  const handleSyncAllStudentsToRoute = async (targetStudentsList?: Alumno[]) => {
    // Rutas combinadas (ida + vuelta) ya tienen sus jornadas definidas: no recalcular
    if (hasJourney(activeRuta)) return;
    const listToUse = targetStudentsList || schoolAlumnos;
    if (listToUse.length === 0) return;

    try {
      const res = await calculateOptimizedRoute(origen, selectedColegio, listToUse, {
        modo: activeRuta.modo_optimizacion || 'fijo',
        tiempoAbordajeMin: activeRuta.tiempo_abordaje_por_alumno_min || 2.5,
        horaLlegadaLimite: activeRuta.hora_llegada_objetivo || selectedColegio.hora_llegada_limite,
        tipoTrayecto: activeRuta.tipo_trayecto || 'ida'
      });

      const newParadas: ParadaRuta[] = res.paradas_ordenadas.map((p) => ({
        id: ensureUUID(),
        ruta_id: ensureUUID(activeRuta.id),
        alumno_id: ensureUUID(p.alumno_id),
        orden: p.orden,
        hora_estimada: p.hora_estimada,
        estado: 'pendiente' as const,
        lat: p.lat,
        lng: p.lng,
        distancia_desde_anterior_km: p.distancia_desde_anterior_km,
        tiempo_desde_anterior_min: p.tiempo_desde_anterior_min,
        alumno: alumnosMap.get(p.alumno_id)
      }));

      const updatedRuta: RutaDiaria = {
        ...activeRuta,
        colegio_id: selectedColegio.id,
        colegio: selectedColegio,
        hora_salida_estimada: res.hora_salida_estimada,
        tiempo_manejo_estimado_min: res.tiempo_manejo_min,
        tiempo_abordaje_total_min: res.tiempo_abordaje_total_min,
        tiempo_total_estimado_min: res.tiempo_total_min,
        distancia_total_km: res.distancia_total_km,
        estado: 'planificada',
        hora_salida_real: undefined,
        hora_llegada_real: undefined,
        paradas: newParadas,
        polyline_geometry: res.polyline_geometry
      };

      setActiveRuta(updatedRuta);
      try {
        localStorage.setItem('rutaescolar_active_ruta', JSON.stringify(updatedRuta));
        await saveRutaInstant(updatedRuta);
      } catch (err) {
        console.warn('Sync save warning:', err);
      }
      return updatedRuta;
    } catch (err) {
      console.error('Error synchronizing students to route:', err);
    }
  };

  // Sync InstantDB Paradas / Rutas into activeRuta state in real time
  useEffect(() => {
    // Rutas combinadas conservan sus jornadas localmente (integridad de ida/vuelta)
    if (hasJourney(activeRuta)) return;
    if (instantData?.paradas_ruta && Object.keys(instantData.paradas_ruta).length > 0) {
      const matchingParadas = Object.entries(instantData.paradas_ruta)
        .filter(([_, p]: [string, any]) => p && p.ruta_id === activeRuta.id)
        .map(([id, p]: [string, any]) => ({
          id: ensureUUID(id),
          ruta_id: ensureUUID(p.ruta_id),
          alumno_id: ensureUUID(p.alumno_id),
          orden: Number(p.orden) || 1,
          hora_estimada: p.hora_estimada || '07:00:00',
          hora_real: p.hora_real,
          estado: (p.estado as any) || 'pendiente',
          lat: Number(p.lat) || -0.18,
          lng: Number(p.lng) || -78.48,
          distancia_desde_anterior_km: Number(p.distancia_desde_anterior_km || 0),
          tiempo_desde_anterior_min: Number(p.tiempo_desde_anterior_min || 0),
          alumno: alumnosMap.get(p.alumno_id)
        }))
        .filter((p) => p.alumno_id && alumnosMap.has(p.alumno_id))
        .sort((a, b) => a.orden - b.orden);

      // Only update if valid matching paradas exist
      if (matchingParadas.length > 0 && matchingParadas.length === activeRuta.paradas.length) {
        setActiveRuta((prev) => {
          const updated = { ...prev, paradas: matchingParadas };
          try {
            localStorage.setItem('rutaescolar_active_ruta', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    }
  }, [instantData?.paradas_ruta, activeRuta.id, alumnosMap]);

  // Initial Route Calculation & Auto-Sync with Real Students
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const magic = urlParams.get('magic');
    const studentParam = urlParams.get('student');
    const viewParam = urlParams.get('view');
    const routeIdParam = urlParams.get('routeId');

    if (routeIdParam && viewParam === 'review') {
      // Read-only review link: load the route from history (works without login).
      // Si no está en local, se intentará cargar desde la nube (efecto aparte).
      const entry = getRouteHistoryById(routeIdParam);
      setReviewEntry(entry || null);
      setCurrentView('review');
      if (entry) setReviewLoading(false);
      return;
    }

    if (magic || studentParam) {
      if (studentParam && alumnosMap.has(studentParam)) {
        setSelectedParentStudentId(studentParam);
      } else if (magic) {
        const foundRep = representantes.find((r) => r.magic_token === magic);
        if (foundRep) {
          const foundStudent = alumnos.find((a) => a.representante_id === foundRep.id);
          if (foundStudent) setSelectedParentStudentId(foundStudent.id);
        }
      }
      setCurrentView('parent');
    } else if (viewParam) {
      const allowed: StaffView[] = ['home', 'driver', 'planner', 'students', 'schools', 'drivers', 'sql', 'parent'];
      if (allowed.includes(viewParam as StaffView)) {
        setCurrentView(viewParam as StaffView);
      }
    }

    // Auto calculate route when students are loaded and paradas are missing or mismatch
    if (schoolAlumnos.length > 0 && (activeRuta.paradas.length === 0 || activeRuta.paradas.length !== schoolAlumnos.length)) {
      handleSyncAllStudentsToRoute(schoolAlumnos);
    }
  }, [schoolAlumnos.length, selectedColegio.id]);

  // REVIEW LINK: si la ruta no está en el historial local, cargarla desde la NUBE
  // (InstantDB) para que el enlace funcione SIN login y en cualquier dispositivo.
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const viewParam = u.get('view');
    const routeIdParam = u.get('routeId');
    if (!(viewParam === 'review' && routeIdParam)) return;
    if (instantLoading || reviewEntry) return; // ya resuelto (local o nube)

    const entry = buildReviewEntryFromCloud(routeIdParam, instantData);
    if (entry) setReviewEntry(entry);
    setReviewLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instantLoading, instantData, reviewEntry]);

  // Handlers with InstantDB Real-Time Synchronization
  const handleSaveSingleAlumno = async (newAlumno: Alumno, newRep: Representante) => {
    try {
      await upsertAlumnoInstant(newAlumno, newRep);
    } catch (e) {
      console.warn('InstantDB sync fallback to localStorage:', e);
    }
    // Also update localStorage for resilience
    const updatedReps = representantes.some((r) => r.id === newRep.id)
      ? representantes.map((r) => (r.id === newRep.id ? newRep : r))
      : [...representantes, newRep];
    const updatedAlumnos = alumnos.some((a) => a.id === newAlumno.id)
      ? alumnos.map((a) => (a.id === newAlumno.id ? newAlumno : a))
      : [...alumnos, newAlumno];
    localStorage.setItem('rutaescolar_alumnos', JSON.stringify(updatedAlumnos));
    localStorage.setItem('rutaescolar_representantes', JSON.stringify(updatedReps));

    // Force React refresh: store full snapshot so modalidad/dias/activo reflect instantly
    setAlumnosOverride((prev) => ({
      ...(prev || {}),
      [newAlumno.id]: {
        nombre: newAlumno.nombre,
        modalidad_servicio: newAlumno.modalidad_servicio,
        activo_en_rutas: newAlumno.activo_en_rutas !== false,
        dias_ruta: newAlumno.dias_ruta,
        direccion_recogida: newAlumno.direccion_recogida,
      },
    }));
  };

  const handleDeleteAlumno = async (id: string) => {
    try {
      await deleteAlumnoInstant(id);
    } catch (e) {
      console.warn('InstantDB delete fallback:', e);
    }
    const updated = alumnos.filter((a) => a.id !== id);
    localStorage.setItem('rutaescolar_alumnos', JSON.stringify(updated));
  };

  const handleSaveColegio = async (newCol: Colegio) => {
    try {
      await upsertColegioInstant(newCol);
    } catch (e) {
      console.warn('InstantDB colegio sync fallback:', e);
    }
    const updated = colegios.some((c) => c.id === newCol.id)
      ? colegios.map((c) => (c.id === newCol.id ? newCol : c))
      : [...colegios, newCol];
    localStorage.setItem('rutaescolar_colegios', JSON.stringify(updated));
  };

  const handleDeleteColegio = async (colId: string) => {
    try {
      await deleteColegioInstant(colId);
    } catch (e) {
      console.warn('InstantDB delete colegio fallback:', e);
    }
    const updated = colegios.filter((c) => c.id !== colId);
    localStorage.setItem('rutaescolar_colegios', JSON.stringify(updated));
    if (selectedColegioId === colId && updated.length > 0) {
      setSelectedColegioId(updated[0].id);
    }
  };

  const handleSaveConductor = async (newCond: Conductor) => {
    try {
      await upsertConductorInstant(newCond);
    } catch (e) {
      console.warn('InstantDB conductor sync fallback:', e);
    }
    const updated = conductores.some((c) => c.id === newCond.id)
      ? conductores.map((c) => (c.id === newCond.id ? newCond : c))
      : [...conductores, newCond];
    localStorage.setItem('rutaescolar_conductores', JSON.stringify(updated));

    // If active route was with this driver, update it
    if (activeRuta.conductor_id === newCond.id) {
      setActiveRuta((prev) => ({
        ...prev,
        conductor: newCond
      }));
    }
  };

  const handleDeleteConductor = async (condId: string) => {
    try {
      await deleteConductorInstant(condId);
    } catch (e) {
      console.warn('InstantDB delete conductor fallback:', e);
    }
    const updated = conductores.filter((c) => c.id !== condId);
    localStorage.setItem('rutaescolar_conductores', JSON.stringify(updated));
    if (currentDriverId === condId && updated.length > 0) {
      setCurrentDriverId(updated[0].id);
    }
  };

  const handleSelectDriverForCockpit = (driverId: string) => {
    setCurrentDriverId(driverId);
    const cond = conductores.find((c) => c.id === driverId);
    if (cond) {
      setActiveRuta((prev) => ({
        ...prev,
        conductor_id: driverId,
        conductor: cond
      }));
    }
    setCurrentView('driver');
  };

  const handleUpdateOrigen = (newOrig: { lat: number; lng: number; direccion?: string }) => {
    setOrigen(newOrig);
    localStorage.setItem('rutaescolar_origen', JSON.stringify(newOrig));
  };

  const handleSaveRoute = async (updatedRuta: RutaDiaria) => {
    setActiveRuta(updatedRuta);
    try {
      localStorage.setItem('rutaescolar_active_ruta', JSON.stringify(updatedRuta));
    } catch {}
    try {
      await saveRutaInstant(updatedRuta);
      // Persist to route history (full snapshot)
      await saveRouteToHistory(updatedRuta);
      setRouteHistory(getRouteHistory());
    } catch (e) {
      console.warn('InstantDB route save fallback:', e);
      try {
        await saveRouteToHistory(updatedRuta);
        setRouteHistory(getRouteHistory());
      } catch (e2) {
        console.warn('Route history save fallback:', e2);
      }
    }
  };

  // Toggle student active in routes
  const handleToggleActivoRutas = async (alumnoId: string, activo: boolean) => {
    // 1. Instant UI feedback: update local override so the toggle reflects immediately
    const current = alumnos.find((a) => a.id === alumnoId);
    setAlumnosOverride((prev) => ({
      ...(prev || {}),
      [alumnoId]: { ...(prev?.[alumnoId] || {}), activo_en_rutas: activo, modalidad_servicio: current?.modalidad_servicio, dias_ruta: current?.dias_ruta },
    }));

    // 2. Update localStorage for resilience
    const updated = alumnos.map((a) => (a.id === alumnoId ? { ...a, activo_en_rutas: activo } : a));
    localStorage.setItem('rutaescolar_alumnos', JSON.stringify(updated));

    // 3. Best-effort cloud sync to InstantDB
    try {
      await updateAlumnoActivoRutasInstant(alumnoId, activo);
    } catch (e) {
      console.warn('InstantDB toggle activo fallback:', e);
    }
  };

  // Start today's route (en_curso) — optionally for a specific journey (ida/vuelta)
  const handleStartRoute = (journey?: 'ida' | 'vuelta') => {
    const horaSalida = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let updated: RutaDiaria;
    if (journey && getJourney(activeRuta, journey)) {
      updated = updateJourney(activeRuta, journey, { estado: 'en_curso', hora_salida_real: horaSalida });
    } else {
      updated = { ...activeRuta, estado: 'en_curso', hora_salida_real: horaSalida };
    }

    handleSaveRoute(updated);
    // Webhook n8n: ruta_iniciada (vista de la jornada si aplica)
    notifyRutaIniciada(journeyView(updated, journey));
  };

  // Mark a stop as recogido / ausente / pendiente (+ webhook + auto-completar)
  const handleUpdateParada = (paradaId: string, estado: 'pendiente' | 'recogido' | 'ausente') => {
    const horaReal = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    const journeyKey = getJourneyByParadaId(activeRuta, paradaId);

    if (journeyKey) {
      // ---- Ruta combinada: actualizar la jornada que contiene la parada ----
      const journey = getJourney(activeRuta, journeyKey)!;
      const prevParada = journey.paradas.find((p) => p.id === paradaId);
      if (!prevParada || prevParada.estado === estado) return;

      const updatedParadas = journey.paradas.map((p) =>
        p.id === paradaId
          ? { ...p, estado: estado as any, hora_real: estado === 'pendiente' ? undefined : horaReal }
          : p
      );
      const journeyTerminada =
        journey.estado === 'en_curso' &&
        updatedParadas.length > 0 &&
        updatedParadas.every((p) => p.estado === 'recogido' || p.estado === 'ausente');

      const patch: any = { paradas: updatedParadas };
      if (journeyTerminada) {
        patch.estado = 'completada';
        patch.hora_llegada_real = horaReal;
      }

      const updated = updateJourney(activeRuta, journeyKey, patch);
      const updatedParada = updatedParadas.find((p) => p.id === paradaId)!;
      handleSaveRoute(updated);
      updateParadaEstadoInstant(paradaId, estado as any).catch(() => {});

      if (journeyTerminada) {
        notifyRutaCompletada(journeyView(updated, journeyKey));
      } else {
        notifyParadaActualizada(journeyView(updated, journeyKey), updatedParada, estado, prevParada.estado);
      }
      return;
    }

    // ---- Ruta simple (legacy) ----
    const prevParada = activeRuta.paradas.find((p) => p.id === paradaId);
    if (!prevParada || prevParada.estado === estado) return;

    const paradaActualizada = {
      ...prevParada,
      estado: estado as any,
      hora_real: estado === 'pendiente' ? undefined : horaReal,
    };

    const updatedParadas = activeRuta.paradas.map((p) =>
      p.id === paradaId ? paradaActualizada : p
    );

    const updated: RutaDiaria = {
      ...activeRuta,
      paradas: updatedParadas,
    };

    // Auto-finalización: todas las paradas procesadas mientras la ruta está en curso
    const rutaTerminada =
      activeRuta.estado === 'en_curso' &&
      updatedParadas.length > 0 &&
      updatedParadas.every((p) => p.estado === 'recogido' || p.estado === 'ausente');

    if (rutaTerminada) {
      updated.estado = 'completada';
      updated.hora_llegada_real = horaReal;
    }

    handleSaveRoute(updated);
    updateParadaEstadoInstant(paradaId, estado as any).catch(() => {});

    // Webhook n8n: evento de parada o de ruta completada
    if (rutaTerminada) {
      notifyRutaCompletada(updated);
    } else {
      notifyParadaActualizada(updated, paradaActualizada, estado, prevParada.estado);
    }
  };

  // Finalizar manualmente la ruta en curso (aunque queden paradas pendientes)
  const handleCompleteRoute = (journey?: 'ida' | 'vuelta') => {
    if (activeRuta.estado !== 'en_curso') return;
    const horaLlegada = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let updated: RutaDiaria;
    if (journey && getJourney(activeRuta, journey)) {
      updated = updateJourney(activeRuta, journey, { estado: 'completada', hora_llegada_real: horaLlegada });
    } else {
      updated = { ...activeRuta, estado: 'completada', hora_llegada_real: horaLlegada };
    }

    handleSaveRoute(updated);
    updateRutaEstadoInstant(activeRuta.id, 'completada', { hora_llegada_real: horaLlegada }).catch(() => {});
    // Webhook n8n: ruta_completada
    notifyRutaCompletada(journeyView(updated, journey));
  };

  // Reuse a history route as today's route
  const handleUseRouteToday = async (entry: RouteHistoryEntry) => {
    const snapshot: RutaDiaria = {
      ...entry.ruta,
      id: ensureUUID(entry.ruta.id),
      fecha: new Date().toISOString().substring(0, 10),
      estado: 'planificada',
      hora_salida_real: undefined,
      hora_llegada_real: undefined,
      paradas: (entry.ruta.paradas || []).map((p) => ({ ...p, estado: 'pendiente' as const, hora_real: undefined })),
      ida: entry.ruta.ida
        ? {
            ...entry.ruta.ida,
            estado: 'planificada',
            hora_salida_real: undefined,
            hora_llegada_real: undefined,
            paradas: (entry.ruta.ida.paradas || []).map((p) => ({ ...p, estado: 'pendiente' as const, hora_real: undefined })),
          }
        : entry.ruta.ida,
      vuelta: entry.ruta.vuelta
        ? {
            ...entry.ruta.vuelta,
            estado: 'planificada',
            hora_salida_real: undefined,
            hora_llegada_real: undefined,
            paradas: (entry.ruta.vuelta.paradas || []).map((p) => ({ ...p, estado: 'pendiente' as const, hora_real: undefined })),
          }
        : entry.ruta.vuelta,
    };
    await handleSaveRoute(snapshot);
    setCurrentView('driver');
  };

  // Delete a route from history
  const handleDeleteHistoryEntry = (entry: RouteHistoryEntry) => {
    const remaining = deleteRouteHistory(entry.id);
    setRouteHistory(remaining);
  };

  const activeParentStudent = selectedParentStudentId
    ? alumnosMap.get(selectedParentStudentId) || null
    : null;

  // Handlers for authentication
  const handleStaffLogin = (email: string) => {
    const clean = email.trim().toLowerCase();
    const usuario = toList(instantData?.usuarios).find(
      (u) => String(u.email || '').toLowerCase() === clean
    );
    const conductor = toList(instantData?.conductores).find(
      (c) => String(c.email || '').toLowerCase() === clean
    );

    // Resolver rol / cliente / conductor
    let rol = 'admin';
    let nombre = clean.split('@')[0];
    let clienteId: string | undefined;
    let conductorId: string | undefined;

    if (usuario) {
      rol = usuario.rol || 'admin';
      nombre = usuario.nombre || nombre;
      clienteId = usuario.cliente_id || undefined;
    } else if (conductor) {
      rol = 'conductor';
      nombre = conductor.nombre || nombre;
      clienteId = conductor.cliente_id || undefined;
      conductorId = conductor.id;
    } else {
      // Sin registro en usuarios/conductores: solo se permite admin demo en desarrollo
      if (clean === 'admin@demo.com' && import.meta.env.DEV) {
        rol = 'superadmin';
      } else {
        setAuthSession(null);
        console.warn('Acceso denegado: correo sin usuario registrado.');
        return;
      }
    }

    // El dueño (admin@demo.com) siempre es superadmin → gestiona clientes y activación
    if (clean === 'admin@demo.com') {
      rol = 'superadmin';
    }

    const user: StaffSessionUser = { email: clean, rol, nombre, clienteId, conductorId };
    setAuthSession({ type: 'staff', user });
    setDemoUser({ email: clean, rol, nombre });
    localStorage.setItem('rutaescolar_staff_session', JSON.stringify(user));
    localStorage.setItem('rutaescolar_demo_user', JSON.stringify({ email: clean, rol, nombre }));
    localStorage.removeItem('rutaescolar_parent_student_id');

    if (conductorId) {
      setCurrentDriverId(conductorId);
      setCurrentView('driver');
    } else {
      setCurrentView('home');
    }
  };

  // ===== CLIENTES (multi-tenant, solo superadmin) =====
  const handleSaveCliente = async (cliente: Cliente) => {
    try {
      await upsertClienteInstant(cliente);
    } catch (e) {
      console.warn('InstantDB cliente sync fallback:', e);
    }
  };

  const handleDeactivateCliente = async (clienteId: string) => {
    try {
      await deactivateClienteInstant(clienteId);
    } catch (e) {
      console.warn('InstantDB cliente deactivate fallback:', e);
    }
  };

  const handleManageCliente = (clienteId: string) => {
    setManageClienteId(clienteId);
    setCurrentView('home');
  };

  // Limpiar SOLO los datos demo recreados (mismo id + mismo nombre original)
  const handleCleanupDemo = async (): Promise<string[]> => {
    try {
      return await cleanupDemoData(instantData);
    } catch (e) {
      console.warn('Error limpiando datos demo:', e);
      return [];
    }
  };

  // Importar alumnos (CSV) bajo un cliente
  const handleImportAlumnosCsv = async (clienteId: string, rows: CsvAlumnoRow[]) => {
    for (const row of rows) {
      try {
        const repId = ensureUUID();
        const rep: Representante = {
          id: repId,
          nombre: row.representante || 'Representante',
          telefono_whatsapp: row.telefono || '',
          magic_token: `tok-${repId}`,
          email: row.email || '',
          cliente_id: clienteId,
        };
        const alumno: Alumno = {
          id: ensureUUID(),
          nombre: row.nombre,
          colegio_id: selectedColegio.id,
          representante_id: repId,
          direccion_recogida: row.direccion || '',
          lat: row.lat,
          lng: row.lng,
          grado: row.grado || '',
          modalidad_servicio: (row.modalidad as any) || 'ida_y_vuelta',
          activo_en_rutas: true,
          dias_ruta: row.dias ? row.dias.split(/[,\s]+/).filter(Boolean) : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
          cliente_id: clienteId,
        };
        await upsertAlumnoInstant(alumno, rep);
      } catch (e) {
        console.warn('Error importando alumno CSV:', e);
      }
    }
  };

  const handleParentLogin = (studentId: string) => {
    setAuthSession({ type: 'parent', studentId });
    setSelectedParentStudentId(studentId);
    localStorage.setItem('rutaescolar_parent_student_id', studentId);
    localStorage.removeItem('rutaescolar_staff_session');
    setCurrentView('parent');
  };

  const handleSignOut = () => {
    setAuthSession(null);
    setSelectedParentStudentId('');
    localStorage.removeItem('rutaescolar_staff_session');
    localStorage.removeItem('rutaescolar_parent_student_id');
    localStorage.removeItem('rutaescolar_demo_user');
    db.auth.signOut().catch(() => {});
  };

  // REVIEW VIEW: Read-only route link works WITHOUT login (shared link),
  // cargando desde historial local o desde la nube (InstantDB)
  if (currentView === 'review') {
    return (
      <div className="flex h-screen w-screen bg-canvas text-ink font-sans overflow-hidden">
        <div className="flex flex-1 flex-col min-w-0">
          <main className="flex-1 overflow-hidden relative">
            {reviewLoading && !reviewEntry ? (
              <div className="h-full flex items-center justify-center bg-canvas p-6">
                <div className="rounded-card bg-surface border border-line shadow-soft p-8 max-w-md w-full text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-soft-gray text-3xl animate-pulse">🔍</div>
                  <h2 className="text-lg font-black text-ink">Cargando ruta...</h2>
                  <p className="text-sm text-muted">Buscando la ruta en la nube para mostrarla sin necesidad de iniciar sesión.</p>
                </div>
              </div>
            ) : reviewEntry ? (
              <RouteReviewView
                entry={reviewEntry}
                alumnosMap={alumnosMap}
                onBack={() => setCurrentView('home')}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-canvas p-6">
                <div className="rounded-card bg-surface border border-line shadow-soft p-8 max-w-md w-full text-center space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-soft-gray text-3xl">🔍</div>
                  <h2 className="text-lg font-black text-ink">Ruta no encontrada</h2>
                  <p className="text-sm text-muted">
                    No pudimos encontrar la ruta solicitada. Verifica que el enlace sea correcto o
                    contacta con quien lo compartió.
                  </p>
                  <button
                    onClick={() => setCurrentView('home')}
                    className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white hover:bg-blue-600 transition-colors cursor-pointer"
                  >
                    Ir al Inicio
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // MANDATORY LOGIN GATE: If not logged in, render ONLY the LoginGateway component
  if (!authSession) {
    return (
      <LoginGateway
        allStudents={alumnos}
        onStaffLogin={handleStaffLogin}
        onParentLogin={handleParentLogin}
      />
    );
  }

  // PARENT VIEW: If logged in as parent, show parent top bar and ParentPortal exclusively
  if (authSession.type === 'parent') {
    return (
      <div className="flex h-screen w-screen flex-col bg-canvas text-ink antialiased overflow-hidden font-sans">
        <PWAInstallBanner />
        <PWAUpdateBanner />

        {/* Parent Portal Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-3 sm:px-5 z-30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-black text-lg shadow-soft">
              🚌
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-ink flex items-center gap-1.5">
                <span>RutaEscolar</span>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-black text-primary border border-primary/25">
                  Portal Representante
                </span>
              </h1>
              <p className="text-[10px] text-muted hidden sm:block">
                Seguimiento en Vivo y Estado de Parada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {activeParentStudent && (
              <div className="hidden sm:flex items-center gap-1.5 bg-soft-gray px-2.5 py-1 rounded-lg border border-line text-xs font-mono text-primary">
                <span className="text-muted">Alumno:</span>
                <span className="font-bold">{activeParentStudent.nombre.split(' ')[0]}</span>
                <span className="text-muted">({activeParentStudent.id})</span>
              </div>
            )}

            <button
              id="btn-parent-logout"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-alert hover:bg-rose-100 active:scale-95 transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar Sesión / Salir</span>
            </button>
          </div>
        </header>

        {/* Parent Portal Main Content */}
        <main className="flex-1 overflow-hidden relative">
          <ParentPortal
            alumno={activeParentStudent}
            colegio={selectedColegio}
            ruta={activeRuta}
            alumnosMap={alumnosMap}
            allStudents={alumnos}
            onSelectAnotherStudent={setSelectedParentStudentId}
            onSignOut={handleSignOut}
          />
        </main>
      </div>
    );
  }

  // STAFF VIEW: Sidebar + Header + Main Content
  return (
    <div className="flex h-screen w-screen bg-canvas text-ink font-sans overflow-hidden">
      <AppSidebar currentView={currentView} onNavigate={setCurrentView} showClientes={isSuperadmin} />

      <div className="flex flex-1 flex-col min-w-0">
        <PWAInstallBanner />
        <PWAUpdateBanner />

        <AppHeader
          currentView={currentView}
          demoUser={demoUser}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          onSignOut={handleSignOut}
          onNavigate={setCurrentView}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          mobileMenuOpen={mobileMenuOpen}
        />

        {/* Main Viewport Container */}
        <main className="flex-1 overflow-hidden relative">
          {currentView === 'home' && (
            <HomeDashboard
              ruta={activeRuta}
              colegio={selectedColegio}
              alumnos={alumnos}
              conductores={conductores}
              onNavigate={setCurrentView}
            />
          )}

          {currentView === 'driver' && (
            <DriverPanelSimple
              ruta={activeRuta}
              colegio={selectedColegio}
              alumnosMap={alumnosMap}
              conductores={conductores}
              currentDriverId={currentDriverId}
              history={routeHistory}
              onSelectDriver={handleSelectDriverForCockpit}
              onUpdateRuta={handleSaveRoute}
              onUpdateParada={handleUpdateParada}
              onStartRoute={handleStartRoute}
              onCompleteRoute={handleCompleteRoute}
            />
          )}

          {currentView === 'history' && (
            <RouteHistory
              history={routeHistory}
              onReview={(entry) => {
                setReviewEntry(entry);
                setCurrentView('review');
              }}
              onUseToday={handleUseRouteToday}
              onDelete={handleDeleteHistoryEntry}
              onBack={() => setCurrentView('home')}
            />
          )}

          {currentView === 'review' && reviewEntry && (
            <RouteReviewView
              entry={reviewEntry}
              alumnosMap={alumnosMap}
              onBack={() => setCurrentView('history')}
            />
          )}

          {currentView === 'parent' && (
            <ParentPortal
              alumno={activeParentStudent}
              colegio={selectedColegio}
              ruta={activeRuta}
              alumnosMap={alumnosMap}
              allStudents={alumnos}
              onSelectAnotherStudent={setSelectedParentStudentId}
              onSignOut={handleSignOut}
            />
          )}

          {currentView === 'planner' && (
            <RoutePlanner
              colegios={colegios}
              selectedColegio={selectedColegio}
              onSelectColegio={(c) => setSelectedColegioId(c.id)}
              origen={origen}
              onUpdateOrigen={handleUpdateOrigen}
              allAlumnos={alumnos}
              alumnosMap={alumnosMap}
              conductores={conductores}
              activeRuta={activeRuta}
              onSaveRoute={handleSaveRoute}
              onSwitchToDriver={() => setCurrentView('driver')}
            />
          )}

          {currentView === 'students' && (
            <StudentManager
              alumnos={alumnos}
              representantes={representantes}
              colegios={colegios}
              onSaveAlumno={handleSaveSingleAlumno}
              onDeleteAlumno={handleDeleteAlumno}
              onToggleActivoRutas={handleToggleActivoRutas}
              onOpenParentPortal={(id) => {
                setSelectedParentStudentId(id);
                setCurrentView('parent');
              }}
            />
          )}

          {currentView === 'schools' && (
            <SchoolManager
              colegios={colegios}
              alumnos={alumnos}
              onSaveColegio={handleSaveColegio}
              onDeleteColegio={handleDeleteColegio}
            />
          )}

          {currentView === 'drivers' && (
            <DriverManager
              conductores={conductores}
              activeRuta={activeRuta}
              onSaveConductor={handleSaveConductor}
              onDeleteConductor={handleDeleteConductor}
              onSelectDriverForCockpit={handleSelectDriverForCockpit}
            />
          )}

          {currentView === 'sql' && <SqlSchemaViewer />}

          {currentView === 'clientes' && (
            <ClientManager
              clientes={(toList(instantData?.clientes) as any[]).map((c) => ({
                id: ensureUUID(c.id),
                nombre: c.nombre || 'Cliente',
                plan: c.plan || 'basico',
                activo: c.activo !== false,
                created_at: c.created_at,
              }))}
              colegiosCount={colegios.length}
              alumnosCount={alumnos.length}
              conductoresCount={conductores.length}
              multitenantActive={multitenantEnabled()}
              backupData={instantData || {}}
              onSetMultitenant={async (on) => {
                setMultitenantEnabled(on);
                if (on) await migrateToClientes(instantData);
                window.location.reload();
              }}
              onSaveCliente={handleSaveCliente}
              onDeactivateCliente={handleDeactivateCliente}
              onManageCliente={handleManageCliente}
              onImportAlumnos={handleImportAlumnosCsv}
              onCleanupDemo={handleCleanupDemo}
              onBack={() => setCurrentView('home')}
            />
          )}
        </main>
      </div>

      {/* InstantDB Auth & Sync Modal */}
      <InstantAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentDemoUser={demoUser}
        onSetDemoUser={setDemoUser}
      />
    </div>
  );
}
