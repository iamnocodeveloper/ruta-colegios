/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Users,
  School,
  Database,
  Sparkles,
  MapPin,
  Menu,
  X,
  ExternalLink,
  Zap,
  Lock,
  LogOut
} from 'lucide-react';
import {
  Alumno,
  Colegio,
  Representante,
  RutaDiaria
} from './types';
import {
  INITIAL_ALUMNOS,
  INITIAL_DRIVER_ORIGIN,
  INITIAL_REPRESENTANTES,
  INITIAL_SCHOOL
} from './services/mockData';
import { calculateOptimizedRoute } from './services/routeCalculator';
import { DriverPanel } from './components/Driver/DriverPanel';
import { ParentPortal } from './components/Parent/ParentPortal';
import { RoutePlanner } from './components/Admin/RoutePlanner';
import { StudentManager } from './components/Admin/StudentManager';
import { SchoolManager } from './components/Admin/SchoolManager';
import { SqlSchemaViewer } from './components/Admin/SqlSchemaViewer';
import { PWAInstallBanner } from './components/PWA/PWAInstallBanner';
import {
  db,
  INSTANT_APP_ID,
  seedInstantDatabase,
  upsertAlumnoInstant,
  deleteAlumnoInstant,
  upsertColegioInstant,
  deleteColegioInstant,
  saveRutaInstant,
  updateParadaEstadoInstant
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
  const [currentView, setCurrentView] = useState<
    'driver' | 'parent' | 'planner' | 'students' | 'schools' | 'sql'
  >('driver');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

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
    rutas_diarias: {},
    paradas_ruta: {},
    tracking_logs: {},
    usuarios: {}
  });

  // Automatically seed InstantDB with real initial data if empty
  useEffect(() => {
    if (!instantLoading && instantData) {
      const rawCols = Array.isArray(instantData.colegios)
        ? instantData.colegios
        : Object.keys(instantData.colegios || {});
      const rawAlus = Array.isArray(instantData.alumnos)
        ? instantData.alumnos
        : Object.keys(instantData.alumnos || {});
      const hasColegios = rawCols.length > 0;
      const hasAlumnos = rawAlus.length > 0;
      if (!hasColegios || !hasAlumnos) {
        console.log('[InstantDB] Empty database detected. Seeding real school dataset...');
        seedInstantDatabase(false);
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
        id: String(col.id || 'col_' + Math.random().toString(36).substring(2, 7)),
        nombre: col.nombre || 'Colegio',
        direccion: col.direccion || '',
        lat: Number(col.lat) || 10.4995,
        lng: Number(col.lng) || -66.8525,
        hora_llegada_limite: col.hora_llegada_limite || '08:00:00',
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
          lat: Number(alu.lat) || 10.4905,
          lng: Number(alu.lng) || -66.8650,
          grado: alu.grado || '',
          notas_medicas: alu.notas_medicas || '',
          tiempo_abordaje_estimado_min: Number(alu.tiempo_abordaje_estimado_min || 2.5),
          created_at: alu.created_at,
          colegio: colegiosMap.get(colId) || selectedColegio,
          representante: repsMap.get(repId)
        };
      });
    }
    try {
      const saved = localStorage.getItem('rutaescolar_alumnos');
      if (saved) return JSON.parse(saved);
      return INITIAL_ALUMNOS.map((a) => ({
        ...a,
        colegio: selectedColegio,
        representante: repsMap.get(a.representante_id)
      }));
    } catch {
      return INITIAL_ALUMNOS;
    }
  }, [instantData?.alumnos, colegiosMap, repsMap, selectedColegio]);

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

  // Active Daily Route
  const [activeRuta, setActiveRuta] = useState<RutaDiaria>(() => {
    return {
      id: 'ruta_hoy_' + new Date().toISOString().substring(0, 10),
      fecha: new Date().toISOString().substring(0, 10),
      colegio_id: selectedColegio.id,
      colegio: selectedColegio,
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

  // Sync InstantDB Paradas / Rutas into activeRuta state in real time
  useEffect(() => {
    if (instantData?.paradas_ruta && Object.keys(instantData.paradas_ruta).length > 0) {
      const dbParadas = Object.entries(instantData.paradas_ruta)
        .map(([id, p]: [string, any]) => ({
          id,
          ruta_id: p.ruta_id,
          alumno_id: p.alumno_id,
          orden: Number(p.orden),
          hora_estimada: p.hora_estimada,
          hora_real: p.hora_real,
          estado: p.estado as any,
          lat: Number(p.lat),
          lng: Number(p.lng),
          distancia_desde_anterior_km: Number(p.distancia_desde_anterior_km || 0),
          tiempo_desde_anterior_min: Number(p.tiempo_desde_anterior_min || 0),
          alumno: alumnosMap.get(p.alumno_id)
        }))
        .sort((a, b) => a.orden - b.orden);

      if (dbParadas.length > 0) {
        setActiveRuta((prev) => ({
          ...prev,
          paradas: dbParadas
        }));
      }
    }
  }, [instantData?.paradas_ruta, alumnosMap]);

  // Initial Route Calculation & URL params parser
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const magic = urlParams.get('magic');
    const studentParam = urlParams.get('student');
    const viewParam = urlParams.get('view');

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
    } else if (viewParam === 'driver' || viewParam === 'planner' || viewParam === 'students') {
      setCurrentView(viewParam as any);
    }

    // Generate initial planned route with geometry
    if (alumnos.length > 0) {
      calculateOptimizedRoute(origen, selectedColegio, alumnos, {
        modo: 'fijo',
        tiempoAbordajeMin: 2.5,
        horaLlegadaLimite: selectedColegio.hora_llegada_limite
      }).then((res) => {
        const initialParadas = res.paradas_ordenadas.map((p) => ({
          id: 'parada_' + p.alumno_id,
          ruta_id: activeRuta.id,
          alumno_id: p.alumno_id,
          orden: p.orden,
          hora_estimada: p.hora_estimada,
          estado: 'pendiente' as const,
          lat: p.lat,
          lng: p.lng,
          distancia_desde_anterior_km: p.distancia_desde_anterior_km,
          tiempo_desde_anterior_min: p.tiempo_desde_anterior_min,
          alumno: alumnosMap.get(p.alumno_id)
        }));

        const calculatedRuta: RutaDiaria = {
          ...activeRuta,
          colegio_id: selectedColegio.id,
          colegio: selectedColegio,
          hora_salida_estimada: res.hora_salida_estimada,
          tiempo_manejo_estimado_min: res.tiempo_manejo_min,
          tiempo_abordaje_total_min: res.tiempo_abordaje_total_min,
          tiempo_total_estimado_min: res.tiempo_total_min,
          distancia_total_km: res.distancia_total_km,
          paradas: initialParadas,
          polyline_geometry: res.polyline_geometry
        };

        setActiveRuta(calculatedRuta);
      });
    }
  }, [selectedColegio.id]);

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

  const handleUpdateOrigen = (newOrig: { lat: number; lng: number; direccion?: string }) => {
    setOrigen(newOrig);
    localStorage.setItem('rutaescolar_origen', JSON.stringify(newOrig));
  };

  const handleSaveRoute = async (updatedRuta: RutaDiaria) => {
    setActiveRuta(updatedRuta);
    try {
      await saveRutaInstant(updatedRuta);
    } catch (e) {
      console.warn('InstantDB route save fallback:', e);
    }
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
    setCurrentView('driver');
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
      <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 antialiased overflow-hidden font-sans">
        <PWAInstallBanner />

        {/* Parent Portal Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-3 sm:px-5 z-30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black text-lg shadow-md shadow-amber-500/20">
              🚌
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-100 flex items-center gap-1.5">
                <span>RutaEscolar</span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-black text-amber-400 border border-amber-500/30">
                  Portal Representante
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Seguimiento en Vivo y Estado de Parada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {activeParentStudent && (
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs font-mono text-amber-400">
                <span className="text-slate-400">Alumno:</span>
                <span className="font-bold">{activeParentStudent.nombre.split(' ')[0]}</span>
                <span className="text-slate-500">({activeParentStudent.id})</span>
              </div>
            )}

            <button
              id="btn-parent-logout"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer"
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

  // STAFF VIEW: Admin / Driver Cockpit with Full Management Menu
  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 antialiased overflow-hidden font-sans">
      {/* PWA Install Notification */}
      <PWAInstallBanner />

      {/* Main Top Navigation Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-3 sm:px-5 z-30">
        <div className="flex items-center gap-3">
          {/* Brand Bus Logo */}
          <div
            onClick={() => setCurrentView('driver')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-black text-lg shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              🚌
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-100 flex items-center gap-1.5">
                <span>RutaEscolar</span>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-black text-amber-400 border border-amber-500/30">
                  PWA
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                InstantDB Real-Time & Algoritmo de Salida
              </p>
            </div>
          </div>
        </div>

        {/* Desktop View Switcher & InstantDB Badge */}
        <div className="flex items-center gap-2">
          <nav className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              id="nav-driver"
              onClick={() => setCurrentView('driver')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'driver'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Cabina Conductor</span>
            </button>

            <button
              id="nav-parent"
              onClick={() => setCurrentView('parent')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'parent'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Portal Representante</span>
            </button>

            <button
              id="nav-planner"
              onClick={() => setCurrentView('planner')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'planner'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Planificador & Salida</span>
            </button>

            <button
              id="nav-students"
              onClick={() => setCurrentView('students')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'students'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Alumnos ({alumnos.length})</span>
            </button>

            <button
              id="nav-schools"
              onClick={() => setCurrentView('schools')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'schools'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <School className="h-3.5 w-3.5" />
              <span>Colegios</span>
            </button>

            <button
              id="nav-sql"
              onClick={() => setCurrentView('sql')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'sql'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Esquema SQL & DB</span>
            </button>
          </nav>

          {/* InstantDB Status & Auth Badge */}
          <InstantSyncBadge
            onOpenAuthModal={() => setAuthModalOpen(true)}
            demoUser={demoUser}
          />

          {/* Sign Out Button */}
          <button
            id="btn-staff-logout"
            onClick={handleSignOut}
            title="Cerrar Sesión"
            className="flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-rose-400 border border-slate-700 hover:bg-slate-700 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden rounded-lg bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden z-40 bg-slate-900 border-b border-slate-800 p-3 grid grid-cols-2 gap-2 text-xs font-bold shadow-2xl">
          <button
            onClick={() => {
              setCurrentView('driver');
              setMobileMenuOpen(false);
            }}
            className={`p-2.5 rounded-lg flex items-center gap-2 ${
              currentView === 'driver' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-200'
            }`}
          >
            <Compass className="h-4 w-4" />
            <span>Cabina Conductor</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('parent');
              setMobileMenuOpen(false);
            }}
            className={`p-2.5 rounded-lg flex items-center gap-2 ${
              currentView === 'parent' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Portal Representante</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('planner');
              setMobileMenuOpen(false);
            }}
            className={`p-2.5 rounded-lg flex items-center gap-2 ${
              currentView === 'planner' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Planificador Salida</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('students');
              setMobileMenuOpen(false);
            }}
            className={`p-2.5 rounded-lg flex items-center gap-2 ${
              currentView === 'students' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Alumnos ({alumnos.length})</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('schools');
              setMobileMenuOpen(false);
            }}
            className={`p-2.5 rounded-lg flex items-center gap-2 ${
              currentView === 'schools' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-200'
            }`}
          >
            <School className="h-4 w-4" />
            <span>Colegios</span>
          </button>

          <button
            onClick={() => {
              setCurrentView('sql');
              setMobileMenuOpen(false);
            }}
            className={`p-2.5 rounded-lg flex items-center gap-2 ${
              currentView === 'sql' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-200'
            }`}
          >
            <Database className="h-4 w-4" />
            <span>Esquema SQL & DB</span>
          </button>
        </div>
      )}

      {/* Main Viewport Container */}
      <main className="flex-1 overflow-hidden relative">
        {currentView === 'driver' && (
          <DriverPanel
            ruta={activeRuta}
            colegio={selectedColegio}
            alumnosMap={alumnosMap}
            onUpdateRuta={handleSaveRoute}
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

        {currentView === 'sql' && <SqlSchemaViewer />}
      </main>

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
