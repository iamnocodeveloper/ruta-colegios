/**
 * Mobile-First Driver Cockpit Component (Panel del Conductor PWA)
 * Designed for one-touch tactile operation while driving:
 *   - GPS watchPosition / simulated test driving
 *   - Prominent Next-Stop spotlight
 *   - Big "Recogido" and "Ausente" buttons
 *   - Real-time WhatsApp webhook dispatch
 *   - "Llegada a Escuela" batch completion
 *   - One-tap Waze & Google Maps navigation links
 */

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Navigation,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Play,
  CheckCheck,
  Phone,
  AlertCircle,
  Compass,
  MapPin,
  Clock,
  Users,
  FastForward,
  RotateCcw,
  Volume2
} from 'lucide-react';
import { Alumno, Colegio, ParadaRuta, RutaDiaria, TrackingLog } from '../../types';
import { SchoolRouteMap } from '../Map/SchoolRouteMap';
import { calculateHaversineDistance, formatFriendlyTime } from '../../services/routeCalculator';
import {
  recordTrackingInstant,
  updateParadaEstadoInstant,
  updateRutaEstadoInstant
} from '../../services/instantDb';

interface DriverPanelProps {
  ruta: RutaDiaria;
  colegio: Colegio;
  alumnosMap: Map<string, Alumno>;
  onUpdateRuta: (updatedRuta: RutaDiaria) => void;
}

export const DriverPanel: React.FC<DriverPanelProps> = ({
  ruta,
  colegio,
  alumnosMap,
  onUpdateRuta
}) => {
  const [vanLocation, setVanLocation] = useState<TrackingLog | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'cockpit' | 'map' | 'list'>('cockpit');
  const [lastActionFeedback, setLastActionFeedback] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const simStepRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  const paradas = ruta.paradas || [];
  
  // Find current active stop (first pending stop)
  const activeStopIndex = paradas.findIndex((p) => p.estado === 'pendiente');
  const currentStop: ParadaRuta | undefined = activeStopIndex !== -1 ? paradas[activeStopIndex] : undefined;
  const currentStudent: Alumno | undefined = currentStop ? (alumnosMap.get(currentStop.alumno_id) || currentStop.alumno) : undefined;

  // Counts
  const recogidosCount = paradas.filter((p) => p.estado === 'recogido').length;
  const completadosCount = paradas.filter((p) => p.estado === 'completado').length;
  const ausentesCount = paradas.filter((p) => p.estado === 'ausente').length;
  const totalAlumnos = paradas.length;
  const allStopsProcessed = paradas.every((p) => p.estado !== 'pendiente');

  // Handle Real GPS Geolocation Watcher
  useEffect(() => {
    if (ruta.estado === 'en_curso' && !isSimulating && 'geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newLoc: TrackingLog = {
            ruta_id: ruta.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            velocidad_kmh: pos.coords.speed ? pos.coords.speed * 3.6 : 0,
            rumbo_grados: pos.coords.heading || 0,
            timestamp: new Date().toISOString()
          };
          setVanLocation(newLoc);
          sendTrackingToServer(newLoc);
        },
        (err) => console.warn('GPS watch error:', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [ruta.estado, isSimulating]);

  // Handle Test-Drive Simulator along the real Polyline Geometry
  useEffect(() => {
    if (!isSimulating || ruta.estado !== 'en_curso') {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
      return;
    }

    const polyline = ruta.polyline_geometry || [
      [ruta.origen_lat, ruta.origen_lng],
      ...paradas.map((p) => [p.lat, p.lng] as [number, number]),
      [colegio.lat, colegio.lng]
    ];

    simulationTimerRef.current = setInterval(() => {
      if (polyline.length === 0) return;
      simStepRef.current = (simStepRef.current + 1) % polyline.length;
      const [lat, lng] = polyline[simStepRef.current];

      const simLoc: TrackingLog = {
        ruta_id: ruta.id,
        lat,
        lng,
        velocidad_kmh: 28 * simSpeed,
        rumbo_grados: (simStepRef.current * 20) % 360,
        timestamp: new Date().toISOString()
      };
      setVanLocation(simLoc);
      sendTrackingToServer(simLoc);
    }, 1200 / simSpeed);

    return () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    };
  }, [isSimulating, simSpeed, ruta.estado, ruta.polyline_geometry]);

  const sendTrackingToServer = async (loc: TrackingLog) => {
    try {
      // Record into InstantDB in real time
      recordTrackingInstant(ruta.id, loc.lat, loc.lng, loc.velocidad_kmh, loc.rumbo_grados).catch(() => {});

      await fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: ruta.id,
          lat: loc.lat,
          lng: loc.lng,
          velocidadKmh: loc.velocidad_kmh,
          rumboGrados: loc.rumbo_grados
        })
      });
    } catch {}
  };

  // Action: Iniciar Ruta
  const handleStartRoute = () => {
    const horaActual = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const updated: RutaDiaria = {
      ...ruta,
      estado: 'en_curso',
      hora_salida_real: horaActual
    };
    onUpdateRuta(updated);
    updateRutaEstadoInstant(ruta.id, 'en_curso', { hora_salida_real: horaActual }).catch(() => {});

    // Initial vehicle location at origin
    const initialLoc: TrackingLog = {
      ruta_id: ruta.id,
      lat: ruta.origen_lat,
      lng: ruta.origen_lng,
      velocidad_kmh: 0,
      timestamp: new Date().toISOString()
    };
    setVanLocation(initialLoc);
    sendTrackingToServer(initialLoc);

    showFeedback('🚀 ¡Ruta iniciada! Seguimiento GPS activo.');
  };

  // Action: Marcar Alumno como Recogido
  const handleMarkStudentPickedUp = async () => {
    if (!currentStop || !currentStudent || isProcessingAction) return;
    setIsProcessingAction(true);

    const horaActual = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // 1. Update stop state
    const updatedParadas = ruta.paradas.map((p) => {
      if (p.id === currentStop.id) {
        return { ...p, estado: 'recogido' as const, hora_real: horaActual };
      }
      return p;
    });

    const updatedRuta: RutaDiaria = {
      ...ruta,
      paradas: updatedParadas
    };
    onUpdateRuta(updatedRuta);
    updateParadaEstadoInstant(currentStop.id, 'recogido', horaActual).catch(() => {});

    showFeedback(`✅ ${currentStudent.nombre} marcado como RECOGIDO.`);
    setIsProcessingAction(false);
  };

  // Action: Marcar Alumno como Ausente
  const handleMarkStudentAbsent = async () => {
    if (!currentStop || !currentStudent || isProcessingAction) return;
    setIsProcessingAction(true);

    const horaActual = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const updatedParadas = ruta.paradas.map((p) => {
      if (p.id === currentStop.id) {
        return { ...p, estado: 'ausente' as const, hora_real: horaActual };
      }
      return p;
    });

    const updatedRuta: RutaDiaria = {
      ...ruta,
      paradas: updatedParadas
    };
    onUpdateRuta(updatedRuta);
    updateParadaEstadoInstant(currentStop.id, 'ausente', horaActual).catch(() => {});

    showFeedback(`⚠️ ${currentStudent.nombre} marcado como AUSENTE.`);
    setIsProcessingAction(false);
  };

  // Action: Llegada a la Escuela y Finalizar Ruta
  const handleFinishAtSchool = async () => {
    setIsProcessingAction(true);
    const horaActual = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Mark all onboard students as "completado"
    const updatedParadas = ruta.paradas.map((p) => {
      if (p.estado === 'recogido') {
        updateParadaEstadoInstant(p.id, 'completado', horaActual).catch(() => {});
        return { ...p, estado: 'completado' as const, hora_real: horaActual };
      }
      return p;
    });

    const updatedRuta: RutaDiaria = {
      ...ruta,
      estado: 'completada',
      hora_llegada_real: horaActual,
      paradas: updatedParadas
    };
    onUpdateRuta(updatedRuta);
    updateRutaEstadoInstant(ruta.id, 'completada', { hora_llegada_real: horaActual }).catch(() => {});

    // Confetti effect
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch {}

    setIsSimulating(false);
    showFeedback(`🎉 ¡Llegada exitosa a ${colegio.nombre}! Ruta finalizada.`);
    setIsProcessingAction(false);
  };

  const showFeedback = (msg: string) => {
    setLastActionFeedback(msg);
    setTimeout(() => setLastActionFeedback(null), 5000);
  };

  // Navigation Links
  const getGoogleMapsNavUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  const getWazeNavUrl = (lat: number, lng: number) =>
    `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      {/* Top Status Cockpit Bar */}
      <div className="border-b border-slate-800 bg-slate-900/90 px-4 py-3 shadow-md backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20">
              🚐
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base text-slate-100">Modo Conductor</h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    ruta.estado === 'en_curso'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                      : ruta.estado === 'completada'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                  {ruta.estado === 'en_curso' ? 'En Curso' : ruta.estado === 'completada' ? 'Finalizada' : 'Planificada'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-none">
                Destino: <span className="text-slate-200 font-semibold">{colegio.nombre}</span> (Meta: {colegio.hora_llegada_limite.substring(0, 5)})
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-center border border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">A Bordo</span>
              <span className="text-xs sm:text-sm font-extrabold text-amber-400">
                {recogidosCount + completadosCount} / {totalAlumnos}
              </span>
            </div>
          </div>
        </div>

        {/* Inverse Departure Time Banner */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/60 p-2 text-xs border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span>Salida calculada: <b className="text-amber-400">{ruta.hora_salida_estimada}</b></span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Manejo: <b className="text-slate-200">{ruta.tiempo_manejo_estimado_min} min</b></span>
            <span>Abordaje: <b className="text-slate-200">{ruta.tiempo_abordaje_total_min} min</b></span>
            <span>Distancia: <b className="text-slate-200">{ruta.distancia_total_km} km</b></span>
          </div>
        </div>

        {/* Feedback Alert Pill */}
        {lastActionFeedback && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-950/80 border border-emerald-600/50 p-2 text-xs text-emerald-200 animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{lastActionFeedback}</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs for Mobile */}
      <div className="flex border-b border-slate-800 bg-slate-900/50 px-2 text-xs font-semibold">
        <button
          id="tab-driver-cockpit"
          onClick={() => setActiveTab('cockpit')}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'cockpit'
              ? 'border-amber-400 text-amber-400 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="h-4 w-4" />
          <span>Cabina de Mando</span>
        </button>
        <button
          id="tab-driver-map"
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'map'
              ? 'border-amber-400 text-amber-400 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="h-4 w-4" />
          <span>Mapa en Vivo</span>
        </button>
        <button
          id="tab-driver-list"
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'list'
              ? 'border-amber-400 text-amber-400 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Lista Paradas ({paradas.length})</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* VIEW 1: COCKPIT (Next Stop Spotlight & Tactile Buttons) */}
        {activeTab === 'cockpit' && (
          <div className="mx-auto max-w-xl space-y-4">
            {/* If route is NOT started yet */}
            {ruta.estado === 'planificada' && (
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-900 to-amber-950/20 p-6 text-center shadow-xl">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-3xl text-amber-400 border border-amber-500/40 shadow-inner">
                  🚍
                </div>
                <h3 className="text-xl font-black text-slate-100">¿Listo para salir a la ruta?</h3>
                <p className="mt-1 text-sm text-slate-400">
                  La hora sugerida de salida es a las <b className="text-amber-400">{ruta.hora_salida_estimada}</b> para llegar a las <b className="text-amber-400">{colegio.hora_llegada_limite.substring(0, 5)}</b>.
                </p>

                <div className="mt-5 flex flex-col gap-3">
                  <button
                    id="btn-start-route-main"
                    onClick={handleStartRoute}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-amber-500 py-4 text-base font-black text-slate-950 shadow-lg shadow-amber-500/30 transition-all hover:bg-amber-400 active:scale-[0.98]"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    <span>INICIAR RUTA Y ACTIVAR GPS</span>
                  </button>
                </div>
              </div>
            )}

            {/* If route is IN PROGRESS */}
            {ruta.estado === 'en_curso' && (
              <>
                {/* ACTIVE STOP CARD */}
                {currentStop && currentStudent ? (
                  <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500 bg-slate-900 shadow-2xl p-5">
                    {/* Glowing highlight indicator */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 animate-pulse"></div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 font-black text-xl shadow-md">
                          #{currentStop.orden}
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                            Siguiente Parada
                          </span>
                          <h3 className="text-lg sm:text-xl font-black text-slate-100">
                            {currentStudent.nombre}
                          </h3>
                          <p className="text-xs text-slate-400">{currentStudent.grado || 'Estudiante'}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">Hora Estimada</span>
                        <span className="text-sm sm:text-base font-extrabold text-amber-400">
                          {currentStop.hora_estimada.substring(0, 5)}
                        </span>
                      </div>
                    </div>

                    {/* Address & Note */}
                    <div className="mt-4 rounded-xl bg-slate-950/80 p-3 border border-slate-800 space-y-1.5">
                      <div className="flex items-start gap-2 text-xs text-slate-300">
                        <MapPin className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{currentStudent.direccion_recogida}</span>
                      </div>
                      {currentStudent.notas_medicas && (
                        <div className="flex items-start gap-2 text-[11px] text-amber-300/90 pt-1 border-t border-slate-800/80">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>Nota: {currentStudent.notas_medicas}</span>
                        </div>
                      )}
                    </div>

                    {/* Representative Contact & Navigation shortcuts */}
                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">Representante:</span>
                        <span className="font-semibold text-slate-200">{currentStudent.representante?.nombre}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Waze Link */}
                        <a
                          href={getWazeNavUrl(currentStop.lat, currentStop.lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-sky-950 px-2.5 py-1.5 text-[11px] font-bold text-sky-400 border border-sky-700/50 hover:bg-sky-900 transition-all"
                        >
                          <Navigation className="h-3 w-3" />
                          <span>Waze</span>
                        </a>

                        {/* Google Maps Link */}
                        <a
                          href={getGoogleMapsNavUrl(currentStop.lat, currentStop.lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 border border-slate-700 hover:bg-slate-700 transition-all"
                        >
                          <Navigation className="h-3 w-3" />
                          <span>Maps</span>
                        </a>

                        {/* Direct Call Button */}
                        {currentStudent.representante?.telefono_whatsapp && (
                          <a
                            href={`tel:${currentStudent.representante.telefono_whatsapp}`}
                            className="flex items-center gap-1 rounded-lg bg-emerald-950 px-2.5 py-1.5 text-[11px] font-bold text-emerald-400 border border-emerald-700/50 hover:bg-emerald-900 transition-all"
                          >
                            <Phone className="h-3 w-3" />
                            <span>Llamar</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* BIG TACTILE ACTION BUTTONS */}
                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Recogido */}
                      <button
                        id="btn-mark-picked-up"
                        disabled={isProcessingAction}
                        onClick={handleMarkStudentPickedUp}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 px-4 text-base font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        <span>MARCAR RECOGIDO</span>
                      </button>

                      {/* Ausente */}
                      <button
                        id="btn-mark-absent"
                        disabled={isProcessingAction}
                        onClick={handleMarkStudentAbsent}
                        className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3.5 px-4 text-sm font-bold text-rose-400 border border-rose-500/30 hover:bg-rose-950/40 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>NO PRESENTE / AUSENTE</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ALL STOPS PICKED UP -> PROCEED TO SCHOOL */
                  <div className="rounded-2xl border-2 border-emerald-500 bg-slate-900 p-6 text-center shadow-2xl">
                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl text-emerald-400 border border-emerald-500/40">
                      🏫
                    </div>
                    <h3 className="text-xl font-black text-slate-100">¡Todas las paradas completadas!</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      Rumbo final hacia <b className="text-amber-400">{colegio.nombre}</b>.
                      Alumnos a bordo: <b className="text-emerald-400">{recogidosCount}</b>.
                    </p>

                    <div className="mt-5">
                      <button
                        id="btn-finish-at-school"
                        disabled={isProcessingAction}
                        onClick={handleFinishAtSchool}
                        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 text-base font-black text-slate-950 shadow-xl shadow-emerald-500/30 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <CheckCheck className="h-5 w-5" />
                        <span>LLEGADA A ESCUELA / FINALIZAR RUTA</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* If route is COMPLETED */}
            {ruta.estado === 'completada' && (
              <div className="rounded-2xl border border-sky-500/30 bg-slate-900 p-6 text-center shadow-xl">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/20 text-3xl text-sky-400">
                  🎉
                </div>
                <h3 className="text-xl font-black text-slate-100">Ruta Escolar Finalizada con Éxito</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Llegada registrada a las <b className="text-sky-400">{ruta.hora_llegada_real || '--:--'}</b>. Ruta completada exitosamente.
                </p>

                <div className="mt-4 flex justify-center gap-3">
                  <button
                    id="btn-restart-route"
                    onClick={() => {
                      const resetParadas = ruta.paradas.map((p) => ({ ...p, estado: 'pendiente' as const, hora_real: undefined }));
                      onUpdateRuta({ ...ruta, estado: 'planificada', hora_salida_real: undefined, hora_llegada_real: undefined, paradas: resetParadas });
                    }}
                    className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reiniciar para otra prueba</span>
                  </button>
                </div>
              </div>
            )}

            {/* Test Drive Simulation Panel */}
            <div className="rounded-xl bg-slate-900/60 p-3.5 border border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FastForward className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">Simulador de Movimiento GPS</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="btn-toggle-simulation"
                    onClick={() => {
                      if (ruta.estado !== 'en_curso') {
                        handleStartRoute();
                      }
                      setIsSimulating(!isSimulating);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      isSimulating
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {isSimulating ? 'Pausar Simulación' : 'Simular Manejo'}
                  </button>

                  {isSimulating && (
                    <div className="flex items-center gap-1">
                      {[1, 2, 5].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setSimSpeed(spd)}
                          className={`h-6 w-6 rounded text-[10px] font-bold ${
                            simSpeed === spd ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {isSimulating
                  ? 'Simulando vehículo avanzando por la ruta en tiempo real...'
                  : 'Prueba la experiencia de manejo interactivo sin necesidad de salir a la calle.'}
              </p>
            </div>
          </div>
        )}

        {/* VIEW 2: MAP VIEW */}
        {activeTab === 'map' && (
          <div className="h-[520px] w-full">
            <SchoolRouteMap
              colegio={colegio}
              origen={{ lat: ruta.origen_lat, lng: ruta.origen_lng, direccion: ruta.origen_direccion }}
              paradas={paradas}
              alumnosMap={alumnosMap}
              vanLocation={vanLocation}
              polylineGeometry={ruta.polyline_geometry}
              activeStopIndex={activeStopIndex}
            />
          </div>
        )}

        {/* VIEW 3: FULL STOP LIST */}
        {activeTab === 'list' && (
          <div className="mx-auto max-w-xl space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Secuencia Óptima de Recogida</span>
              <span>{paradas.length} Paradas</span>
            </div>

            {paradas.map((p, idx) => {
              const student = alumnosMap.get(p.alumno_id) || p.alumno;
              const isCurrent = activeStopIndex === idx;

              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-3 rounded-xl p-3 border transition-all ${
                    isCurrent
                      ? 'border-amber-500 bg-amber-500/10 shadow-lg'
                      : p.estado === 'recogido'
                      ? 'border-emerald-500/40 bg-emerald-950/20'
                      : p.estado === 'ausente'
                      ? 'border-rose-500/40 bg-rose-950/20 opacity-70'
                      : 'border-slate-800 bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                        p.estado === 'recogido'
                          ? 'bg-emerald-500 text-slate-950'
                          : p.estado === 'ausente'
                          ? 'bg-rose-500 text-white'
                          : isCurrent
                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {p.orden}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{student?.nombre || 'Alumno'}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                            p.estado === 'recogido'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : p.estado === 'ausente'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {p.estado === 'recogido' ? 'A Bordo' : p.estado === 'ausente' ? 'Ausente' : 'Pendiente'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                        {student?.direccion_recogida}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-400 block">{p.hora_estimada.substring(0, 5)}</span>
                    {p.distancia_desde_anterior_km !== undefined && (
                      <span className="text-[10px] text-slate-400">{p.distancia_desde_anterior_km} km</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
