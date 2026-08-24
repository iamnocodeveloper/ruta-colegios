/**
 * Driver Simple Panel (Panel del Conductor)
 * Minimal, focused driver view:
 *   1. See assigned routes (from history, filtered by driver)
 *   2. Start today's route
 *   3. Mark / unmark student pickup (recogido / ausente / pendiente)
 */
import React, { useMemo, useState } from 'react';
import {
  Compass,
  Play,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  Flag,
  MapPin,
  Users,
  School,
  Truck,
  ChevronDown,
  ChevronUp,
  Phone,
  MessageCircle
} from 'lucide-react';
import { Alumno, Colegio, RutaDiaria, ParadaRuta, Conductor, RutaTrayecto } from '../../types';
import { RouteHistoryEntry } from '../../services/routeHistory';
import { formatFriendlyTime } from '../../services/routeCalculator';
import { SchoolRouteMap } from '../Map/SchoolRouteMap';
import { getJourneys, isCombinedRuta, JourneyKey } from '../../services/routeJourneys';

export type ParadaEstado = 'pendiente' | 'recogido' | 'ausente';

const StopLine: React.FC<{ p: ParadaRuta; idx: number }> = ({ p, idx }) => {
  return (
    <div className="rounded-lg bg-soft-gray px-3 py-2 text-xs">
      <div className="flex items-center gap-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface border border-line text-[9px] font-black text-primary shrink-0">
          {p.orden}
        </span>
        <span className="truncate font-bold text-ink flex-1">{p.alumno?.nombre || 'Alumno'}</span>
        <span className="text-muted font-mono">{formatFriendlyTime(p.hora_estimada)}</span>
        <span className={`text-[10px] font-extrabold ${
          p.estado === 'recogido' ? 'text-emerald-600' : p.estado === 'ausente' ? 'text-alert' : 'text-muted'
        }`}>
          {p.estado === 'recogido' ? '✓' : p.estado === 'ausente' ? '✗' : '⏳'}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 pl-8">
        <a
          href={`https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded bg-surface border border-line px-2 py-1 text-[9px] font-extrabold text-ink hover:border-primary/40 hover:text-primary transition-colors"
          title="Abrir en Waze"
        >
          🚗 Waze
        </a>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.lat},${p.lng}`)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded bg-surface border border-line px-2 py-1 text-[9px] font-extrabold text-ink hover:border-primary/40 hover:text-primary transition-colors"
          title="Abrir en Google Maps"
        >
          📍 Maps
        </a>
      </div>
    </div>
  );
}

interface DriverPanelSimpleProps {
  ruta: RutaDiaria;                          // today's active route
  colegio: Colegio;
  alumnosMap: Map<string, Alumno>;
  conductores: Conductor[];
  currentDriverId: string;
  history: RouteHistoryEntry[];              // assigned routes come from here
  onSelectDriver: (driverId: string) => void;
  onUpdateRuta: (ruta: RutaDiaria) => void;  // persist route (saves to history too)
  onUpdateParada: (paradaId: string, estado: ParadaEstado) => void;
  onStartRoute: (journey?: 'ida' | 'vuelta') => void;
  onCompleteRoute?: (journey?: 'ida' | 'vuelta') => void;
}

export const DriverPanelSimple: React.FC<DriverPanelSimpleProps> = ({
  ruta,
  colegio,
  alumnosMap,
  conductores,
  currentDriverId,
  history,
  onSelectDriver,
  onUpdateRuta,
  onUpdateParada,
  onStartRoute,
  onCompleteRoute
}) => {
  const [activeTab, setActiveTab] = useState<'hoy' | 'rutas'>('hoy');
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [activeJourney, setActiveJourney] = useState<JourneyKey>('ida');

  const isCombined = isCombinedRuta(ruta);
  const journeys = useMemo(() => getJourneys(ruta), [ruta]);

  // Reset journey selector when the active route changes
  React.useEffect(() => {
    setActiveJourney('ida');
  }, [ruta.id]);

  const journeyKeys = journeys.map((j) => j.tipo_trayecto);
  const effJourney = (journeyKeys.includes(activeJourney) ? activeJourney : journeyKeys[0]) as JourneyKey | undefined;
  const activeJourneyObj: RutaTrayecto | undefined = effJourney
    ? journeys.find((j) => j.tipo_trayecto === effJourney)
    : undefined;

  // Paradas del trayecto visible (o de la ruta simple)
  const paradas = isCombined && activeJourneyObj ? activeJourneyObj.paradas || [] : ruta.paradas || [];
  const meta = isCombined && activeJourneyObj ? activeJourneyObj : ruta;
  const routeState = isCombined ? activeJourneyObj?.estado || 'planificada' : ruta.estado;

  const totalParadas = paradas.length;
  const recogidos = paradas.filter((p) => p.estado === 'recogido').length;
  const ausentes = paradas.filter((p) => p.estado === 'ausente').length;
  const pendientes = paradas.filter((p) => p.estado === 'pendiente').length;
  const progreso = totalParadas > 0 ? Math.round((recogidos / totalParadas) * 100) : 0;

  const handleParadaClick = (parada: ParadaRuta, nuevo: ParadaEstado) => {
    if (parada.estado === nuevo) return;
    if (isCombined) {
      // En rutas combinadas App actualiza la jornada correcta automáticamente
      onUpdateParada(parada.id, nuevo);
    } else {
      const updated = {
        ...ruta,
        paradas: paradas.map((p) => (p.id === parada.id ? { ...p, estado: nuevo } : p)),
      };
      onUpdateRuta(updated);
      onUpdateParada(parada.id, nuevo);
    }
  };

  const conductor = useMemo(
    () => conductores.find((c) => c.id === currentDriverId) || conductores[0],
    [conductores, currentDriverId]
  );

  // Routes assigned to THIS driver (from history + today's active route)
  const assignedRoutes = useMemo(() => {
    const routes = history.filter((h) => h.conductor_id === currentDriverId || h.conductor_nombre === conductor?.nombre);
    // Ensure today's active route appears first if it belongs to this driver
    const todayEntry = routes.find((r) => r.id === ruta.id);
    const rest = routes.filter((r) => r.id !== ruta.id);
    return todayEntry ? [todayEntry, ...rest] : rest;
  }, [history, currentDriverId, conductor, ruta.id]);

  const nextParada = paradas.find((p) => p.estado === 'pendiente');

  return (
    <div className="h-full overflow-y-auto bg-canvas p-4 sm:p-6">
      <div className="max-w-[1100px] mx-auto space-y-4">

        {/* Driver identity + route state */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white text-lg font-black shadow-soft">
              {conductor?.nombre?.split(' ').map((p) => p[0]).slice(0, 2).join('') || 'C'}
            </div>
            <div>
              <h2 className="text-lg font-black text-ink">Cabina del Conductor</h2>
              <p className="text-xs text-muted">{conductor?.nombre || 'Selecciona un conductor'} · {conductor?.vehiculo_placa || 'Sin unidad'}</p>
            </div>
          </div>

          {/* Driver selector */}
          <select
            value={currentDriverId}
            onChange={(e) => onSelectDriver(e.target.value)}
            className="rounded-xl bg-surface border border-line px-3 py-2 text-xs font-bold text-ink focus:border-primary focus:outline-none cursor-pointer"
          >
            {conductores.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Today's route status bar */}
        <div className={`rounded-card border p-4 sm:p-5 shadow-soft ${
          routeState === 'en_curso' ? 'bg-emerald-50 border-emerald-200' :
          routeState === 'completada' ? 'bg-soft-blue border-primary/25' :
          'bg-surface border-line'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                routeState === 'en_curso' ? 'bg-emerald-500 text-white' :
                routeState === 'completada' ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
              }`}>
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted">Ruta de Hoy</p>
                <h3 className="font-extrabold text-ink">{colegio.nombre}</h3>
                <p className="text-[11px] text-muted flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {isCombined && <span className="font-bold text-primary">{effJourney === 'ida' ? 'IDA' : 'VUELTA'}</span>}
                  Salida {formatFriendlyTime(meta.hora_salida_estimada)} · Llegada {formatFriendlyTime(meta.hora_llegada_objetivo)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {routeState === 'planificada' && (
                <button
                  id="btn-simple-start-route"
                  onClick={() => onStartRoute(isCombined ? effJourney : undefined)}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-white shadow-soft hover:bg-blue-600 transition-colors cursor-pointer"
                >
                  <Play className="h-4 w-4" />
                  {isCombined ? `EMPEZAR ${effJourney === 'ida' ? 'IDA' : 'VUELTA'}` : 'EMPEZAR RUTA'}
                </button>
              )}
              {routeState === 'en_curso' && (
                <>
                  <button
                    id="btn-simple-complete-route"
                    onClick={() => onCompleteRoute?.(isCombined ? effJourney : undefined)}
                    title="Finalizar la ruta aunque falten paradas"
                    className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-emerald-700 border border-emerald-200 shadow-soft hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <Flag className="h-4 w-4" /> FINALIZAR {isCombined ? (effJourney === 'ida' ? 'IDA' : 'VUELTA') : 'RUTA'}
                  </button>
                  <span className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-extrabold text-white animate-pulse">● EN CURSO</span>
                </>
              )}
              {routeState === 'completada' && (
                <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-extrabold text-white">✓ COMPLETADA</span>
              )}
            </div>
          </div>

          {/* Progress */}
          {totalParadas > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] font-bold text-muted mb-1">
                <span>{recogidos} recogidos · {ausentes} ausentes · {pendientes} pendientes</span>
                <span>{progreso}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/60 border border-line/50">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Journey selector (ruta combinada: IDA + VUELTA) */}
        {journeys.length > 1 && (
          <div className="flex items-center gap-1 rounded-xl bg-soft-gray p-1 w-fit">
            {journeys.map((j) => (
              <button
                key={j.tipo_trayecto}
                onClick={() => setActiveJourney(j.tipo_trayecto)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  effJourney === j.tipo_trayecto
                    ? 'bg-surface text-primary shadow-soft'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {j.tipo_trayecto === 'ida' ? '🌅 Ruta de IDA' : '🌇 Ruta de VUELTA'} ({j.paradas.length})
              </button>
            ))}
          </div>
        )}

        {/* Next stop highlight */}
        {routeState === 'en_curso' && nextParada && (
          <div className="rounded-card bg-primary p-4 sm:p-5 text-white shadow-soft relative overflow-hidden">
            <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Próxima parada
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">
                  {alumnosMap.get(nextParada.alumno_id)?.nombre || 'Alumno'}
                </h3>
                <p className="text-xs text-white/80 mt-0.5">
                  Parada #{nextParada.orden} · {formatFriendlyTime(nextParada.hora_estimada)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="btn-simple-pickup"
                  onClick={() => handleParadaClick(nextParada, 'recogido')}
                  className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-emerald-600 shadow hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" /> RECOGIDO
                </button>
                <button
                  id="btn-simple-absent"
                  onClick={() => handleParadaClick(nextParada, 'ausente')}
                  className="flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-black text-white border border-white/30 hover:bg-white/25 transition-colors cursor-pointer"
                >
                  <XCircle className="h-4 w-4" /> AUSENTE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs: Today's stops / Assigned routes */}
        <div className="flex items-center gap-1 rounded-xl bg-soft-gray p-1 w-fit">
          <button
            onClick={() => setActiveTab('hoy')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'hoy' ? 'bg-surface text-primary shadow-soft' : 'text-muted hover:text-ink'
            }`}
          >
            Paradas de Hoy ({totalParadas})
          </button>
          <button
            onClick={() => setActiveTab('rutas')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'rutas' ? 'bg-surface text-primary shadow-soft' : 'text-muted hover:text-ink'
            }`}
          >
            Mis Rutas ({assignedRoutes.length})
          </button>
        </div>

        {/* ===== TAB: Today's stops ===== */}
        {activeTab === 'hoy' && (
          <div className="space-y-3">
            {totalParadas === 0 && (
              <div className="rounded-card bg-surface border border-line p-10 text-center text-muted">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-bold">Sin paradas para hoy</p>
                <p className="text-xs mt-1">Asigna una ruta desde el Planificador.</p>
              </div>
            )}

            {paradas.map((parada, idx) => {
              const alumno = alumnosMap.get(parada.alumno_id);
              const isDone = parada.estado === 'recogido' || parada.estado === 'ausente';
              return (
                <div key={parada.id} className={`rounded-card border p-4 shadow-soft flex flex-wrap items-center gap-3 transition-all ${
                  parada.estado === 'recogido' ? 'bg-emerald-50 border-emerald-200' :
                  parada.estado === 'ausente' ? 'bg-rose-50 border-rose-200' : 'bg-surface border-line'
                }`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                    isDone ? 'bg-white text-muted' : 'bg-primary/10 text-primary'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-extrabold text-sm ${isDone ? 'text-muted line-through' : 'text-ink'}`}>
                      {alumno?.nombre || 'Alumno'}
                    </p>
                    <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{alumno?.direccion_recogida || 'Sin dirección'}</span>
                    </p>
                    <p className="text-[10px] text-muted font-mono mt-0.5">
                      ETA {formatFriendlyTime(parada.hora_estimada)} · {parada.distancia_desde_anterior_km || 0} km
                    </p>

                    {/* Navigation & contact quick actions */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <a
                        href={`https://waze.com/ul?ll=${parada.lat},${parada.lng}&navigate=yes`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-surface border border-line px-2 py-1 text-[9px] font-extrabold text-ink hover:border-primary/40 hover:text-primary transition-colors"
                        title="Abrir en Waze"
                      >
                        🚗 Waze
                      </a>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${parada.lat},${parada.lng}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-surface border border-line px-2 py-1 text-[9px] font-extrabold text-ink hover:border-primary/40 hover:text-primary transition-colors"
                        title="Abrir en Google Maps"
                      >
                        📍 Maps
                      </a>
                      {alumno?.representante?.telefono_whatsapp && (
                        <a
                          href={`tel:${alumno.representante.telefono_whatsapp.replace(/[^0-9]/g, '')}`}
                          className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/25 px-2 py-1 text-[9px] font-extrabold text-primary hover:bg-primary/20 transition-colors"
                          title={`Llamar al representante ${alumno.representante.nombre || ''}`}
                        >
                          <Phone className="h-2.5 w-2.5" /> Llamar
                        </a>
                      )}
                      {alumno?.representante?.telefono_whatsapp && (
                        <a
                          href={`https://wa.me/${alumno.representante.telefono_whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola, le escribimos por la ruta escolar de RutaEscolar.')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1 text-[9px] font-extrabold text-emerald-600 hover:bg-emerald-100 transition-colors"
                          title={`WhatsApp de ${alumno.representante.nombre || 'representante'}`}
                        >
                          <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      id={`btn-simple-ok-${parada.id}`}
                      onClick={() => handleParadaClick(parada, 'recogido')}
                      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-extrabold transition-colors cursor-pointer ${
                        parada.estado === 'recogido'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-soft-gray text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Recogido
                    </button>
                    <button
                      id={`btn-simple-no-${parada.id}`}
                      onClick={() => handleParadaClick(parada, 'ausente')}
                      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[11px] font-extrabold transition-colors cursor-pointer ${
                        parada.estado === 'ausente'
                          ? 'bg-alert text-white'
                          : 'bg-soft-gray text-alert hover:bg-rose-100'
                      }`}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Ausente
                    </button>
                    {parada.estado !== 'pendiente' && (
                      <button
                        id={`btn-simple-pending-${parada.id}`}
                        onClick={() => handleParadaClick(parada, 'pendiente')}
                        title="Marcar como pendiente"
                        className="flex items-center gap-1 rounded-lg bg-soft-gray px-2.5 py-2 text-[11px] font-bold text-muted hover:bg-line transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Map toggle */}
            {totalParadas > 0 && (
              <button
                onClick={() => setShowMap(!showMap)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-surface border border-line px-4 py-2.5 text-xs font-bold text-primary hover:bg-soft-gray transition-colors cursor-pointer"
              >
                {showMap ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showMap ? 'Ocultar Mapa' : 'Ver Mapa de la Ruta'}
              </button>
            )}
            {showMap && totalParadas > 0 && (
              <div className="rounded-card bg-surface border border-line p-3 shadow-soft">
                <div className="h-[400px] rounded-2xl overflow-hidden">
                  <SchoolRouteMap
                    colegio={colegio}
                    origen={{ lat: ruta.origen_lat, lng: ruta.origen_lng, direccion: ruta.origen_direccion }}
                    paradas={paradas}
                    alumnosMap={alumnosMap}
                    polylineGeometry={meta.polyline_geometry}
                    targetArrivalTime={meta.hora_llegada_objetivo}
                    tipoTrayecto={meta.tipo_trayecto || 'ida'}
                    onOriginChange={undefined}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: Assigned routes ===== */}
        {activeTab === 'rutas' && (
          <div className="space-y-3">
            {assignedRoutes.length === 0 && (
              <div className="rounded-card bg-surface border border-line p-10 text-center text-muted">
                <Truck className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-bold">No tienes rutas asignadas</p>
                <p className="text-xs mt-1">Las rutas guardadas en el historial aparecerán aquí según el conductor asignado.</p>
              </div>
            )}

            {assignedRoutes.map((entry) => {
              const isExpanded = expandedRouteId === entry.id;
              const isToday = entry.id === ruta.id;
              return (
                <div key={entry.id} className="rounded-card bg-surface border border-line shadow-soft overflow-hidden">
                  <button
                    onClick={() => setExpandedRouteId(isExpanded ? null : entry.id)}
                    className="w-full flex flex-wrap items-center gap-3 p-4 text-left hover:bg-soft-gray/50 transition-colors cursor-pointer"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <School className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-ink text-sm truncate">{entry.colegio_nombre}</p>
                        {isToday && (
                          <span className="rounded-full bg-neon px-2 py-0.5 text-[9px] font-black text-ink">HOY</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        {entry.fecha} · {entry.total_paradas} paradas · {entry.distancia_total_km} km · Salida {formatFriendlyTime(entry.hora_salida_estimada)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                        entry.estado === 'completada' ? 'bg-emerald-50 text-emerald-600' :
                        entry.estado === 'en_curso' ? 'bg-emerald-500 text-white animate-pulse' : 'bg-soft-gray text-muted'
                      }`}>
                        {entry.estado === 'completada' ? '✓ Completada' : entry.estado === 'en_curso' ? '● En curso' : 'Planificada'}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-line/70 px-4 py-3 space-y-2 animate-fadeIn">
                      {getJourneys(entry.ruta).length > 0
                        ? getJourneys(entry.ruta).map((jj) => (
                            <div key={jj.tipo_trayecto}>
                              <p className="text-[11px] font-black uppercase text-muted mb-1.5">
                                {jj.tipo_trayecto === 'ida' ? '🌅 Paradas IDA' : '🌇 Paradas VUELTA'} ({jj.paradas.length})
                              </p>
                              {(jj.paradas || []).map((p, idx) => <StopLine key={p.id || idx} p={p} idx={idx} />)}
                            </div>
                          ))
                        : (
                            <>
                              <p className="text-[11px] font-black uppercase text-muted">Paradas</p>
                              {(entry.ruta.paradas || []).map((p, idx) => <StopLine key={p.id || idx} p={p} idx={idx} />)}
                            </>
                          )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
