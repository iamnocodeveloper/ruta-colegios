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
  Volume2,
  Truck,
  UserCheck,
  Shield,
  Car,
  Mail,
  Sun,
  Sunset
} from 'lucide-react';
import { Alumno, Colegio, Conductor, ParadaRuta, RutaDiaria, TrackingLog } from '../../types';
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
  conductores?: Conductor[];
  currentDriverId?: string;
  onSelectDriver?: (driverId: string) => void;
  onUpdateRuta: (updatedRuta: RutaDiaria) => void;
}

export const DriverPanel: React.FC<DriverPanelProps> = ({
  ruta,
  colegio,
  alumnosMap,
  conductores = [],
  currentDriverId,
  onSelectDriver,
  onUpdateRuta
}) => {
  const [vanLocation, setVanLocation] = useState<TrackingLog | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'cockpit' | 'map' | 'list' | 'profile'>('cockpit');
  const [lastActionFeedback, setLastActionFeedback] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Active Conductor for this view
  const assignedConductor: Conductor | undefined =
    conductores.find((c) => c.id === currentDriverId) ||
    conductores.find((c) => c.id === ruta.conductor_id) ||
    ruta.conductor ||
    (conductores.length > 0 ? conductores[0] : undefined);

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

  // Action: Reiniciar / Reabrir Ruta para Nueva Jornada Diaria
  const handleResetDailyRoute = (startImmediately: boolean = false) => {
    setIsProcessingAction(true);
    const todayStr = new Date().toISOString().substring(0, 10);
    const horaActual = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Reset all stops to "pendiente" and clear previous timestamps
    const resetParadas: ParadaRuta[] = ruta.paradas.map((p) => {
      updateParadaEstadoInstant(p.id, 'pendiente').catch(() => {});
      return {
        ...p,
        estado: 'pendiente' as const,
        hora_real: undefined
      };
    });

    const newEstado = startImmediately ? ('en_curso' as const) : ('planificada' as const);

    const updatedRuta: RutaDiaria = {
      ...ruta,
      fecha: todayStr,
      estado: newEstado,
      hora_salida_real: startImmediately ? horaActual : undefined,
      hora_llegada_real: undefined,
      paradas: resetParadas
    };

    onUpdateRuta(updatedRuta);
    updateRutaEstadoInstant(ruta.id, newEstado, {
      hora_salida_real: startImmediately ? horaActual : null,
      hora_llegada_real: null
    }).catch(() => {});

    if (startImmediately) {
      const initialLoc: TrackingLog = {
        ruta_id: ruta.id,
        lat: ruta.origen_lat,
        lng: ruta.origen_lng,
        velocidad_kmh: 0,
        timestamp: new Date().toISOString()
      };
      setVanLocation(initialLoc);
      sendTrackingToServer(initialLoc);
      showFeedback(`🚀 ¡Ruta de hoy (${todayStr}) iniciada! Todas las paradas listas.`);
    } else {
      showFeedback(`📅 Ruta reabierta para hoy (${todayStr}). Lista para iniciar cuando salgas.`);
    }

    setIsSimulating(false);
    setIsProcessingAction(false);
  };

  // Action: Cambiar estado manual de una parada individual desde la lista
  const handleManualChangeStopStatus = (stopId: string, newStatus: 'pendiente' | 'recogido' | 'ausente' | 'completado') => {
    const horaActual = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const updatedParadas = ruta.paradas.map((p) => {
      if (p.id === stopId) {
        return {
          ...p,
          estado: newStatus,
          hora_real: newStatus === 'pendiente' ? undefined : horaActual
        };
      }
      return p;
    });

    const updatedRuta: RutaDiaria = {
      ...ruta,
      paradas: updatedParadas
    };
    onUpdateRuta(updatedRuta);
    updateParadaEstadoInstant(stopId, newStatus, newStatus === 'pendiente' ? undefined : horaActual).catch(() => {});
    showFeedback(`Parada actualizada a: ${newStatus.toUpperCase()}`);
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
    <div className="flex h-full flex-col bg-canvas text-ink">
      {/* Top Status Cockpit Bar */}
      <div className="border-b border-line bg-surface px-4 py-3 shadow-md backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20">
              🚐
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base text-ink">Modo Conductor</h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    ruta.estado === 'en_curso'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse'
                      : ruta.estado === 'completada'
                      ? 'bg-primary/20 text-primary border border-primary/40'
                      : 'bg-primary/10 text-primary border border-primary/30'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                  {ruta.estado === 'en_curso' ? 'En Curso' : ruta.estado === 'completada' ? 'Finalizada' : 'Planificada'}
                </span>

                {/* Quick daily re-open button directly in the header */}
                {ruta.estado === 'completada' && (
                  <button
                    onClick={() => handleResetDailyRoute(false)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/30 text-primary border border-primary/30 px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer"
                    title="Reabrir esta ruta para un nuevo día o jornada"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reabrir para Hoy</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-muted truncate max-w-[200px] sm:max-w-none">
                Destino: <span className="text-ink font-semibold">{colegio.nombre}</span> (Meta: {(ruta.hora_llegada_objetivo || colegio.hora_llegada_limite || '08:00').substring(0, 5)})
              </p>
            </div>
          </div>

          {/* Quick Metrics & Driver Info */}
          <div className="flex items-center gap-2">
            {assignedConductor && (
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="hidden sm:flex items-center gap-2 rounded-xl bg-soft-gray px-2.5 py-1.5 border border-line hover:border-primary/40 hover:bg-soft-gray transition-all cursor-pointer text-left"
                title="Ver Perfil y Ruta Asignada"
              >
                <div className="h-7 w-7 rounded-lg overflow-hidden bg-surface border border-line shrink-0">
                  {assignedConductor.foto_url ? (
                    <img
                      src={assignedConductor.foto_url}
                      alt={assignedConductor.nombre}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-black text-primary text-xs">
                      {assignedConductor.nombre.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="text-[11px] leading-tight">
                  <span className="font-bold text-ink block truncate max-w-[90px]">
                    {assignedConductor.nombre.split(' ')[0]}
                  </span>
                  <span className="text-[9px] font-mono text-primary">
                    {assignedConductor.vehiculo_placa || 'En Ruta'}
                  </span>
                </div>
              </button>
            )}

            <div className="rounded-lg bg-soft-gray px-2.5 py-1.5 text-center border border-line">
              <span className="text-[10px] uppercase font-bold text-muted block leading-tight">A Bordo</span>
              <span className="text-xs sm:text-sm font-extrabold text-primary">
                {recogidosCount + completadosCount} / {totalAlumnos}
              </span>
            </div>
          </div>
        </div>

        {/* Inverse Departure Time Banner */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-soft-gray p-2 text-xs border border-line">
          <div className="flex items-center gap-1.5 text-ink">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Salida calculada: <b className="text-primary">{ruta.hora_salida_estimada}</b></span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span>Manejo: <b className="text-ink">{ruta.tiempo_manejo_estimado_min} min</b></span>
            <span>Abordaje: <b className="text-ink">{ruta.tiempo_abordaje_total_min} min</b></span>
            <span>Distancia: <b className="text-ink">{ruta.distancia_total_km} km</b></span>
          </div>
        </div>

        {/* Feedback Alert Pill */}
        {lastActionFeedback && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-600 animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{lastActionFeedback}</span>
          </div>
        )}
      </div>

      {/* Navigation Tabs for Mobile */}
      <div className="flex border-b border-line bg-soft-gray px-2 text-xs font-semibold">
        <button
          id="tab-driver-cockpit"
          onClick={() => setActiveTab('cockpit')}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'cockpit'
              ? 'border-primary/40 text-primary bg-primary/10'
              : 'border-transparent text-muted hover:text-ink'
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
              ? 'border-primary/40 text-primary bg-primary/10'
              : 'border-transparent text-muted hover:text-ink'
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
              ? 'border-primary/40 text-primary bg-primary/10'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Lista Paradas ({paradas.length})</span>
        </button>

        <button
          id="tab-driver-profile"
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2.5 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'profile'
              ? 'border-primary/40 text-primary bg-primary/10'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Mi Perfil & Ruta</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* VIEW 1: COCKPIT (Next Stop Spotlight & Tactile Buttons) */}
        {activeTab === 'cockpit' && (
          <div className="mx-auto max-w-xl space-y-4">
            {/* If route is NOT started yet */}
            {ruta.estado === 'planificada' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-slate-900 to-amber-950/20 p-6 text-center shadow-xl space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl text-primary border border-primary/30 shadow-inner">
                    🚍
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary block mb-1">
                      Jornada Escolar: {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                    <h3 className="text-xl font-black text-ink">¿Listo para iniciar el recorrido de hoy?</h3>
                    <p className="mt-1 text-sm text-muted">
                      Hora de salida sugerida: <b className="text-primary">{ruta.hora_salida_estimada}</b>. Meta de llegada a {colegio.nombre}: <b className="text-primary">{(ruta.hora_llegada_objetivo || colegio.hora_llegada_limite || '08:00').substring(0, 5)}</b>.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-soft-gray p-3 rounded-xl border border-line">
                    <div>
                      <span className="text-[10px] text-muted block uppercase font-bold">Total Alumnos</span>
                      <span className="font-extrabold text-ink text-sm">{totalAlumnos}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block uppercase font-bold">Tiempo Estimado</span>
                      <span className="font-extrabold text-primary text-sm">{ruta.tiempo_total_estimado_min || ruta.tiempo_manejo_estimado_min} min</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block uppercase font-bold">Distancia Total</span>
                      <span className="font-extrabold text-primary text-sm">{ruta.distancia_total_km || 0} km</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2.5">
                    <button
                      id="btn-start-route-main"
                      onClick={handleStartRoute}
                      className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary py-4 text-base font-black text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary active:scale-[0.98] cursor-pointer"
                    >
                      <Play className="h-5 w-5 fill-current" />
                      <span>INICIAR RUTA Y ACTIVAR GPS EN VIVO</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('map')}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-soft-gray py-2.5 text-xs font-bold text-ink border border-line hover:bg-line transition-all cursor-pointer"
                    >
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>Ver Mapa y Trazado de Paradas</span>
                    </button>
                  </div>
                </div>

                {/* Pre-Departure Stops Sequence Preview */}
                <div className="rounded-2xl border border-line bg-surface p-4 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-ink">
                        Secuencia Planificada de Paradas ({paradas.length} Estudiantes)
                      </h4>
                    </div>
                    <span className="text-[10px] text-primary font-mono font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/25">
                      Ruta Guardada
                    </span>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {/* Origin item */}
                    <div className="flex items-center gap-3 rounded-xl bg-soft-gray p-2.5 border border-line/80 text-xs">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary font-bold text-xs border border-primary/25">
                        🏁
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-primary block truncate">
                          Base de Salida / Garaje
                        </span>
                        <span className="text-[10px] text-muted block truncate">
                          {ruta.origen_direccion || 'Punto de partida del transporte'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-muted font-bold">
                        {ruta.hora_salida_estimada?.substring(0, 5)}
                      </span>
                    </div>

                    {/* Stops items */}
                    {paradas.map((p, idx) => {
                      const student = alumnosMap.get(p.alumno_id) || p.alumno;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-xl bg-soft-gray p-2.5 border border-line text-xs hover:border-line transition-all"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-black text-xs border border-primary/25">
                            #{p.orden || idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-ink block truncate">
                              {student?.nombre || `Estudiante #${p.orden}`}
                            </span>
                            <span className="text-[10px] text-muted block truncate">
                              {student?.direccion_recogida || 'Dirección guardada'}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-primary font-bold shrink-0">
                            {p.hora_estimada?.substring(0, 5)}
                          </span>
                        </div>
                      );
                    })}

                    {/* Destination item */}
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-50/30 p-2.5 border border-emerald-200 text-xs">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-200">
                        🏫
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-emerald-600 block truncate">
                          {colegio.nombre}
                        </span>
                        <span className="text-[10px] text-muted block truncate">
                          Destino final de la jornada
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-600 font-bold">
                        {(ruta.hora_llegada_objetivo || colegio.hora_llegada_limite || '08:00').substring(0, 5)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* If route is IN PROGRESS */}
            {ruta.estado === 'en_curso' && (
              <>
                {/* Transit Status Bar */}
                <div className="flex items-center justify-between gap-2 rounded-xl bg-surface border border-primary/30 p-3 text-xs shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    <div>
                      <span className="font-black text-ink uppercase tracking-wider text-[11px]">
                        Ruta en Progreso
                      </span>
                      <p className="text-[10px] text-muted">
                        Salida registrada: <b className="text-primary">{ruta.hora_salida_real || '--:--'}</b>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg border border-emerald-800/60">
                      {recogidosCount}/{totalAlumnos} a bordo
                    </span>
                    {ausentesCount > 0 && (
                      <span className="text-[10px] font-bold bg-rose-50 text-alert px-2 py-1 rounded-lg border border-rose-200">
                        {ausentesCount} ausentes
                      </span>
                    )}
                  </div>
                </div>

                {/* ACTIVE STOP SPOTLIGHT CARD */}
                {currentStop && currentStudent ? (
                  <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-surface shadow-2xl p-5">
                    {/* Glowing highlight indicator */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 animate-pulse"></div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white font-black text-xl shadow-md">
                          #{currentStop.orden}
                        </div>
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                            <span className="inline-block h-2 w-2 rounded-full bg-primary animate-ping"></span>
                            <span>Siguiente Parada Activa</span>
                          </span>
                          <h3 className="text-lg sm:text-xl font-black text-ink">
                            {currentStudent.nombre}
                          </h3>
                          <p className="text-xs text-muted">{currentStudent.grado || 'Estudiante'}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-muted block">Hora Estimada</span>
                        <span className="text-sm sm:text-base font-extrabold text-primary">
                          {currentStop.hora_estimada.substring(0, 5)}
                        </span>
                      </div>
                    </div>

                    {/* Address & Note */}
                    <div className="mt-4 rounded-xl bg-soft-gray p-3 border border-line space-y-1.5">
                      <div className="flex items-start gap-2 text-xs text-ink">
                        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{currentStudent.direccion_recogida}</span>
                      </div>
                      {currentStudent.notas_medicas && (
                        <div className="flex items-start gap-2 text-[11px] text-primary/90 pt-1 border-t border-line/80">
                          <AlertCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span>Nota: {currentStudent.notas_medicas}</span>
                        </div>
                      )}
                    </div>

                    {/* Representative Contact & Navigation shortcuts */}
                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-[11px]">Representante:</span>
                        <span className="font-semibold text-ink">{currentStudent.representante?.nombre}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Waze Link */}
                        <a
                          href={getWazeNavUrl(currentStop.lat, currentStop.lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-sky-950 px-2.5 py-1.5 text-[11px] font-bold text-primary border border-sky-700/50 hover:bg-sky-900 transition-all cursor-pointer"
                        >
                          <Navigation className="h-3 w-3" />
                          <span>Waze</span>
                        </a>

                        {/* Google Maps Link */}
                        <a
                          href={getGoogleMapsNavUrl(currentStop.lat, currentStop.lng)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-soft-gray px-2.5 py-1.5 text-[11px] font-bold text-ink border border-line hover:bg-line transition-all cursor-pointer"
                        >
                          <Navigation className="h-3 w-3" />
                          <span>Maps</span>
                        </a>

                        {/* Direct Call Button */}
                        {currentStudent.representante?.telefono_whatsapp && (
                          <a
                            href={`tel:${currentStudent.representante.telefono_whatsapp}`}
                            className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 border border-emerald-700/50 hover:bg-emerald-900 transition-all cursor-pointer"
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
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 px-4 text-base font-black text-ink shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        <span>MARCAR RECOGIDO</span>
                      </button>

                      {/* Ausente */}
                      <button
                        id="btn-mark-absent"
                        disabled={isProcessingAction}
                        onClick={handleMarkStudentAbsent}
                        className="flex items-center justify-center gap-2 rounded-xl bg-soft-gray py-3.5 px-4 text-sm font-bold text-alert border border-rose-200 hover:bg-rose-50 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>NO PRESENTE / AUSENTE</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ALL STOPS PICKED UP -> PROCEED TO SCHOOL */
                  <div className="rounded-2xl border-2 border-emerald-500 bg-surface p-6 text-center shadow-2xl space-y-4">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl text-emerald-600 border border-emerald-200">
                      🏫
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-ink">¡Todas las paradas completadas!</h3>
                      <p className="mt-1 text-sm text-ink">
                        Rumbo final hacia <b className="text-primary">{colegio.nombre}</b>.
                        Alumnos a bordo: <b className="text-emerald-600">{recogidosCount}</b>.
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        id="btn-finish-at-school"
                        disabled={isProcessingAction}
                        onClick={handleFinishAtSchool}
                        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 text-base font-black text-ink shadow-xl shadow-emerald-500/30 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <CheckCheck className="h-5 w-5" />
                        <span>LLEGADA A ESCUELA / FINALIZAR RUTA</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* JOURNEY PROGRESS TIMELINE & UPCOMING STOPS */}
                <div className="rounded-2xl border border-line bg-surface p-4 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-ink flex items-center gap-2">
                      <Compass className="h-4 w-4 text-primary" />
                      <span>Secuencia del Recorrido ({paradas.length} Paradas)</span>
                    </h4>
                    <span className="text-[10px] text-muted font-mono">
                      {paradas.filter((p) => p.estado === 'pendiente').length} restantes
                    </span>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {/* Origin step */}
                    <div className="flex items-center gap-3 rounded-xl bg-soft-gray p-2.5 border border-primary/25 text-xs">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary font-bold text-xs border border-primary/40">
                        🏁
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">Base de Salida</span>
                          <span className="text-[9px] font-bold bg-sky-950 text-primary px-1.5 py-0.2 rounded border border-sky-800/50">
                            Salida Registrada
                          </span>
                        </div>
                        <span className="text-[10px] text-muted block truncate">
                          {ruta.origen_direccion || 'Garaje'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-primary font-bold">
                        {ruta.hora_salida_real || ruta.hora_salida_estimada}
                      </span>
                    </div>

                    {/* Each stop in order */}
                    {paradas.map((p, idx) => {
                      const student = alumnosMap.get(p.alumno_id) || p.alumno;
                      const isCurrent = currentStop?.id === p.id;
                      const isPickedUp = p.estado === 'recogido' || p.estado === 'completado';
                      const isAbsent = p.estado === 'ausente';
                      const isPending = p.estado === 'pendiente';

                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 rounded-xl p-2.5 border transition-all text-xs ${
                            isCurrent
                              ? 'bg-primary/10 border-primary/40 shadow-md ring-1 ring-primary/30'
                              : isPickedUp
                              ? 'bg-emerald-50/20 border-emerald-200 opacity-80'
                              : isAbsent
                              ? 'bg-rose-50 border-rose-200 opacity-70'
                              : 'bg-soft-gray border-line'
                          }`}
                        >
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-black text-xs ${
                              isCurrent
                                ? 'bg-primary text-white shadow'
                                : isPickedUp
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : isAbsent
                                ? 'bg-rose-50 text-alert border border-rose-200'
                                : 'bg-soft-gray text-muted'
                            }`}
                          >
                            #{p.orden || idx + 1}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold truncate ${isCurrent ? 'text-primary' : 'text-ink'}`}>
                                {student?.nombre || `Estudiante #${p.orden}`}
                              </span>
                              {isCurrent && (
                                <span className="text-[9px] font-black uppercase bg-primary text-white px-1.5 py-0.2 rounded animate-pulse">
                                  En Camino
                                </span>
                              )}
                              {isPickedUp && (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  ✓ A Bordo
                                </span>
                              )}
                              {isAbsent && (
                                <span className="text-[9px] font-bold text-alert bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  ✗ Ausente
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted block truncate">
                              {student?.direccion_recogida}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`text-[11px] font-mono font-bold block ${isCurrent ? 'text-primary' : 'text-muted'}`}>
                              {p.hora_real ? p.hora_real.substring(0, 5) : p.hora_estimada.substring(0, 5)}
                            </span>
                            {p.hora_real && (
                              <span className="text-[9px] text-muted block">Real</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* School destination step */}
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-50/20 p-2.5 border border-emerald-200 text-xs">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-200">
                        🏫
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-emerald-600 block truncate">
                          {colegio.nombre}
                        </span>
                        <span className="text-[10px] text-muted block truncate">
                          Destino final de entrega
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-600 font-bold">
                        {(ruta.hora_llegada_objetivo || colegio.hora_llegada_limite || '08:00').substring(0, 5)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* If route is COMPLETED */}
            {ruta.estado === 'completada' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-primary/40 bg-gradient-to-b from-slate-900 to-sky-950/20 p-6 text-center shadow-xl space-y-5">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-3xl text-primary border border-primary/40 shadow-inner">
                    🎉
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/25">
                      Jornada Completada con Éxito
                    </span>
                    <h3 className="text-xl font-black text-ink mt-2">Ruta Escolar Finalizada</h3>
                    <p className="mt-1 text-sm text-muted">
                      Llegada registrada a las <b className="text-primary">{ruta.hora_llegada_real || '--:--'}</b> a {colegio.nombre}.
                    </p>
                  </div>

                  {/* Metrics pill */}
                  <div className="grid grid-cols-3 gap-2 bg-soft-gray p-3 rounded-xl border border-line text-xs">
                    <div>
                      <span className="text-[10px] text-muted uppercase font-bold block">Salida</span>
                      <span className="font-extrabold text-ink">{ruta.hora_salida_real || '--:--'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase font-bold block">Llegada</span>
                      <span className="font-extrabold text-primary">{ruta.hora_llegada_real || '--:--'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase font-bold block">Alumnos</span>
                      <span className="font-extrabold text-emerald-600">{recogidosCount + completadosCount}/{totalAlumnos}</span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-primary/10 border border-primary/25 p-3 text-left">
                    <div className="flex items-start gap-2 text-xs text-primary">
                      <RotateCcw className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <b className="font-bold text-primary">Ruta Permanente Diaria:</b> Esta ruta con sus {totalAlumnos} paradas permanece guardada para tu uso diario. Puedes reiniciar el recorrido y ejecutarla nuevamente de inmediato.
                      </div>
                    </div>
                  </div>

                  {/* Daily Reopening Actions */}
                  <div className="space-y-2.5 pt-1">
                    <button
                      id="btn-restart-and-start-route"
                      disabled={isProcessingAction}
                      onClick={() => handleResetDailyRoute(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-ink hover:bg-primary active:scale-[0.98] transition-all shadow-lg shadow-primary/20 cursor-pointer"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>INICIAR NUEVO RECORRIDO PARA HOY (RODANDO)</span>
                    </button>

                    <button
                      id="btn-restart-route"
                      disabled={isProcessingAction}
                      onClick={() => handleResetDailyRoute(false)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-soft-gray py-3 text-xs font-bold text-ink border border-line hover:bg-line active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-primary" />
                      <span>Reabrir Ruta como Programada (Esperando salida)</span>
                    </button>
                  </div>
                </div>

                {/* Final stops history preview */}
                <div className="rounded-2xl border border-line bg-surface p-4 space-y-2.5 text-xs">
                  <h4 className="font-bold text-ink uppercase tracking-wider text-[11px]">
                    Resumen de Paradas de la Jornada
                  </h4>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {paradas.map((p, idx) => {
                      const student = alumnosMap.get(p.alumno_id) || p.alumno;
                      const isPickedUp = p.estado === 'recogido' || p.estado === 'completado';
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-soft-gray border border-line/80 text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-bold text-muted">#{p.orden || idx + 1}</span>
                            <span className="font-bold text-ink truncate">{student?.nombre}</span>
                          </div>
                          <span
                            className={`font-bold px-1.5 py-0.5 rounded ${
                              isPickedUp
                                ? 'text-emerald-600 bg-emerald-50/60'
                                : 'text-alert bg-rose-50/60'
                            }`}
                          >
                            {isPickedUp ? '✓ Recogido' : '✗ Ausente'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Test Drive Simulation Panel */}
            <div className="rounded-xl bg-surface/60 p-3.5 border border-line">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FastForward className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-ink">Simulador de Movimiento GPS</span>
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
                        ? 'bg-primary text-white'
                        : 'bg-soft-gray text-ink border border-line hover:bg-line'
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
                            simSpeed === spd ? 'bg-primary text-white' : 'bg-soft-gray text-muted'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-muted mt-1">
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
              targetArrivalTime={ruta.hora_llegada_objetivo || colegio.hora_llegada_limite}
              tipoTrayecto={ruta.tipo_trayecto}
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
          <div className="mx-auto max-w-xl space-y-3">
            {/* Top Toolbar & Summary */}
            <div className="rounded-xl bg-surface border border-line p-3 shadow-md space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-ink uppercase tracking-wider">
                    Secuencia Óptima de Paradas ({paradas.length})
                  </h4>
                  <p className="text-[11px] text-muted">
                    Control de asistencia diario para cada estudiante
                  </p>
                </div>

                <button
                  onClick={() => handleResetDailyRoute(false)}
                  className="flex items-center gap-1.5 rounded-lg bg-soft-gray hover:bg-line text-ink border border-line px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer"
                  title="Restablece todas las paradas a 'Pendiente' para un nuevo recorrido escolar"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-primary" />
                  <span>Reiniciar para Hoy</span>
                </button>
              </div>

              {/* Status Counters */}
              <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                <div className="bg-soft-gray rounded-lg p-1.5 border border-line">
                  <span className="text-[9px] text-muted uppercase font-bold block">Total</span>
                  <span className="font-extrabold text-ink text-xs">{paradas.length}</span>
                </div>
                <div className="bg-primary/10 rounded-lg p-1.5 border border-primary/40/20">
                  <span className="text-[9px] text-primary uppercase font-bold block">Pendientes</span>
                  <span className="font-extrabold text-primary text-xs">
                    {paradas.filter((p) => p.estado === 'pendiente').length}
                  </span>
                </div>
                <div className="bg-emerald-500/10 rounded-lg p-1.5 border border-emerald-500/20">
                  <span className="text-[9px] text-emerald-600 uppercase font-bold block">A Bordo</span>
                  <span className="font-extrabold text-emerald-600 text-xs">{recogidosCount}</span>
                </div>
                <div className="bg-rose-50 rounded-lg p-1.5 border border-rose-500/20">
                  <span className="text-[9px] text-alert uppercase font-bold block">Ausentes</span>
                  <span className="font-extrabold text-rose-600 text-xs">{ausentesCount}</span>
                </div>
              </div>
            </div>

            {/* List of stops */}
            {paradas.map((p, idx) => {
              const student = alumnosMap.get(p.alumno_id) || p.alumno;
              const isCurrent = activeStopIndex === idx;

              return (
                <div
                  key={p.id}
                  className={`rounded-xl p-3 border transition-all space-y-2.5 ${
                    isCurrent
                      ? 'border-primary/40 bg-primary/10 shadow-lg'
                      : p.estado === 'recogido'
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : p.estado === 'ausente'
                      ? 'border-rose-200 bg-rose-50 opacity-80'
                      : 'border-line bg-surface/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                          p.estado === 'recogido'
                            ? 'bg-emerald-500 text-ink font-black'
                            : p.estado === 'ausente'
                            ? 'bg-rose-500 text-white font-black'
                            : isCurrent
                            ? 'bg-primary text-white font-black animate-pulse'
                            : 'bg-soft-gray text-ink'
                        }`}
                      >
                        #{p.orden}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-ink">{student?.nombre || 'Alumno'}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                              p.estado === 'recogido'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : p.estado === 'ausente'
                                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                : p.estado === 'completado'
                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                : 'bg-soft-gray text-muted border border-line'
                            }`}
                          >
                            {p.estado === 'recogido'
                              ? 'A Bordo'
                              : p.estado === 'ausente'
                              ? 'Ausente'
                              : p.estado === 'completado'
                              ? 'En Escuela'
                              : 'Pendiente'}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted truncate max-w-[220px] sm:max-w-none">
                          {student?.direccion_recogida}
                        </p>
                        {p.hora_real && (
                          <span className="text-[10px] text-muted font-mono block mt-0.5">
                            Hora registrada: <b className="text-ink">{p.hora_real}</b>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-primary block">{p.hora_estimada.substring(0, 5)}</span>
                      {p.distancia_desde_anterior_km !== undefined && (
                        <span className="text-[10px] text-muted">{p.distancia_desde_anterior_km} km</span>
                      )}
                    </div>
                  </div>

                  {/* Interactive Status Switcher Buttons for Driver */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-line/80">
                    <span className="text-[10px] text-muted font-semibold mr-1">Cambiar a:</span>
                    
                    <button
                      onClick={() => handleManualChangeStopStatus(p.id, 'recogido')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        p.estado === 'recogido'
                          ? 'bg-emerald-500 text-ink'
                          : 'bg-soft-gray text-muted hover:text-emerald-600 hover:bg-emerald-50/40'
                      }`}
                    >
                      ✓ Recogido
                    </button>

                    <button
                      onClick={() => handleManualChangeStopStatus(p.id, 'ausente')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        p.estado === 'ausente'
                          ? 'bg-rose-500 text-white'
                          : 'bg-soft-gray text-muted hover:text-rose-600 hover:bg-rose-50'
                      }`}
                    >
                      ✗ Ausente
                    </button>

                    <button
                      onClick={() => handleManualChangeStopStatus(p.id, 'pendiente')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        p.estado === 'pendiente'
                          ? 'bg-primary/10 text-primary border border-primary/30'
                          : 'bg-soft-gray text-muted hover:text-ink'
                      }`}
                    >
                      ⏳ Pendiente
                    </button>

                    {student?.representante?.telefono_whatsapp && (
                      <a
                        href={`https://wa.me/${student.representante.telefono_whatsapp.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:underline"
                      >
                        <Phone className="h-2.5 w-2.5" />
                        <span>Chat WhatsApp</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 4: DRIVER PROFILE & ASSIGNED ROUTE */}
        {activeTab === 'profile' && (
          <div className="mx-auto max-w-2xl space-y-4">
            {/* Driver Identity Card */}
            {assignedConductor ? (
              <div className="rounded-2xl border border-primary/30 bg-surface p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 rounded-2xl overflow-hidden bg-soft-gray border-2 border-primary/40 shrink-0 shadow-lg">
                      {assignedConductor.foto_url ? (
                        <img
                          src={assignedConductor.foto_url}
                          alt={assignedConductor.nombre}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-black text-primary text-2xl">
                          {assignedConductor.nombre.charAt(0)}
                        </div>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-line ${
                          assignedConductor.activo ? 'bg-emerald-500' : 'bg-muted'
                        }`}
                        title={assignedConductor.activo ? 'Activo' : 'Inactivo'}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-ink">{assignedConductor.nombre}</h3>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-200">
                          {assignedConductor.activo ? 'Conductor Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="text-xs text-muted font-mono mt-0.5 flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-emerald-600" />
                        <a
                          href={`https://wa.me/${assignedConductor.telefono.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {assignedConductor.telefono}
                        </a>
                      </p>
                      {assignedConductor.email && (
                        <p className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                          <Mail className="h-3 w-3 text-muted" />
                          <span>{assignedConductor.email}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Switch Driver Profile Dropdown if multiple exist */}
                  {conductores.length > 1 && onSelectDriver && (
                    <div className="sm:text-right">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                        Cambiar de Conductor
                      </label>
                      <select
                        value={assignedConductor.id}
                        onChange={(e) => onSelectDriver(e.target.value)}
                        className="rounded-lg bg-canvas border border-line px-2.5 py-1.5 text-xs text-primary font-bold focus:border-primary/40 focus:outline-none"
                      >
                        {conductores.map((cond) => (
                          <option key={cond.id} value={cond.id}>
                            {cond.nombre} ({cond.vehiculo_placa || 'Sin Placa'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Specs Grid: Vehicle, License, Passenger Capacity */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-soft-gray p-3 border border-line">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                      <Car className="h-3.5 w-3.5 text-primary" />
                      <span>Unidad de Transporte</span>
                    </span>
                    <p className="text-sm font-bold text-ink mt-1">
                      {assignedConductor.vehiculo_modelo || 'Vehículo Escolar'}
                    </p>
                    {assignedConductor.vehiculo_placa && (
                      <span className="inline-block mt-1 rounded bg-surface border border-line px-2 py-0.5 font-mono text-[11px] font-black text-primary">
                        {assignedConductor.vehiculo_placa}
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl bg-soft-gray p-3 border border-line">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      <span>Licencia Profesional</span>
                    </span>
                    <p className="text-xs font-semibold text-ink mt-1">
                      {assignedConductor.licencia || 'Tipo E Profesional (Quito)'}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                      ✓ Habilitada ANT Ecuador
                    </span>
                  </div>

                  <div className="rounded-xl bg-soft-gray p-3 border border-line">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <span>Ocupación de Asientos</span>
                    </span>
                    <p className="text-sm font-black text-primary mt-1">
                      {paradas.length} / {assignedConductor.capacidad_pasajeros || 16} asientos
                    </p>
                    <div className="w-full bg-soft-gray rounded-full h-1.5 mt-2 overflow-hidden">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (paradas.length / (assignedConductor.capacidad_pasajeros || 16)) * 100
                            )
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">
                <Truck className="h-8 w-8 mx-auto text-muted mb-2" />
                <p className="text-sm font-bold">No hay un conductor asignado a esta ruta</p>
                <p className="text-xs text-muted mt-1">
                  Puedes registrar y asignar conductores desde el panel de Administración.
                </p>
              </div>
            )}

            {/* Assigned Route Summary Card */}
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <Compass className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-base text-ink">Mi Hoja de Ruta Asignada</h3>
                </div>

                <span
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                    ruta.tipo_trayecto === 'ida'
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                  }`}
                >
                  {ruta.tipo_trayecto === 'ida' ? (
                    <>
                      <Sun className="h-3.5 w-3.5" />
                      <span>Ruta de IDA (Mañana)</span>
                    </>
                  ) : (
                    <>
                      <Sunset className="h-3.5 w-3.5" />
                      <span>Ruta de VUELTA (Tarde)</span>
                    </>
                  )}
                </span>
              </div>

              {/* School and Origin Spec */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-canvas p-3 border border-line space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted">Colegio Asociado</span>
                  <p className="text-sm font-black text-ink">{colegio.nombre}</p>
                  <p className="text-[11px] text-muted truncate">{colegio.direccion}</p>
                  <p className="text-[11px] font-bold text-primary pt-1">
                    Hora Meta: {(ruta.hora_llegada_objetivo || colegio.hora_llegada_limite || '08:00').substring(0, 5)}
                  </p>
                </div>

                <div className="rounded-xl bg-canvas p-3 border border-line space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted">Horarios y Métricas</span>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-muted">Salida Calculada:</span>
                    <span className="font-bold text-primary">{ruta.hora_salida_estimada}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Distancia Total:</span>
                    <span className="font-bold text-ink">{ruta.distancia_total_km} km</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Tiempo de Manejo:</span>
                    <span className="font-bold text-ink">{ruta.tiempo_manejo_estimado_min} min</span>
                  </div>
                </div>
              </div>

              {/* Student Manifest Accordion / List */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-ink">
                  <span>Manifiesto de Alumnos ({paradas.length})</span>
                  <button
                    onClick={() => setActiveTab('cockpit')}
                    className="text-primary hover:underline text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ir a Cabina de Manejo</span>
                    <Compass className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {paradas.map((p) => {
                    const student = alumnosMap.get(p.alumno_id) || p.alumno;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl bg-canvas p-2.5 border border-line/80 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono font-bold text-xs">
                            #{p.orden}
                          </span>
                          <div>
                            <span className="font-bold text-ink">{student?.nombre || 'Alumno'}</span>
                            <p className="text-[10px] text-muted truncate max-w-[200px]">
                              {student?.direccion_recogida}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-primary font-bold text-[11px]">
                            {p.hora_estimada.substring(0, 5)}
                          </span>

                          {student?.telefono_representante && (
                            <a
                              href={`https://wa.me/${student.telefono_representante.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Contactar Representante por WhatsApp"
                              className="rounded-lg bg-emerald-500/20 p-1 text-emerald-600 hover:bg-emerald-500/30 transition-colors"
                            >
                              <Phone className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
