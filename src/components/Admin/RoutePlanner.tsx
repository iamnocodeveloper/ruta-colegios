/**
 * Route Planner & Inverse Departure Time Configurator
 * Implements:
 *   - Inverse Departure Time Algorithm (H_salida = H_llegada - T_total)
 *   - Real road geometry via OSRM / Mapbox
 *   - Boarding time adjustment slider (N * T_abordaje)
 *   - Traffic multiplier toggle ('fijo' | 'trafico_real')
 *   - Manual vs Automatic 2-Opt TSP sequence sorting
 *   - Interactive Map preview
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  Sparkles,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  Navigation,
  Car,
  Users,
  Check,
  RotateCcw,
  Sliders,
  Play,
  MapPin,
  Compass,
  ChevronDown,
  ChevronUp,
  Sun,
  Sunset,
  ShieldAlert,
  Truck,
  Phone,
  ShieldCheck
} from 'lucide-react';
import { Alumno, Colegio, Conductor, ModoOptimizacion, RouteOptimizationResult, RutaDiaria, TipoTrayecto } from '../../types';
import { calculateOptimizedRoute, formatFriendlyTime, filterStudentsForJourney } from '../../services/routeCalculator';
import { SchoolRouteMap } from '../Map/SchoolRouteMap';
import { LocationPicker } from '../Map/LocationPicker';
import { ensureUUID } from '../../services/instantDb';

interface RoutePlannerProps {
  colegios: Colegio[];
  selectedColegio: Colegio;
  onSelectColegio: (col: Colegio) => void;
  origen: { lat: number; lng: number; direccion?: string };
  onUpdateOrigen: (origen: { lat: number; lng: number; direccion?: string }) => void;
  allAlumnos: Alumno[];
  alumnosMap: Map<string, Alumno>;
  activeRuta: RutaDiaria;
  conductores?: Conductor[];
  onSaveRoute: (newRuta: RutaDiaria) => void;
  onSwitchToDriver: () => void;
}

export const RoutePlanner: React.FC<RoutePlannerProps> = ({
  colegios,
  selectedColegio,
  onSelectColegio,
  origen,
  onUpdateOrigen,
  allAlumnos,
  alumnosMap,
  activeRuta,
  conductores = [],
  onSaveRoute,
  onSwitchToDriver
}) => {
  // Planner State
  const [tipoTrayecto, setTipoTrayecto] = useState<TipoTrayecto>(activeRuta.tipo_trayecto || 'ida');
  
  // Selected Conductor for this route
  const [selectedConductorId, setSelectedConductorId] = useState<string>(
    activeRuta.conductor_id ||
    activeRuta.conductor?.id ||
    (conductores.length > 0 ? conductores[0].id : '')
  );

  // Sync selected conductor if activeRuta changes or list populates
  useEffect(() => {
    if (activeRuta.conductor_id) {
      setSelectedConductorId(activeRuta.conductor_id);
    } else if (activeRuta.conductor?.id) {
      setSelectedConductorId(activeRuta.conductor.id);
    } else if (!selectedConductorId && conductores.length > 0) {
      setSelectedConductorId(conductores[0].id);
    }
  }, [activeRuta.conductor_id, activeRuta.conductor, conductores]);
  
  // Eligible / Available students (default to all students of school or all registered)
  const schoolStudents = useMemo(() => {
    const list = allAlumnos.filter((s) => !s.colegio_id || s.colegio_id === selectedColegio.id);
    return list.length > 0 ? list : allAlumnos;
  }, [allAlumnos, selectedColegio.id]);

  const eligibleStudents = schoolStudents;
  
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    () => schoolStudents.map((s) => s.id)
  );

  const [horaLlegada, setHoraLlegada] = useState<string>(() => {
    if (activeRuta.hora_llegada_objetivo) return activeRuta.hora_llegada_objetivo;
    return tipoTrayecto === 'ida' ? (selectedColegio.hora_llegada_limite || '08:00:00') : '14:00:00';
  });
  const [modo, setModo] = useState<ModoOptimizacion>('fijo');
  const [tiempoAbordajeMin, setTiempoAbordajeMin] = useState<number>(2.5);
  const [orderedStudentIds, setOrderedStudentIds] = useState<string[]>([]);
  const [isManualOrder, setIsManualOrder] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<RouteOptimizationResult | null>(null);
  const [isOriginPickerOpen, setIsOriginPickerOpen] = useState<boolean>(false);

  const prevColegioIdRef = useRef<string>(selectedColegio.id);
  const prevTipoTrayectoRef = useRef<TipoTrayecto>(tipoTrayecto);

  // Sync selected school and direction when user changes school or journey type
  useEffect(() => {
    if (prevColegioIdRef.current !== selectedColegio.id || prevTipoTrayectoRef.current !== tipoTrayecto) {
      prevColegioIdRef.current = selectedColegio.id;
      prevTipoTrayectoRef.current = tipoTrayecto;
      if (tipoTrayecto === 'ida') {
        setHoraLlegada(selectedColegio.hora_llegada_limite || '08:00:00');
      } else {
        setHoraLlegada('14:00:00');
      }
    }
  }, [selectedColegio, tipoTrayecto]);

  // When school changes, select all students of this school
  useEffect(() => {
    const list = allAlumnos.filter((s) => !s.colegio_id || s.colegio_id === selectedColegio.id);
    const targetList = list.length > 0 ? list : allAlumnos;
    setSelectedStudentIds(targetList.map((s) => s.id));
  }, [selectedColegio.id, allAlumnos]);

  // Recalculate route whenever parameters change
  const runRouteCalculation = async (useManualOrder: boolean = false) => {
    setIsCalculating(true);
    try {
      const studentsToRoute = selectedStudentIds
        .map((id) => alumnosMap.get(id))
        .filter(Boolean) as Alumno[];

      const result = await calculateOptimizedRoute(
        origen,
        selectedColegio,
        studentsToRoute,
        {
          modo,
          tipoTrayecto,
          tiempoAbordajeMin,
          horaLlegadaLimite: horaLlegada,
          ordenManual: useManualOrder ? orderedStudentIds : undefined
        }
      );

      setOptimizationResult(result);
      setOrderedStudentIds(result.paradas_ordenadas.map((p) => p.alumno_id));
      setIsManualOrder(useManualOrder);
    } catch (err) {
      console.error('Calculation error:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    runRouteCalculation(false);
  }, [selectedColegio, origen, selectedStudentIds, modo, tiempoAbordajeMin, horaLlegada, tipoTrayecto]);

  // Manual reordering handlers
  const moveStudent = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= orderedStudentIds.length) return;

    const newOrder = [...orderedStudentIds];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(newIdx, 0, moved);

    setOrderedStudentIds(newOrder);
    setIsManualOrder(true);

    // Recalculate with this manual order
    const studentsToRoute = newOrder.map((id) => alumnosMap.get(id)!).filter(Boolean);
    calculateOptimizedRoute(origen, selectedColegio, studentsToRoute, {
      modo,
      tipoTrayecto,
      tiempoAbordajeMin,
      horaLlegadaLimite: horaLlegada,
      ordenManual: newOrder
    }).then((res) => setOptimizationResult(res));
  };

  // Toggle student selection
  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Apply to Active Daily Route
  const handleSaveAndActivate = () => {
    if (!optimizationResult) return;

    const newParadas = optimizationResult.paradas_ordenadas.map((p) => ({
      id: ensureUUID(),
      ruta_id: ensureUUID(activeRuta.id),
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

    const assignedConductor =
      conductores.find((c) => c.id === selectedConductorId) || activeRuta.conductor;

    const updatedRuta: RutaDiaria = {
      ...activeRuta,
      colegio_id: selectedColegio.id,
      colegio: {
        ...selectedColegio,
        hora_llegada_limite: horaLlegada || selectedColegio.hora_llegada_limite
      },
      conductor_id: selectedConductorId || undefined,
      conductor: assignedConductor,
      origen_lat: origen.lat,
      origen_lng: origen.lng,
      origen_direccion: origen.direccion,
      modo_optimizacion: modo,
      tipo_trayecto: tipoTrayecto,
      hora_llegada_objetivo: horaLlegada,
      hora_salida_estimada: optimizationResult.hora_salida_estimada,
      tiempo_manejo_estimado_min: optimizationResult.tiempo_manejo_min,
      tiempo_abordaje_total_min: optimizationResult.tiempo_abordaje_total_min,
      tiempo_total_estimado_min: optimizationResult.tiempo_total_min,
      distancia_total_km: optimizationResult.distancia_total_km,
      tiempo_abordaje_por_alumno_min: tiempoAbordajeMin,
      estado: 'planificada',
      paradas: newParadas,
      polyline_geometry: optimizationResult.polyline_geometry
    };

    onSaveRoute(updatedRuta);
    onSwitchToDriver();
  };

  return (
    <div className="flex h-full flex-col lg:flex-row bg-canvas text-ink overflow-hidden">
      {/* Left Configuration Column */}
      <div className="w-full lg:w-96 flex-shrink-0 border-r border-line bg-surface overflow-y-auto p-4 space-y-4">
        <div>
          <h2 className="text-base font-black text-ink flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Planificador & Optimización de Ruta</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Cálculo matemático con soporte de rutas de Ida (Mañana) y Vuelta (Tarde)
          </p>
        </div>

        {/* Journey Type Selector: IDA vs VUELTA */}
        <div className="rounded-xl border-2 border-primary/30 bg-canvas p-3 space-y-2">
          <label className="text-[11px] font-black text-primary uppercase tracking-wider block">
            Tipo de Trayecto a Planificar
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipoTrayecto('ida')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                tipoTrayecto === 'ida'
                  ? 'bg-primary text-white border-primary/40 font-black shadow-lg shadow-primary/20'
                  : 'bg-surface border-line text-ink hover:bg-soft-gray'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-black">
                <Sun className="h-4 w-4" />
                <span>Ruta de IDA</span>
              </div>
              <span className="text-[10px] mt-0.5 opacity-80">Mañana: Casas ➔ Escuela</span>
            </button>

            <button
              type="button"
              onClick={() => setTipoTrayecto('vuelta')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                tipoTrayecto === 'vuelta'
                  ? 'bg-purple-600 text-white border-purple-400 font-black shadow-lg shadow-purple-600/20'
                  : 'bg-surface border-line text-ink hover:bg-soft-gray'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-black">
                <Sunset className="h-4 w-4" />
                <span>Ruta de VUELTA</span>
              </div>
              <span className="text-[10px] mt-0.5 opacity-80">Tarde: Escuela ➔ Casas</span>
            </button>
          </div>
        </div>

        {/* School & Target Time */}
        <div className="rounded-xl border border-line bg-soft-gray p-3 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-ink uppercase tracking-wider block mb-1">
              Colegio {tipoTrayecto === 'ida' ? 'de Destino' : 'de Origen'}
            </label>
            <select
              value={selectedColegio.id}
              onChange={(e) => {
                const col = colegios.find((c) => c.id === e.target.value);
                if (col) onSelectColegio(col);
              }}
              className="w-full rounded-lg bg-surface border border-line px-3 py-2 text-xs font-semibold text-ink focus:border-primary/40 focus:outline-none"
            >
              {colegios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} (Entrada: {c.hora_llegada_limite.substring(0, 5)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-ink uppercase tracking-wider block mb-1">
              {tipoTrayecto === 'ida'
                ? 'Hora Límite de Llegada a la Escuela (H_llegada)'
                : 'Hora de Salida de la Escuela (H_salida)'}
            </label>
            <input
              type="time"
              step="60"
              value={horaLlegada.substring(0, 5)}
              onChange={(e) => setHoraLlegada(e.target.value + ':00')}
              className="w-full rounded-lg bg-surface border border-line px-3 py-1.5 text-xs font-bold text-primary focus:border-primary/40 focus:outline-none"
            />
          </div>
        </div>

        {/* Assigned Conductor & Vehicle Unit */}
        <div className="rounded-xl border border-primary/25 bg-soft-gray p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-primary" />
              <span>Conductor y Unidad Asignada</span>
            </label>
            {conductores.length > 0 && (
              <span className="text-[10px] text-muted font-mono">
                {conductores.filter((c) => c.activo).length} activos
              </span>
            )}
          </div>

          <div>
            <select
              value={selectedConductorId}
              onChange={(e) => setSelectedConductorId(e.target.value)}
              className="w-full rounded-lg bg-surface border border-line px-3 py-2 text-xs font-bold text-ink focus:border-primary/40 focus:outline-none"
            >
              <option value="">-- Sin Conductor Asignado --</option>
              {conductores.map((cond) => (
                <option key={cond.id} value={cond.id}>
                  {cond.nombre} • {cond.vehiculo_placa || 'Sin Placa'} ({cond.capacidad_pasajeros || 16} puestos)
                  {!cond.activo ? ' [Inactivo]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Driver Detailed Card */}
          {(() => {
            const activeCond =
              conductores.find((c) => c.id === selectedConductorId) ||
              activeRuta.conductor;

            if (!activeCond) {
              return (
                <p className="text-[11px] text-muted italic">
                  Selecciona un conductor registrado para vincular la ruta directamente a su cabina y perfil.
                </p>
              );
            }

            const driverCap = activeCond.capacidad_pasajeros || 16;
            const isOverCapacity = selectedStudentIds.length > driverCap;

            return (
              <div className="rounded-xl bg-surface border border-line p-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg overflow-hidden bg-soft-gray border border-line shrink-0">
                      {activeCond.foto_url ? (
                        <img
                          src={activeCond.foto_url}
                          alt={activeCond.nombre}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-bold text-primary text-xs">
                          {activeCond.nombre.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-ink text-xs flex items-center gap-1">
                        <span>{activeCond.nombre}</span>
                      </div>
                      <p className="text-[10px] text-muted font-mono flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5 text-emerald-600" />
                        <a
                          href={`https://wa.me/${activeCond.telefono.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline hover:text-emerald-600"
                        >
                          {activeCond.telefono}
                        </a>
                      </p>
                    </div>
                  </div>

                  {activeCond.vehiculo_placa && (
                    <span className="font-mono font-bold bg-canvas px-2 py-0.5 rounded border border-line text-primary text-[10px]">
                      {activeCond.vehiculo_placa}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-line/80 text-[11px]">
                  <span className="text-muted truncate max-w-[140px]">
                    {activeCond.vehiculo_modelo || 'Unidad de Transporte'}
                  </span>

                  <div className="flex items-center gap-1">
                    {isOverCapacity ? (
                      <span className="flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-alert border border-rose-200">
                        <ShieldAlert className="h-3 w-3" />
                        <span>{selectedStudentIds.length}/{driverCap} (Excede)</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-200">
                        <ShieldCheck className="h-3 w-3" />
                        <span>{selectedStudentIds.length}/{driverCap} puestos</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Origin Coordinates */}
        <div className="rounded-xl border border-line bg-soft-gray p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <span>{tipoTrayecto === 'ida' ? '🏁 Base de Salida del Conductor' : '🏁 Base / Retorno Final'}</span>
            </label>
            <button
              type="button"
              onClick={() => setIsOriginPickerOpen(!isOriginPickerOpen)}
              className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary bg-sky-950/60 hover:bg-sky-900/80 px-2 py-0.5 rounded border border-sky-800/60 transition-all cursor-pointer"
            >
              <MapPin className="h-3 w-3" />
              <span>{isOriginPickerOpen ? 'Cerrar Mapa' : 'Elegir en Mapa'}</span>
              {isOriginPickerOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {/* Collapsible/Expandable Location Picker Map */}
          {isOriginPickerOpen && (
            <div className="pt-1">
              <LocationPicker
                lat={origen.lat}
                lng={origen.lng}
                pinType="origin"
                currentAddress={origen.direccion}
                height="190px"
                onChange={(newLat, newLng, suggestedAddr) => {
                  onUpdateOrigen({
                    lat: newLat,
                    lng: newLng,
                    direccion: suggestedAddr || origen.direccion
                  });
                }}
              />
            </div>
          )}

          <div>
            <span className="text-[10px] text-muted font-bold block mb-1">Dirección de Base</span>
            <input
              type="text"
              value={origen.direccion || ''}
              onChange={(e) => onUpdateOrigen({ ...origen, direccion: e.target.value })}
              placeholder="Dirección o base de salida"
              className="w-full rounded-lg bg-surface border border-line px-3 py-1.5 text-xs text-ink focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-muted text-[10px] font-bold">Latitud GPS:</span>
              <input
                type="number"
                step="0.000001"
                value={origen.lat}
                onChange={(e) => onUpdateOrigen({ ...origen, lat: parseFloat(e.target.value) || origen.lat })}
                className="w-full rounded bg-surface border border-line px-2 py-1 text-ink text-xs font-mono mt-0.5"
              />
            </div>
            <div>
              <span className="text-muted text-[10px] font-bold">Longitud GPS:</span>
              <input
                type="number"
                step="0.000001"
                value={origen.lng}
                onChange={(e) => onUpdateOrigen({ ...origen, lng: parseFloat(e.target.value) || origen.lng })}
                className="w-full rounded bg-surface border border-line px-2 py-1 text-ink text-xs font-mono mt-0.5"
              />
            </div>
          </div>
        </div>

        {/* Traffic Mode & Boarding Buffer Slider */}
        <div className="rounded-xl border border-line bg-soft-gray p-3 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-ink uppercase tracking-wider block mb-1.5">
              Modo de Estimación
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModo('fijo')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition-all ${
                  modo === 'fijo'
                    ? 'bg-primary text-white shadow-md font-black'
                    : 'bg-surface text-muted border border-line hover:text-ink'
                }`}
              >
                <Car className="h-3.5 w-3.5" />
                <span>Estándar (Fijo)</span>
              </button>

              <button
                type="button"
                onClick={() => setModo('trafico_real')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition-all ${
                  modo === 'trafico_real'
                    ? 'bg-primary text-white shadow-md font-black'
                    : 'bg-surface text-muted border border-line hover:text-ink'
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Tráfico Real (Pico)</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-ink mb-1">
              <span>{tipoTrayecto === 'ida' ? 'ABORDAJE EN CASA:' : 'DESEMBARQUE EN CASA:'}</span>
              <span className="text-primary">{tiempoAbordajeMin} min</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={tiempoAbordajeMin}
              onChange={(e) => setTiempoAbordajeMin(parseFloat(e.target.value))}
              className="w-full accent-primary cursor-pointer"
            />
            <p className="text-[10px] text-muted mt-0.5">
              {selectedStudentIds.length} alumnos × {tiempoAbordajeMin} min = {Math.round(selectedStudentIds.length * tiempoAbordajeMin * 10) / 10} min totales
            </p>
          </div>
        </div>

        {/* Students Checklist with Modality Tag */}
        <div className="rounded-xl border border-line bg-soft-gray p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-ink uppercase tracking-wider">
              Alumnos Seleccionados ({selectedStudentIds.length}/{allAlumnos.length})
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedStudentIds(allAlumnos.map((s) => s.id))}
                className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
              >
                Marcar todos ({allAlumnos.length})
              </button>
              <span className="text-muted">|</span>
              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="text-[10px] font-medium text-muted hover:underline cursor-pointer"
              >
                Desmarcar
              </button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {allAlumnos.map((student) => {
              const mod = student.modalidad_servicio || 'ida_y_vuelta';
              const isSelected = selectedStudentIds.includes(student.id);

              return (
                <label
                  key={student.id}
                  className={`flex items-center justify-between gap-2 rounded-lg p-2 text-xs border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 border-primary/30 text-ink shadow-sm'
                      : 'bg-surface/60 border-line text-muted hover:border-line'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleStudent(student.id)}
                      className="accent-primary h-4 w-4 rounded cursor-pointer"
                    />
                    <div className="truncate">
                      <span className={`font-bold truncate block ${isSelected ? 'text-ink' : 'text-muted'}`}>
                        {student.nombre}
                      </span>
                      <span className="text-[10px] text-muted truncate block">
                        {student.direccion_recogida}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {mod === 'ida_y_vuelta' && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50/60 px-1.5 py-0.5 rounded border border-emerald-200">
                        🔄 Ida/Vuelta
                      </span>
                    )}
                    {mod === 'solo_ida' && (
                      <span className="text-[9px] font-bold text-primary bg-sky-950/60 px-1.5 py-0.5 rounded border border-primary/25">
                        🌅 Solo Ida
                      </span>
                    )}
                    {mod === 'solo_vuelta' && (
                      <span className="text-[9px] font-bold text-purple-600 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                        🌇 Solo Vuelta
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Action button */}
        <button
          id="btn-apply-plan"
          onClick={handleSaveAndActivate}
          disabled={isCalculating || selectedStudentIds.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 px-4 text-sm font-black text-ink shadow-lg shadow-primary/20 hover:bg-primary active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>GUARDAR Y ASIGNAR RUTA AL CONDUCTOR</span>
        </button>
      </div>

      {/* Right Content Area: Results Formula & Map Preview & Stop Reorder Table */}
      <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
        {/* INVERSE DEPARTURE / FORWARD COMPLETION TIME HERO CARD */}
        {optimizationResult && (
          <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 p-4 sm:p-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/25">
                  {tipoTrayecto === 'ida' ? 'Algoritmo de Salida Inversa (Mañana)' : 'Ruta de Vuelta Optimizada (Tarde)'}
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-ink">
                    {tipoTrayecto === 'ida' ? 'Hora de Salida de Base:' : 'Hora de Salida del Colegio:'}{' '}
                    <span className="text-primary">{optimizationResult.hora_salida_estimada}</span>
                  </h3>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {tipoTrayecto === 'ida' ? (
                    <>
                      El conductor debe partir a las <b className="text-primary">{optimizationResult.hora_salida_estimada}</b> para arribar a <span className="text-ink font-semibold">{selectedColegio.nombre}</span> exactamente a las <span className="text-primary font-semibold">{horaLlegada.substring(0, 5)}</span>.
                    </>
                  ) : (
                    <>
                      Partiendo del colegio a las <b className="text-primary">{optimizationResult.hora_salida_estimada}</b>, la entrega del último alumno se completará en aprox. <b className="text-ink">{optimizationResult.tiempo_total_min} min</b>.
                    </>
                  )}
                </p>
              </div>

              {/* Mathematical Equation Breakdown */}
              <div className="rounded-xl bg-surface/95 border border-line p-3 text-xs space-y-1">
                <div className="flex justify-between gap-4 text-muted">
                  <span>T_manejo proyectado:</span>
                  <b className="text-ink">{optimizationResult.tiempo_manejo_min} min</b>
                </div>
                <div className="flex justify-between gap-4 text-muted">
                  <span>{tipoTrayecto === 'ida' ? 'T_abordaje' : 'T_desembarque'} ({selectedStudentIds.length} × {tiempoAbordajeMin}):</span>
                  <b className="text-ink">{optimizationResult.tiempo_abordaje_total_min} min</b>
                </div>
                <div className="border-t border-line pt-1 flex justify-between gap-4 font-bold text-primary">
                  <span>T_total acumulado:</span>
                  <span>{optimizationResult.tiempo_total_min} min ({optimizationResult.distancia_total_km} km)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map Preview Stage */}
        <div className="h-[340px] sm:h-[380px] w-full rounded-xl overflow-hidden border border-line">
          <SchoolRouteMap
            colegio={{
              ...selectedColegio,
              hora_llegada_limite: horaLlegada || selectedColegio.hora_llegada_limite
            }}
            targetArrivalTime={horaLlegada}
            tipoTrayecto={tipoTrayecto}
            origen={origen}
            onOriginChange={onUpdateOrigen}
            paradas={
              optimizationResult
                ? optimizationResult.paradas_ordenadas.map((p) => ({
                    id: p.alumno_id,
                    ruta_id: 'preview',
                    alumno_id: p.alumno_id,
                    orden: p.orden,
                    hora_estimada: p.hora_estimada,
                    estado: 'pendiente',
                    lat: p.lat,
                    lng: p.lng,
                    alumno: alumnosMap.get(p.alumno_id)
                  }))
                : []
            }
            alumnosMap={alumnosMap}
            polylineGeometry={optimizationResult?.polyline_geometry}
          />
        </div>

        {/* Reordering & Intermediate Stops Table */}
        <div className="rounded-xl border border-line bg-surface/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-ink">
                Itinerario de {tipoTrayecto === 'ida' ? 'Recogida (Hogares ➔ Colegio)' : 'Entrega (Colegio ➔ Hogares)'}
              </h4>
              <p className="text-[11px] text-muted">
                {isManualOrder
                  ? 'Orden personalizado manualmente. Puedes restaurar la sugerencia algorítmica.'
                  : 'Orden óptimo calculado mediante Algoritmo TSP 2-Opt (mínima distancia y tiempo).'}
              </p>
            </div>

            {isManualOrder && (
              <button
                onClick={() => runRouteCalculation(false)}
                className="flex items-center gap-1 text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restaurar Orden 2-Opt</span>
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {orderedStudentIds.map((studentId, idx) => {
              const student = alumnosMap.get(studentId);
              const stopMeta = optimizationResult?.paradas_ordenadas.find((p) => p.alumno_id === studentId);

              return (
                <div
                  key={studentId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-soft-gray p-2.5 border border-line hover:border-line transition-all text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white font-black text-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-ink text-sm">{student?.nombre}</span>
                        {student?.modalidad_servicio === 'solo_ida' && (
                          <span className="text-[9px] text-primary font-bold bg-sky-950/80 px-1.5 rounded">Solo Ida</span>
                        )}
                        {student?.modalidad_servicio === 'solo_vuelta' && (
                          <span className="text-[9px] text-purple-400 font-bold bg-purple-950/80 px-1.5 rounded">Solo Vuelta</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted truncate max-w-[280px]">
                        {student?.direccion_recogida}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-bold text-primary text-xs block">
                        {stopMeta?.hora_estimada.substring(0, 5) || '--:--'}
                      </span>
                      <span className="text-[10px] text-muted">
                        {stopMeta?.distancia_desde_anterior_km || 0} km ({stopMeta?.tiempo_desde_anterior_min || 0} min)
                      </span>
                    </div>

                    {/* Move Up/Down Controls */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={idx === 0}
                        onClick={() => moveStudent(idx, 'up')}
                        title="Subir parada"
                        className="p-1 text-muted hover:text-primary disabled:opacity-20 cursor-pointer"
                      >
                        <MoveUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={idx === orderedStudentIds.length - 1}
                        onClick={() => moveStudent(idx, 'down')}
                        title="Bajar parada"
                        className="p-1 text-muted hover:text-primary disabled:opacity-20 cursor-pointer"
                      >
                        <MoveDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
