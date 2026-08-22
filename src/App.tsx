/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { LogOut } from 'lucide-react';
import {
  Alumno,
  Colegio,
  Conductor,
  ParadaRuta,
  Representante,
  RutaDiaria
} from './types';
import {
  INITIAL_ALUMNOS,
  INITIAL_CONDUCTORES,
  INITIAL_DRIVER_ORIGIN,
  INITIAL_REPRESENTANTES,
  INITIAL_SCHOOL
} from './services/mockData';
import { calculateOptimizedRoute } from './services/routeCalculator';
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
import { ParentPortal } from './components/Parent/ParentPortal';
import { RoutePlanner } from './components/Admin/RoutePlanner';
import { StudentManager } from './components/Admin/StudentManager';
import { SchoolManager } from './components/Admin/SchoolManager';
import { DriverManager } from './components/Admin/DriverManager';
import { SqlSchemaViewer } from './components/Admin/SqlSchemaViewer';
import { PWAInstallBanner } from './components/PWA/PWAInstallBanner';
import { HomeDashboard } from './components/Home/HomeDashboard';
import { AppSidebar, StaffView } from './components/Layout/AppSidebar';
import { AppHeader } from './components/Layout/AppHeader';
import {
  db,
  INSTANT_APP_ID,
  seedInstantDatabase,
  upsertAlumnoInstant,
  deleteAlumnoInstant,
  upsertColegioInstant,
  deleteColegioInstant,
  upsertConductorInstant,
  deleteConductorInstant,
  updateAlumnoActivoRutasInstant,
  saveRutaInstant,
  updateParadaEstadoInstant,
  ensureUUID
} from './services/instantDb';
import { InstantAuthModal } from './components/Auth/InstantAuthModal';
import { InstantSyncBadge } from './components/Auth/InstantSyncBadge';
import { LoginGateway } from './components/Auth/LoginGateway';

export type AuthSession =
  | { type: 'staff'; user: { email: string; rol: string; nombre: string } }
  | { type: 'parent'; studentId: string }
  | null;

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<StaffView>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentDriverId, setCurrentDriverId] = useState<string>('d1000000-0000-4000-8000-000000000001');

  // Route History State
  const [routeHistory, setRouteHistory] = useState<RouteHistoryEntry[]>(() => getRouteHistory());
  const [reviewEntry, setReviewEntry] = useState<RouteHistoryEntry | null>(null);

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

  // 1. InstantDB Live Real-Time Query
  const { data: instantData, isLoading: instantLoading } = db.useQuery({
    colegios: {},
    representantes: {},
    alumnos: {},
    conductores: {},
    rutas_diarias: {},
    paradas_ruta: {},
    tracking_logs: {},
    usuarios: {}
  });

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
      const rawAlus: any[] = Array.isArray(instantData.alumnos)
        ? instantData.alumnos
        : Object.values(instantData.alumnos || {});
      const hasColegios = rawCols.length > 0;
      const hasAlumnos = rawAlus.length > 0;

      const isOldCaracasData =
        hasColegios &&
        (Number(rawCols[0]?.lat) > 5 ||
          rawCols[0]?.direccion?.includes('Caracas') ||
          rawCols[0]?.direccion?.includes('Venezuela'));

      if (!hasColegios || !hasAlumnos || isOldCaracasData) {
        console.log('[InstantDB] Seeding / Migrating dataset to Quito, Ecuador...');
        seedInstantDatabase(true);
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
        created_at: col.created_at
      }));
    }
    try {
      const saved = localStorage.getItem('rutaescolar_colegios');
      return saved ? JSON.parse(saved) : [INITIAL_SCHOOL];
    } catch {
      return [INITIAL_SCHOOL];
    }
  }, [instantData?.colegios]);

  const [selectedColegioId, setSelectedColegioId] = useState<string>(INITIAL_SCHOOL.id);
  const selectedColegio = useMemo(() => {
    return colegios.find((c) => c.id === selectedColegioId) || colegios[0] || INITIAL_SCHOOL;
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
        created_at: rep.created_at
      }));
    }
    try {
      const saved = localStorage.getItem('rutaescolar_representantes');
      return saved ? JSON.parse(saved) : INITIAL_REPRESENTANTES;
    } catch {
      return INITIAL_REPRESENTANTES;
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

  // Local override for quick UI feedback when toggling activo_en_rutas
  const [alumnosOverride, setAlumnosOverride] = useState<Record<string, boolean> | null>(null);

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
          activo_en_rutas: alumnosOverride ? (alumnosOverride[aluId] ?? alu.activo_en_rutas !== false) : alu.activo_en_rutas !== false,
          dias_ruta: alu.dias_ruta || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
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
            activo_en_rutas: alumnosOverride[a.id] ?? a.activo_en_rutas !== false,
          }));
        }
        return parsed;
      }
      return INITIAL_ALUMNOS.map((a) => ({
        ...a,
        colegio: selectedColegio,
        representante: repsMap.get(a.representante_id)
      }));
    } catch {
      return INITIAL_ALUMNOS;
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
        created_at: cond.created_at
      }));
    }
    try {
      const saved = localStorage.getItem('rutaescolar_conductores');
      return saved ? JSON.parse(saved) : INITIAL_CONDUCTORES;
    } catch {
      return INITIAL_CONDUCTORES;
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
    const defaultConductor = INITIAL_CONDUCTORES[0];
    return {
      id: 'e5000000-0000-4000-8000-000000000001',
      fecha: new Date().toISOString().substring(0, 10),
      colegio_id: selectedColegio.id,
      colegio: selectedColegio,
      conductor_id: defaultConductor.id,
      conductor: defaultConductor,
      origen_lat: origen.lat,
      origen_lng: origen.lng,
      origen_direccion: origen.direccion,
      modo_optimizacion: 'fijo',
      hora_llegada_objetivo: selectedColegio.hora_llegada_limite,
      hora_salida_estimada: '07:18:00',
      tiempo_manejo_estimado_min: 27.5,
      tiempo_abordaje_total_min: 12.5,
      tiempo_total_estimado_min: 40.0,
      distancia_total_km: 9.4,
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
      // Read-only review link: load the route from history
      const entry = getRouteHistoryById(routeIdParam);
      if (entry) {
        setReviewEntry(entry);
        setCurrentView('review');
      }
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

    // Force React refresh: bump the override so the useMemo re-reads from DB / local
    setAlumnosOverride((prev) => ({
      ...(prev || {}),
      [newAlumno.id]: newAlumno.activo_en_rutas !== false,
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
    setAlumnosOverride((prev) => ({ ...(prev || {}), [alumnoId]: activo }));

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

  // Start today's route (en_curso)
  const handleStartRoute = () => {
    const updated: RutaDiaria = {
      ...activeRuta,
      estado: 'en_curso',
      hora_salida_real: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    handleSaveRoute(updated);
  };

  // Mark a stop as recogido / ausente / pendiente
  const handleUpdateParada = (paradaId: string, estado: 'pendiente' | 'recogido' | 'ausente') => {
    const updated: RutaDiaria = {
      ...activeRuta,
      paradas: activeRuta.paradas.map((p) =>
        p.id === paradaId
          ? {
              ...p,
              estado: estado as any,
              hora_real: estado === 'pendiente' ? undefined : new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
            }
          : p
      ),
    };
    handleSaveRoute(updated);
    updateParadaEstadoInstant(paradaId, estado as any).catch(() => {});
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
  const handleStaffLogin = (user: { email: string; rol: string; nombre: string }) => {
    setAuthSession({ type: 'staff', user });
    setDemoUser(user);
    localStorage.setItem('rutaescolar_staff_session', JSON.stringify(user));
    localStorage.setItem('rutaescolar_demo_user', JSON.stringify(user));
    localStorage.removeItem('rutaescolar_parent_student_id');
    setCurrentView('home');
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
      <AppSidebar currentView={currentView} onNavigate={setCurrentView} />

      <div className="flex flex-1 flex-col min-w-0">
        <PWAInstallBanner />

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
