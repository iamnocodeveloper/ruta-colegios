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

import React, { useState, useEffect } from 'react';
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
  Play
} from 'lucide-react';
import { Alumno, Colegio, ModoOptimizacion, RouteOptimizationResult, RutaDiaria } from '../../types';
import { calculateOptimizedRoute, formatFriendlyTime } from '../../services/routeCalculator';
import { SchoolRouteMap } from '../Map/SchoolRouteMap';

interface RoutePlannerProps {
  colegios: Colegio[];
  selectedColegio: Colegio;
  onSelectColegio: (col: Colegio) => void;
  origen: { lat: number; lng: number; direccion?: string };
  onUpdateOrigen: (origen: { lat: number; lng: number; direccion?: string }) => void;
  allAlumnos: Alumno[];
  alumnosMap: Map<string, Alumno>;
  activeRuta: RutaDiaria;
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
  onSaveRoute,
  onSwitchToDriver
}) => {
  // Planner State
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    allAlumnos.map((s) => s.id)
  );
  const [horaLlegada, setHoraLlegada] = useState<string>(
    selectedColegio.hora_llegada_limite || '08:00:00'
  );
  const [modo, setModo] = useState<ModoOptimizacion>('fijo');
  const [tiempoAbordajeMin, setTiempoAbordajeMin] = useState<number>(2.5);
  const [orderedStudentIds, setOrderedStudentIds] = useState<string[]>([]);
  const [isManualOrder, setIsManualOrder] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<RouteOptimizationResult | null>(null);

  // Sync selected school
  useEffect(() => {
    setHoraLlegada(selectedColegio.hora_llegada_limite || '08:00:00');
  }, [selectedColegio]);

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
  }, [selectedColegio, origen, selectedStudentIds, modo, tiempoAbordajeMin, horaLlegada]);

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
      id: 'parada_' + p.alumno_id + '_' + Date.now(),
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

    const updatedRuta: RutaDiaria = {
      ...activeRuta,
      colegio_id: selectedColegio.id,
      colegio: selectedColegio,
      origen_lat: origen.lat,
      origen_lng: origen.lng,
      origen_direccion: origen.direccion,
      modo_optimizacion: modo,
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
    <div className="flex h-full flex-col lg:flex-row bg-slate-950 text-slate-100 overflow-hidden">
      {/* Left Configuration Column */}
      <div className="w-full lg:w-96 flex-shrink-0 border-r border-slate-800 bg-slate-900/90 overflow-y-auto p-4 space-y-4">
        <div>
          <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Planificador & Salida Inversa</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cálculo matemático de hora de salida y orden óptimo de recogida
          </p>
        </div>

        {/* School & Target Arrival Time */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
              Escuela de Destino
            </label>
            <select
              value={selectedColegio.id}
              onChange={(e) => {
                const col = colegios.find((c) => c.id === e.target.value);
                if (col) onSelectColegio(col);
              }}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 focus:border-amber-400 focus:outline-none"
            >
              {colegios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} (Meta: {c.hora_llegada_limite.substring(0, 5)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
              Hora Límite de Llegada a la Escuela (H_llegada)
            </label>
            <input
              type="time"
              step="60"
              value={horaLlegada.substring(0, 5)}
              onChange={(e) => setHoraLlegada(e.target.value + ':00')}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs font-bold text-amber-400 focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Origin Coordinates */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
            Punto de Origen / Base Conductor (O)
          </label>
          <input
            type="text"
            value={origen.direccion || ''}
            onChange={(e) => onUpdateOrigen({ ...origen, direccion: e.target.value })}
            placeholder="Dirección o base de salida"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">Lat:</span>
              <input
                type="number"
                step="0.0001"
                value={origen.lat}
                onChange={(e) => onUpdateOrigen({ ...origen, lat: parseFloat(e.target.value) || origen.lat })}
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 text-xs mt-0.5"
              />
            </div>
            <div>
              <span className="text-slate-400">Lng:</span>
              <input
                type="number"
                step="0.0001"
                value={origen.lng}
                onChange={(e) => onUpdateOrigen({ ...origen, lng: parseFloat(e.target.value) || origen.lng })}
                className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200 text-xs mt-0.5"
              />
            </div>
          </div>
        </div>

        {/* Traffic Mode & Boarding Buffer Slider */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              Modo de Estimación
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModo('fijo')}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition-all ${
                  modo === 'fijo'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-400 border border-slate-700 hover:text-slate-200'
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
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-400 border border-slate-700 hover:text-slate-200'
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Tráfico Real (Pico)</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-1">
              <span>TIEMPO ABORDAJE POR ALUMNO:</span>
              <span className="text-amber-400">{tiempoAbordajeMin} min</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={tiempoAbordajeMin}
              onChange={(e) => setTiempoAbordajeMin(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              Multiplicado por {selectedStudentIds.length} alumnos = {Math.round(selectedStudentIds.length * tiempoAbordajeMin * 10) / 10} min totales
            </p>
          </div>
        </div>

        {/* Students Checklist */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Alumnos a Incluir ({selectedStudentIds.length})
            </label>
            <button
              onClick={() => {
                if (selectedStudentIds.length === allAlumnos.length) {
                  setSelectedStudentIds([]);
                } else {
                  setSelectedStudentIds(allAlumnos.map((s) => s.id));
                }
              }}
              className="text-[10px] font-semibold text-amber-400 hover:underline"
            >
              {selectedStudentIds.length === allAlumnos.length ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {allAlumnos.map((student) => (
              <label
                key={student.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/80 p-2 text-xs border border-slate-800 cursor-pointer hover:border-slate-700"
              >
                <div className="flex items-center gap-2 truncate">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(student.id)}
                    onChange={() => toggleStudent(student.id)}
                    className="accent-amber-500 h-3.5 w-3.5 rounded"
                  />
                  <span className="font-semibold text-slate-200 truncate">{student.nombre}</span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">{student.grado || 'Estudiante'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Action button */}
        <button
          id="btn-apply-plan"
          onClick={handleSaveAndActivate}
          disabled={isCalculating || selectedStudentIds.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 px-4 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>GUARDAR Y ASIGNAR RUTA AL CONDUCTOR</span>
        </button>
      </div>

      {/* Right Content Area: Results Formula & Map Preview & Stop Reorder Table */}
      <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
        {/* INVERSE DEPARTURE TIME HERO CARD */}
        {optimizationResult && (
          <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 p-4 sm:p-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Algoritmo de Salida Inversa
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-100">
                    Hora de Salida: <span className="text-amber-400">{optimizationResult.hora_salida_estimada}</span>
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  El conductor debe partir a esta hora para arribar a <span className="text-slate-200 font-semibold">{selectedColegio.nombre}</span> exactamente a las <span className="text-amber-400 font-semibold">{horaLlegada.substring(0, 5)}</span>.
                </p>
              </div>

              {/* Mathematical Equation Breakdown */}
              <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 text-xs space-y-1">
                <div className="flex justify-between gap-4 text-slate-400">
                  <span>T_manejo proyectado:</span>
                  <b className="text-slate-200">{optimizationResult.tiempo_manejo_min} min</b>
                </div>
                <div className="flex justify-between gap-4 text-slate-400">
                  <span>T_abordaje ({selectedStudentIds.length} × {tiempoAbordajeMin}):</span>
                  <b className="text-slate-200">{optimizationResult.tiempo_abordaje_total_min} min</b>
                </div>
                <div className="border-t border-slate-800 pt-1 flex justify-between gap-4 font-bold text-amber-400">
                  <span>T_total acumulado:</span>
                  <span>{optimizationResult.tiempo_total_min} min ({optimizationResult.distancia_total_km} km)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map Preview Stage */}
        <div className="h-[340px] sm:h-[380px] w-full rounded-xl overflow-hidden border border-slate-800">
          <SchoolRouteMap
            colegio={selectedColegio}
            origen={origen}
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Itinerario y Secuencia de Paradas</h4>
              <p className="text-[11px] text-slate-400">
                {isManualOrder
                  ? 'Orden personalizado manualmente. Puedes restaurar la sugerencia algorítmica.'
                  : 'Orden óptimo calculado mediante Algoritmo 2-Opt (mínima distancia).'}
              </p>
            </div>

            {isManualOrder && (
              <button
                onClick={() => runRouteCalculation(false)}
                className="flex items-center gap-1 text-xs text-amber-400 font-bold hover:underline"
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
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/80 p-2.5 border border-slate-800 hover:border-slate-700 transition-all text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-slate-950 font-black text-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-100 text-sm">{student?.nombre}</span>
                      <p className="text-[11px] text-slate-400 truncate max-w-[280px]">
                        {student?.direccion_recogida}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-bold text-amber-400 text-xs block">
                        {stopMeta?.hora_estimada.substring(0, 5) || '--:--'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {stopMeta?.distancia_desde_anterior_km || 0} km
                      </span>
                    </div>

                    {/* Move Up/Down Controls */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={idx === 0}
                        onClick={() => moveStudent(idx, 'up')}
                        title="Subir parada"
                        className="p-1 text-slate-400 hover:text-amber-400 disabled:opacity-20"
                      >
                        <MoveUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={idx === orderedStudentIds.length - 1}
                        onClick={() => moveStudent(idx, 'down')}
                        title="Bajar parada"
                        className="p-1 text-slate-400 hover:text-amber-400 disabled:opacity-20"
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
