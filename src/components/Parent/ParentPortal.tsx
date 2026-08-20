/**
 * Parent Portal Component (Módulo Representante)
 * Acceso directo mediante el ID del Alumno (sin necesidad de contraseñas complejas):
 *   - Formulario de ingreso por ID de Alumno con validación inmediata y sugerencias rápidas
 *   - Seguimiento en vivo por GPS de la unidad escolar
 *   - Estado específico del estudiante (Programado, Próxima parada, A bordo, Entregado, Ausente)
 *   - Distancia en tiempo real y hora estimada
 *   - Contacto directo con el conductor
 */

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Clock,
  ShieldCheck,
  Phone,
  Navigation,
  School,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  User,
  ArrowRight,
  LogOut
} from 'lucide-react';
import { Alumno, Colegio, ParadaRuta, RutaDiaria, TrackingLog } from '../../types';
import { SchoolRouteMap } from '../Map/SchoolRouteMap';
import { calculateHaversineDistance, formatFriendlyTime } from '../../services/routeCalculator';

interface ParentPortalProps {
  alumno?: Alumno | null;
  colegio: Colegio;
  ruta: RutaDiaria;
  alumnosMap: Map<string, Alumno>;
  onSelectAnotherStudent: (studentId: string) => void;
  allStudents?: Alumno[];
  onSignOut?: () => void;
}

export const ParentPortal: React.FC<ParentPortalProps> = ({
  alumno,
  colegio,
  ruta,
  alumnosMap,
  onSelectAnotherStudent,
  allStudents = [],
  onSignOut
}) => {
  const [inputStudentId, setInputStudentId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [vanLocation, setVanLocation] = useState<TrackingLog | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Poll for live tracking from server when student is selected
  const fetchLiveTracking = async () => {
    if (!ruta?.id) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/tracking/${ruta.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.latest) {
          setVanLocation(data.latest);
        }
      }
    } catch {}
    setLastRefreshed(new Date());
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    if (alumno && ruta?.id) {
      fetchLiveTracking();
      const interval = setInterval(fetchLiveTracking, 3000);
      return () => clearInterval(interval);
    }
  }, [alumno?.id, ruta?.id]);

  // Handle student ID submission
  const handleLoginWithStudentId = (idToLookup?: string) => {
    const targetId = (idToLookup || inputStudentId).trim().toLowerCase();
    if (!targetId) {
      setErrorMessage('Por favor ingresa el ID del estudiante.');
      return;
    }

    // Lookup student in Map or list (case-insensitive)
    const foundStudent =
      alumnosMap.get(targetId) ||
      allStudents.find((s) => s.id.toLowerCase() === targetId || s.nombre.toLowerCase().includes(targetId));

    if (foundStudent) {
      setErrorMessage(null);
      onSelectAnotherStudent(foundStudent.id);
      localStorage.setItem('rutaescolar_parent_student_id', foundStudent.id);
    } else {
      setErrorMessage(`No se encontró ningún estudiante con el ID "${targetId}". Verifica el código.`);
    }
  };

  // IF NO STUDENT IS SELECTED: Show direct Student ID Login Screen
  if (!alumno) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-slate-950 p-4 text-slate-100 animate-fadeIn">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-3xl border border-amber-500/30 text-amber-400 shadow-inner">
              🎒
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">Portal del Representante</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Ingresa el <b className="text-amber-400">ID del Alumno</b> para consultar el estado del transporte escolar y el recorrido en tiempo real.
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLoginWithStudentId();
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="input-student-id" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                ID del Alumno *
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  id="input-student-id"
                  type="text"
                  required
                  autoFocus
                  value={inputStudentId}
                  onChange={(e) => {
                    setInputStudentId(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Ej: alu_01"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 pl-10 pr-4 py-2.5 text-sm font-mono text-amber-400 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            <button
              id="btn-parent-login"
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-black text-slate-950 hover:bg-amber-400 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              <span>Ingresar al Portal de Seguimiento</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Demo Access Student Chips */}
          <div className="border-t border-slate-800 pt-4 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              IDs de prueba disponibles:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {allStudents.slice(0, 5).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setInputStudentId(s.id);
                    handleLoginWithStudentId(s.id);
                  }}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-amber-500 hover:text-amber-400 transition-all font-mono cursor-pointer"
                >
                  <span className="font-bold">{s.id}</span> ({s.nombre.split(' ')[0]})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // IF STUDENT IS SELECTED: Show active parent portal
  const parada = ruta.paradas?.find((p) => p.alumno_id === alumno.id);
  const paradaIndex = ruta.paradas?.findIndex((p) => p.alumno_id === alumno.id) ?? -1;
  const activeStopIndex = ruta.paradas?.findIndex((p) => p.estado === 'pendiente') ?? -1;

  // Determine Student's Live Journey Status
  const getStudentStatus = () => {
    if (ruta.estado === 'completada' || parada?.estado === 'completado') {
      return {
        key: 'entregado',
        title: '¡Entregado(a) en la Escuela!',
        description: `${alumno.nombre} ha ingresado a salvo en ${colegio.nombre}.`,
        badgeColor: 'bg-emerald-500 text-slate-950',
        badgeText: 'Entregado en Escuela',
        icon: '🏫'
      };
    }

    if (parada?.estado === 'ausente') {
      return {
        key: 'ausente',
        title: 'Reportado(a) Ausente',
        description: 'La unidad pasó por la parada y continuó tras la espera reglamentaria.',
        badgeColor: 'bg-rose-500 text-white',
        badgeText: 'Ausente',
        icon: '⚠️'
      };
    }

    if (parada?.estado === 'recogido') {
      return {
        key: 'a_bordo',
        title: 'Alumno(a) a Bordo de la Unidad',
        description: `${alumno.nombre} va seguro(a) en la ruta con destino a ${colegio.nombre}.`,
        badgeColor: 'bg-sky-500 text-slate-950',
        badgeText: 'A Bordo de la Unidad',
        icon: '🚌'
      };
    }

    if (ruta.estado === 'en_curso') {
      const isNext = activeStopIndex === paradaIndex;
      return {
        key: 'en_camino',
        title: isNext ? '¡La unidad está llegando a tu parada!' : 'Unidad en Camino',
        description: isNext
          ? 'La unidad escolar es la siguiente en llegar. Por favor ten a mano al estudiante.'
          : `Faltan ${Math.max(1, paradaIndex - activeStopIndex)} paradas antes de llegar a tu ubicación.`,
        badgeColor: isNext ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-amber-500/20 text-amber-300',
        badgeText: isNext ? '¡Próxima Parada!' : 'En Camino',
        icon: '📍'
      };
    }

    return {
      key: 'programada',
      title: 'Ruta Programada para Hoy',
      description: `Hora estimada de recogida: ${parada?.hora_estimada.substring(0, 5) || '07:15 AM'}.`,
      badgeColor: 'bg-slate-800 text-slate-300 border border-slate-700',
      badgeText: 'Ruta Planificada',
      icon: '⏳'
    };
  };

  const status = getStudentStatus();

  // Distance from Van to Student House
  const distanceToStudentKm = vanLocation
    ? calculateHaversineDistance(vanLocation.lat, vanLocation.lng, alumno.lat, alumno.lng)
    : null;

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100 animate-fadeIn">
      {/* Top Parent Header */}
      <div className="border-b border-slate-800 bg-slate-900 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-xl border border-amber-500/40 text-amber-400">
              🎒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base text-slate-100">{alumno.nombre}</h2>
                <span className="rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                  ID: {alumno.id}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Representante: <span className="text-slate-200 font-medium">{alumno.representante?.nombre || 'Titular'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <button
              id="btn-parent-refresh"
              onClick={fetchLiveTracking}
              title="Actualizar posición"
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-300 border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>

            {/* Exit / Switch Student Button */}
            <button
              id="btn-parent-change-student"
              onClick={() => {
                localStorage.removeItem('rutaescolar_parent_student_id');
                if (onSignOut) {
                  onSignOut();
                } else {
                  onSelectAnotherStudent('');
                }
              }}
              title="Cerrar sesión / Ingresar otro ID de Alumno"
              className="flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-rose-400 border border-slate-700 hover:bg-slate-700 transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Student Quick Switcher for multi-child testing */}
        {allStudents.length > 1 && (
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-slate-400 shrink-0">Cambiar alumno rápido:</span>
            {allStudents.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectAnotherStudent(s.id)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  s.id === alumno.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.nombre.split(' ')[0]} ({s.id})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Status & Map Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* HERO STATUS CARD */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-4 sm:p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-2xl border border-slate-700 shadow-inner">
                {status.icon}
              </div>
              <div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-1 ${status.badgeColor}`}>
                  {status.badgeText}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-100">{status.title}</h3>
              </div>
            </div>

            {parada && (
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Hora Recogida</span>
                <span className="text-sm sm:text-base font-extrabold text-amber-400">
                  {parada.hora_estimada.substring(0, 5)}
                </span>
              </div>
            )}
          </div>

          <p className="mt-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
            {status.description}
          </p>

          {/* Live Proximity Metric */}
          {distanceToStudentKm !== null && ruta.estado === 'en_curso' && parada?.estado === 'pendiente' && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-amber-400 animate-spin" />
                <span>Distancia estimada del transporte:</span>
              </div>
              <b className="text-sm font-black text-amber-400">
                {distanceToStudentKm < 1 ? `${Math.round(distanceToStudentKm * 1000)} m` : `${distanceToStudentKm.toFixed(1)} km`}
              </b>
            </div>
          )}
        </div>

        {/* INTERACTIVE MAP */}
        <div className="h-[360px] sm:h-[420px] w-full">
          <SchoolRouteMap
            colegio={colegio}
            origen={{ lat: ruta.origen_lat, lng: ruta.origen_lng, direccion: ruta.origen_direccion }}
            paradas={ruta.paradas || []}
            alumnosMap={alumnosMap}
            vanLocation={vanLocation}
            polylineGeometry={ruta.polyline_geometry}
            highlightStudentId={alumno.id}
          />
        </div>

        {/* DETAILS & DIRECT DRIVER CONTACT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Pickup Address Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-amber-400" />
              Dirección de Recogida
            </span>
            <p className="text-xs font-semibold text-slate-200">{alumno.direccion_recogida}</p>
            <p className="text-[11px] text-slate-400">
              Parada #{parada?.orden || 1} en el orden del recorrido
            </p>
          </div>

          {/* School Target Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <School className="h-3.5 w-3.5 text-amber-400" />
              Destino Escolar
            </span>
            <p className="text-xs font-semibold text-slate-200">{colegio.nombre}</p>
            <p className="text-[11px] text-amber-400 font-medium">
              Hora límite de entrada: {colegio.hora_llegada_limite}
            </p>
          </div>
        </div>

        {/* Driver Phone Contact Bar */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-200 block">¿Tienes alguna novedad con el estudiante?</span>
            <span className="text-[11px] text-slate-400">Comunícate directamente con la unidad de transporte</span>
          </div>

          <a
            href="tel:+584121234599"
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md hover:bg-amber-400 transition-all shrink-0"
          >
            <Phone className="h-4 w-4" />
            <span>Llamar Conductor</span>
          </a>
        </div>
      </div>
    </div>
  );
};
