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
  Sparkles,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  Navigation,
  Car,
  Users,
  Check,
  RotateCcw,
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
  ShieldCheck,
  Route,
  Palette,
  CalendarDays,
  GripVertical,
  ListOrdered,
  Save
} from 'lucide-react';
import { Reorder, useDragControls } from 'motion/react';
import { Alumno, Colegio, Conductor, ModoOptimizacion, ParadaRuta, RouteOptimizationResult, RutaDiaria, RutaTrayecto, TipoTrayecto } from '../../types';
import {
  calculateOptimizedRoute,
  formatFriendlyTime,
  filterStudentsForJourney,
  generateRouteVariants,
  variantDistance,
  weekdayLabel,
  normalizeDays,
  validateSchedule,
  buildPolylineFromLegs,
  minutesToTimeString,
  timeStringToMinutes
} from '../../services/routeCalculator';
import type { ScheduleValidation } from '../../services/routeCalculator';
import { SchoolRouteMap } from '../Map/SchoolRouteMap';
import { LocationPicker } from '../Map/LocationPicker';
import { ensureUUID } from '../../services/instantDb';

export const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

export const ROUTE_VARIANT_COLORS: Record<string, { color: string; dash: string; label: string }> = {
  '2opt': { color: '#0084FF', dash: '0', label: 'Óptima' },
  nearest: { color: '#10B981', dash: '6, 4', label: 'Vecino Cercano' },
  farthest: { color: '#F59E0B', dash: '2, 6', label: 'Extremos Primero' },
  random: { color: '#8B5CF6', dash: '10, 4', label: 'Aleatoria' },
  manual: { color: '#EF4444', dash: '4, 4', label: 'Manual' },
};

// Ruta alternativa (estilo Google Maps): cian punteado, fuera de la paleta de variantes
export const ROUTE_ALT_COLOR = '#06B6D4';
export const ROUTE_ALT_DASH = '6, 4';

interface StopRowProps {
  studentId: string;
  index: number;
  total: number;
  student?: Alumno;
  stopMeta?: ParadaRuta;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/** Plan guardado de una jornada (ida o vuelta) para el registro completo. */
interface JourneyPlan {
  tipo_trayecto: TipoTrayecto;
  result: RouteOptimizationResult;
  studentIds: string[];
  variantId: string;
  isManual: boolean;
  horaLlegada: string;
  rutaElegida: number; // 0 = principal, 1..n = alternativa
  // Horario elegido (hora de salida + hora de llegada) y validación
  horaSalidaDeseada?: string;
  horaLlegadaDeseada?: string;
  horarioValido?: boolean;
  mensajeHorario?: string;
  horaLlegadaEstimada?: string;
  // Tramos elegidos por tramo/parada: legIndex -> alternativa (0 = principal)
  tramosElegidos?: Record<number, number>;
}

const StopRow: React.FC<StopRowProps> = ({
  studentId,
  index,
  total,
  student,
  stopMeta,
  onMoveUp,
  onMoveDown
}) => {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={studentId}
      dragListener={false}
      dragControls={controls}
      className="flex items-center justify-between gap-3 rounded-lg bg-soft-gray p-2.5 border border-line hover:border-line transition-all text-xs"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white font-black text-xs">
          #{index + 1}
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
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            title="Subir parada"
            className="p-1 text-muted hover:text-primary disabled:opacity-20 cursor-pointer"
          >
            <MoveUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            title="Bajar parada"
            className="p-1 text-muted hover:text-primary disabled:opacity-20 cursor-pointer"
          >
            <MoveDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Drag handle */}
        <div className="flex flex-col items-center gap-0.5 pl-1 border-l border-line">
          <button
            type="button"
            onPointerDown={(e) => controls.start(e)}
            title="Arrastrar para reordenar"
            className="p-1 text-muted hover:text-primary cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="text-[8px] text-muted leading-none">mover</span>
        </div>
      </div>
    </Reorder.Item>
  );
};

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
  
  // Route variants & day selection
  const [selectedDay, setSelectedDay] = useState<string>(weekdayLabel(new Date()));
  const [variants, setVariants] = useState<{ id: string; label: string; description: string; studentIds: string[] }[]>([]);
  const [activeVariantId, setActiveVariantId] = useState<string>('2opt');

  // Eligible / Available students (default to all students of school or all registered)
  const schoolStudents = useMemo(() => {
    const list = allAlumnos.filter((s) => !s.colegio_id || s.colegio_id === selectedColegio.id);
    return list.length > 0 ? list : allAlumnos;
  }, [allAlumnos, selectedColegio.id]);

  // Auto-load students according to their configuration:
  // active in routes + attending selected day + matching journey type (ida/vuelta)
  const eligibleStudents = useMemo(() => {
    return filterStudentsForJourney(schoolStudents, tipoTrayecto, selectedDay);
  }, [schoolStudents, tipoTrayecto, selectedDay]);

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    () => eligibleStudents.map((s) => s.id)
  );

  // When day / direction / students change, re-select the eligible list automatically
  useEffect(() => {
    setSelectedStudentIds(eligibleStudents.map((s) => s.id));
  }, [eligibleStudents.map((s) => s.id).join(','), tipoTrayecto, selectedDay]);

  const [horaLlegada, setHoraLlegada] = useState<string>(() => {
    if (activeRuta.hora_llegada_objetivo) return activeRuta.hora_llegada_objetivo;
    return tipoTrayecto === 'ida' ? (selectedColegio.hora_llegada_limite || '08:00:00') : '14:00:00';
  });

  // ===== Horario elegido por el usuario: Hora de SALIDA + Hora de LLEGADA =====
  // Ambos campos están SIEMPRE visibles. Si se dejan vacíos, el sistema calcula
  // la hora faltante (salida inversa en ida / llegada estimada en vuelta).
  const [horaSalidaDeseada, setHoraSalidaDeseada] = useState<string>(() => {
    if (activeRuta.hora_salida_deseada) return activeRuta.hora_salida_deseada;
    return '';
  });
  const [horaLlegadaDeseada, setHoraLlegadaDeseada] = useState<string>(() => {
    if (activeRuta.hora_llegada_deseada) return activeRuta.hora_llegada_deseada;
    return '';
  });
  const [horarioValidacion, setHorarioValidacion] = useState<ScheduleValidation | null>(null);
  // Tramos elegidos por tramo/parada: legIndex -> índice de alternativa (0 = principal)
  const [tramosElegidos, setTramosElegidos] = useState<Record<number, number>>({});

  const [modo, setModo] = useState<ModoOptimizacion>('fijo');
  const [tiempoAbordajeMin, setTiempoAbordajeMin] = useState<number>(2.5);
  const [orderedStudentIds, setOrderedStudentIds] = useState<string[]>([]);
  const [isManualOrder, setIsManualOrder] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<RouteOptimizationResult | null>(null);
  const [isOriginPickerOpen, setIsOriginPickerOpen] = useState<boolean>(false);

  // Collapsible itinerary + reorder-from-map mode
  const [isItineraryOpen, setIsItineraryOpen] = useState<boolean>(false);
  const [mapReorderMode, setMapReorderMode] = useState<boolean>(false);
  const [mapReorderSequence, setMapReorderSequence] = useState<string[]>([]);

  // Staged journeys for a combined route (ida + vuelta)
  const [idaPlan, setIdaPlan] = useState<JourneyPlan | null>(null);
  const [vueltaPlan, setVueltaPlan] = useState<JourneyPlan | null>(null);

  // Ruta de conducción elegida (estilo Google Maps): 0 = principal, 1..n = alternativa
  const [rutaElegida, setRutaElegida] = useState<number>(0);

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

  // When school changes, select all students of this school (now handled by eligibleStudents effect)

  // ===== Inputs del cálculo según el horario elegido =====
  // Hora ancla: ida -> llegada al colegio (elegida o límite del colegio);
  // vuelta -> salida del colegio (elegida o por defecto 14:00).
  const calcHoraLlegada =
    tipoTrayecto === 'ida'
      ? horaLlegadaDeseada || horaLlegada
      : horaSalidaDeseada || horaLlegada;
  // La hora que fija el usuario es la de la PRIMERA parada (recogida/entrega del alumno 1)
  const calcHoraPrimeraParada = horaSalidaDeseada || undefined;

  /** Aplica el resultado de la optimización y valida el horario elegido (si aplica). */
  const applyOptimizationResult = (res: RouteOptimizationResult) => {
    setOptimizationResult(res);
    if (horaSalidaDeseada && horaLlegadaDeseada) {
      // El tiempo necesario DESDE la primera parada hasta la llegada final
      // = T_total - tiempo(base -> parada 1)
      const tiempoDesdePrimeraParada = Math.max(
        0,
        Math.round((res.tiempo_total_min - res.drive_time_base_to_primera_parada_min) * 10) / 10
      );
      setHorarioValidacion(
        validateSchedule(
          horaSalidaDeseada,
          horaLlegadaDeseada,
          tiempoDesdePrimeraParada,
          res.paradas_ordenadas.length
        )
      );
    } else {
      setHorarioValidacion(null);
    }
  };

  // Recalculate route whenever parameters change
  const runRouteCalculation = async (useManualOrder: boolean = false, variantId?: string) => {
    setIsCalculating(true);
    try {
      const studentsToRoute = selectedStudentIds
        .map((id) => alumnosMap.get(id))
        .filter(Boolean) as Alumno[];

      // Manual order: use it directly
      if (useManualOrder && orderedStudentIds.length > 0) {
        const orderedStudents = orderedStudentIds.map((id) => alumnosMap.get(id)!).filter(Boolean) as Alumno[];
        const result = await calculateOptimizedRoute(origen, selectedColegio, orderedStudents, {
          modo,
          tipoTrayecto,
          tiempoAbordajeMin,
          horaLlegadaLimite: calcHoraLlegada,
          horaPrimeraParada: calcHoraPrimeraParada,
          ordenManual: orderedStudentIds
        });
        applyOptimizationResult(result);
        setIsManualOrder(true);
        return;
      }

      // Generate route variants (different orderings)
      const startPoint = tipoTrayecto === 'ida' ? origen : { lat: selectedColegio.lat, lng: selectedColegio.lng };
      const endPoint = tipoTrayecto === 'ida' ? { lat: selectedColegio.lat, lng: selectedColegio.lng } : origen;
      const generated = generateRouteVariants(startPoint, endPoint, studentsToRoute);
      setVariants(generated);

      // Determine which variant to compute
      const targetVariantId = variantId || activeVariantId;
      const targetVariant = generated.find((v) => v.id === targetVariantId) || generated[0];
      const variantStudents = targetVariant.studentIds
        .map((id) => alumnosMap.get(id)!)
        .filter(Boolean) as Alumno[];

      const result = await calculateOptimizedRoute(origen, selectedColegio, variantStudents, {
        modo,
        tipoTrayecto,
        tiempoAbordajeMin,
        horaLlegadaLimite: calcHoraLlegada,
        horaPrimeraParada: calcHoraPrimeraParada,
        ordenManual: targetVariant.studentIds
      });

      applyOptimizationResult(result);
      setOrderedStudentIds(result.paradas_ordenadas.map((p) => p.alumno_id));
      setActiveVariantId(targetVariant.id);
      setIsManualOrder(false);
    } catch (err) {
      console.error('Calculation error:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  // Select a variant (recalculate with that ordering)
  const selectVariant = (variantId: string) => {
    setActiveVariantId(variantId);
    const variant = variants.find((v) => v.id === variantId);
    if (!variant) return;
    setOrderedStudentIds(variant.studentIds);
    setIsManualOrder(false);

    const variantStudents = variant.studentIds.map((id) => alumnosMap.get(id)!).filter(Boolean) as Alumno[];
    calculateOptimizedRoute(origen, selectedColegio, variantStudents, {
      modo,
      tipoTrayecto,
      tiempoAbordajeMin,
      horaLlegadaLimite: calcHoraLlegada,
      horaPrimeraParada: calcHoraPrimeraParada,
      ordenManual: variant.studentIds
    }).then((res) => applyOptimizationResult(res));
  };

  useEffect(() => {
    runRouteCalculation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedColegio, origen, selectedStudentIds, modo, tiempoAbordajeMin, horaLlegada, tipoTrayecto, horaSalidaDeseada, horaLlegadaDeseada]);

  // Cada nuevo cálculo vuelve a la ruta de conducción principal
  useEffect(() => {
    setRutaElegida(0);
  }, [optimizationResult]);

  // ===== Rutas alternativas (estilo Google Maps): derivados para el mapa =====
  const alternativasRuta = optimizationResult?.alternativas || [];
  const varianteMeta = ROUTE_VARIANT_COLORS[activeVariantId] || ROUTE_VARIANT_COLORS['2opt'];
  const altElegida = rutaElegida > 0 ? alternativasRuta[rutaElegida - 1] : undefined;

  // ===== Tramos (legs) entre paradas: polyline combinada según alternativas elegidas =====
  const legsRuta = optimizationResult?.legs || [];
  const tramosPolyline = legsRuta.length > 0 ? buildPolylineFromLegs(legsRuta, tramosElegidos) : [];
  const hasTramoChoices = Object.keys(tramosElegidos).length > 0 && tramosPolyline.length > 0;

  // ===== Tiempos ajustados automáticamente según la ruta/alternativa elegida =====
  // Resuelve la alternativa efectiva de cada tramo EXACTAMENTE como se dibuja en el mapa:
  //   - si hay tramos elegidos -> alternativa por tramo (los no elegidos usan la principal)
  //   - si no, y hay ruta global elegida (rutaElegida > 0) -> alternativa de cada tramo
  //   - si no -> ruta principal
  const chosenLegs = useMemo(() => {
    if (!optimizationResult?.legs || optimizationResult.legs.length === 0) return null;
    const useTramos = Object.keys(tramosElegidos).length > 0;
    return optimizationResult.legs.map((leg, i) => {
      let choice: number;
      if (useTramos) {
        choice = tramosElegidos[i] ?? 0;
      } else if (rutaElegida > 0 && leg.alternatives.length > 0) {
        choice = 1;
      } else {
        choice = 0;
      }
      return choice === 0 ? leg.main : leg.alternatives[choice - 1] || leg.main;
    });
  }, [optimizationResult, tramosElegidos, rutaElegida]);

  const hasRouteChoice = rutaElegida > 0 || Object.keys(tramosElegidos).length > 0;

  /**
   * Resultado con los tiempos recalculados para la ruta elegida:
   *   - T_manejo y distancia = suma de los tramos elegidos
   *   - T_total = T_manejo + abordaje
   *   - Hora de salida según el ancla (ida: salida inversa H_llegada - T_total;
   *     si se fijó la 1ª parada, se ancla en ella)
   *   - ETAs por parada redistribuidas según los tramos elegidos
   * Sin alternativas elegidas devuelve el resultado original (cero cambios).
   */
  const displayResult: RouteOptimizationResult | null = useMemo(() => {
    if (!optimizationResult || !chosenLegs || !hasRouteChoice) return optimizationResult;

    const N = optimizationResult.paradas_ordenadas.length;
    const abordajeTotal = optimizationResult.tiempo_abordaje_total_min;
    const manejoMin = Math.round(chosenLegs.reduce((s, a) => s + a.durationMin, 0) * 10) / 10;
    const distanciaKm = Math.round(chosenLegs.reduce((s, a) => s + a.distanceKm, 0) * 10) / 10;
    const totalMin = Math.round((manejoMin + abordajeTotal) * 10) / 10;

    // Hora de salida según el ancla del horario (misma lógica que calculateOptimizedRoute)
    let salidaMin: number;
    if (horaSalidaDeseada) {
      salidaMin = timeStringToMinutes(horaSalidaDeseada) - chosenLegs[0].durationMin;
    } else if (tipoTrayecto === 'ida') {
      const llegada = horaLlegadaDeseada || horaLlegada;
      salidaMin = timeStringToMinutes(llegada) - totalMin;
    } else {
      salidaMin = timeStringToMinutes(optimizationResult.hora_salida_estimada);
    }
    const salida = minutesToTimeString(salidaMin);

    // ETAs por parada: salida + tramos acumulados + abordaje por alumno
    const perStopAbordaje = N > 0 ? abordajeTotal / N : 0;
    let running = salidaMin;
    const paradas = optimizationResult.paradas_ordenadas.map((p, k) => {
      const leg = chosenLegs[k] || chosenLegs[chosenLegs.length - 1];
      running += leg.durationMin;
      const eta = minutesToTimeString(running);
      running += perStopAbordaje;
      return {
        ...p,
        hora_estimada: eta,
        distancia_desde_anterior_km: Math.round(leg.distanceKm * 10) / 10,
        tiempo_desde_anterior_min: Math.round(leg.durationMin * 10) / 10,
      };
    });

    return {
      ...optimizationResult,
      hora_salida_estimada: salida,
      tiempo_manejo_min: manejoMin,
      tiempo_total_min: totalMin,
      distancia_total_km: distanciaKm,
      paradas_ordenadas: paradas,
    };
  }, [optimizationResult, chosenLegs, hasRouteChoice, horaSalidaDeseada, horaLlegadaDeseada, horaLlegada, tipoTrayecto]);

  // Revalida el horario cuando cambian los tiempos por la ruta/alternativas elegidas
  useEffect(() => {
    if (!displayResult) return;
    if (horaSalidaDeseada && horaLlegadaDeseada) {
      const driveBaseToStop1 =
        hasRouteChoice && chosenLegs
          ? chosenLegs[0].durationMin
          : displayResult.drive_time_base_to_primera_parada_min;
      const tiempoDesdePrimeraParada = Math.max(
        0,
        Math.round((displayResult.tiempo_total_min - driveBaseToStop1) * 10) / 10
      );
      setHorarioValidacion(
        validateSchedule(
          horaSalidaDeseada,
          horaLlegadaDeseada,
          tiempoDesdePrimeraParada,
          displayResult.paradas_ordenadas.length
        )
      );
    } else {
      setHorarioValidacion(null);
    }
  }, [displayResult, horaSalidaDeseada, horaLlegadaDeseada, chosenLegs, hasRouteChoice]);

  const mapPolyline = hasTramoChoices
    ? tramosPolyline
    : altElegida
    ? altElegida.polyline
    : optimizationResult?.polyline_geometry;
  const mapPolylineColor = altElegida ? ROUTE_ALT_COLOR : varianteMeta.color;
  const mapPolylineDash = altElegida ? ROUTE_ALT_DASH : varianteMeta.dash;

  // Alternativas por TRAMO (legs) para dibujar en el mapa junto a la ruta elegida
  const legAlternativePolylines: {
    geometry: [number, number][];
    color: string;
    dash: string;
    label: string;
    distanceKm?: number;
    durationMin?: number;
    legIndex?: number;
    altIndex?: number;
  }[] = [];
  if (legsRuta.length > 0) {
    legsRuta.forEach((leg, i) => {
      const chosen = tramosElegidos[i] ?? 0;
      leg.alternatives.forEach((a, ai) => {
        const isChosen = chosen === ai + 1;
        legAlternativePolylines.push({
          geometry: a.polyline,
          color: isChosen ? '#22C55E' : ROUTE_ALT_COLOR,
          dash: isChosen ? '0' : ROUTE_ALT_DASH,
          label: `Tramo ${i + 1} · Alt ${ai + 1}${isChosen ? ' ✓' : ''}`,
          distanceKm: a.distanceKm,
          durationMin: a.durationMin,
          legIndex: i,
          altIndex: ai,
        });
      });
    });
  }

  const mapAlternativePolylines: {
    geometry: [number, number][];
    color: string;
    dash: string;
    label: string;
    distanceKm?: number;
    durationMin?: number;
  }[] = [];
  if (alternativasRuta.length > 0) {
    if (!altElegida) {
      alternativasRuta.forEach((a, i) => {
        mapAlternativePolylines.push({
          geometry: a.polyline,
          color: ROUTE_ALT_COLOR,
          dash: ROUTE_ALT_DASH,
          label: `Alternativa ${i + 1}`,
          distanceKm: a.distanceKm,
          durationMin: a.durationMin,
        });
      });
    } else {
      if (optimizationResult?.polyline_geometry) {
        mapAlternativePolylines.push({
          geometry: optimizationResult.polyline_geometry,
          color: varianteMeta.color,
          dash: varianteMeta.dash,
          label: 'Principal',
          distanceKm: optimizationResult.distancia_total_km,
          durationMin: optimizationResult.tiempo_manejo_min,
        });
      }
      alternativasRuta.forEach((a, i) => {
        if (i + 1 === rutaElegida) return;
        mapAlternativePolylines.push({
          geometry: a.polyline,
          color: ROUTE_ALT_COLOR,
          dash: ROUTE_ALT_DASH,
          label: `Alternativa ${i + 1}`,
          distanceKm: a.distanceKm,
          durationMin: a.durationMin,
        });
      });
    }
  }
  // Añadir las alternativas por tramo para que se dibujen sobre el mapa
  mapAlternativePolylines.push(...legAlternativePolylines);

  // Etiquetas de cada punto del recorrido (para nombrar los tramos en la UI)
  const waypointLabels = useMemo(() => {
    const labels: string[] = [];
    if (tipoTrayecto === 'vuelta') {
      labels.push('🏫 Colegio (Salida)');
      optimizationResult?.paradas_ordenadas.forEach((p) =>
        labels.push(`${p.orden}. ${alumnosMap.get(p.alumno_id)?.nombre || 'Parada'}`)
      );
      labels.push('🏁 Base / Retorno');
    } else {
      labels.push('🏁 Origen / Base');
      optimizationResult?.paradas_ordenadas.forEach((p) =>
        labels.push(`${p.orden}. ${alumnosMap.get(p.alumno_id)?.nombre || 'Parada'}`)
      );
      labels.push('🏫 Colegio');
    }
    return labels;
  }, [optimizationResult, alumnosMap, tipoTrayecto]);

  // Cuando cambia el orden de las paradas (nuevo cálculo), reiniciar los tramos elegidos
  useEffect(() => {
    setTramosElegidos({});
  }, [optimizationResult?.paradas_ordenadas.map((p) => p.alumno_id).join(',')]);

  // Selecciona la alternativa de un tramo tocándola directamente en el mapa
  const handleLegAlternativeClick = (legIndex: number, altIndex: number) => {
    setTramosElegidos((prev) => ({ ...prev, [legIndex]: altIndex }));
  };

  // Manual reordering handlers
  const applyManualOrder = (newOrder: string[]) => {
    if (newOrder.length === 0) return;
    setOrderedStudentIds(newOrder);
    setIsManualOrder(true);
    setActiveVariantId('manual');

    // Recalculate with this manual order
    const studentsToRoute = newOrder.map((id) => alumnosMap.get(id)!).filter(Boolean) as Alumno[];
    calculateOptimizedRoute(origen, selectedColegio, studentsToRoute, {
      modo,
      tipoTrayecto,
      tiempoAbordajeMin,
      horaLlegadaLimite: calcHoraLlegada,
      horaPrimeraParada: calcHoraPrimeraParada,
      ordenManual: newOrder
    }).then((res) => applyOptimizationResult(res));
  };

  const moveStudent = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= orderedStudentIds.length) return;

    const newOrder = [...orderedStudentIds];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(newIdx, 0, moved);

    applyManualOrder(newOrder);
  };

  // Drag & drop reorder (motion Reorder)
  const handleReorder = (newOrder: string[]) => {
    applyManualOrder(newOrder);
  };

  // Reorder from map markers: tap stops in the desired new order
  const totalStops = orderedStudentIds.length;
  const buildFullOrder = (seq: string[]) => {
    if (seq.length >= totalStops) return seq;
    const rest = orderedStudentIds.filter((id) => !seq.includes(id));
    return [...seq, ...rest];
  };

  const startMapReorder = () => {
    setMapReorderSequence([]);
    setMapReorderMode(true);
  };

  const cancelMapReorder = () => {
    setMapReorderMode(false);
    setMapReorderSequence([]);
  };

  const applyMapReorder = (seq: string[]) => {
    applyManualOrder(buildFullOrder(seq));
    setMapReorderMode(false);
    setMapReorderSequence([]);
  };

  const handleMarkerClick = (parada: ParadaRuta) => {
    if (!mapReorderMode) return;
    const studentId = parada.alumno_id;
    setMapReorderSequence((prev) => {
      // Re-tocar una parada ya marcada → desmarcarla (toggle), sin reiniciar
      if (prev.includes(studentId)) {
        return prev.filter((id) => id !== studentId);
      }
      const next = [...prev, studentId];
      // Al completar todas las paradas, aplicar el nuevo orden automáticamente
      if (next.length >= totalStops && totalStops > 0) {
        setTimeout(() => applyMapReorder(next), 0);
      }
      return next;
    });
  };

  // Toggle student selection
  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // ===== Combined journey staging (ida + vuelta en un solo registro) =====

  // Guarda el plan actual del trayecto visible (ida o vuelta) para el registro completo
  const saveJourneyPlan = (tipo: TipoTrayecto) => {
    if (!optimizationResult) return;
    const plan: JourneyPlan = {
      tipo_trayecto: tipo,
      result: displayResult || optimizationResult,
      studentIds:
        orderedStudentIds.length > 0
          ? orderedStudentIds
          : optimizationResult.paradas_ordenadas.map((p) => p.alumno_id),
      variantId: activeVariantId,
      isManual: isManualOrder,
      horaLlegada: calcHoraLlegada,
      rutaElegida,
      horaSalidaDeseada: horaSalidaDeseada || undefined,
      horaLlegadaDeseada: horaLlegadaDeseada || undefined,
      horarioValido: horarioValidacion?.valido,
      mensajeHorario: horarioValidacion?.mensaje,
      horaLlegadaEstimada: horarioValidacion?.horaLlegadaEstimada,
      tramosElegidos: Object.keys(tramosElegidos).length > 0 ? { ...tramosElegidos } : undefined,
    };
    if (tipo === 'ida') {
      setIdaPlan(plan);
    } else {
      setVueltaPlan(plan);
    }
  };

  // Construye el RutaTrayecto (jornada) a partir de un plan guardado
  const buildTrayecto = (plan: JourneyPlan): RutaTrayecto => {
    const paradas: ParadaRuta[] = plan.result.paradas_ordenadas.map((p) => ({
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

    // Polyline según la ruta de conducción elegida (principal / alternativa)
    const altElegida = (plan.result.alternativas || [])[plan.rutaElegida - 1];

    return {
      tipo_trayecto: plan.tipo_trayecto,
      paradas,
      hora_salida_estimada: plan.result.hora_salida_estimada,
      hora_llegada_objetivo: plan.horaLlegada,
      // Horario elegido (hora de salida + hora de llegada) y su validación
      hora_salida_deseada: plan.horaSalidaDeseada,
      hora_llegada_deseada: plan.horaLlegadaDeseada,
      horario_valido: plan.horarioValido,
      mensaje_horario: plan.mensajeHorario,
      hora_llegada_estimada: plan.horaLlegadaEstimada,
      // Tramos elegidos por tramo/parada
      tramos_elegidos: plan.tramosElegidos,
      tiempo_manejo_estimado_min: plan.result.tiempo_manejo_min,
      tiempo_abordaje_total_min: plan.result.tiempo_abordaje_total_min,
      tiempo_total_estimado_min: plan.result.tiempo_total_min,
      distancia_total_km: plan.result.distancia_total_km,
      tiempo_abordaje_por_alumno_min: tiempoAbordajeMin,
      modo_optimizacion: modo,
      variante: plan.variantId,
      polyline_geometry: altElegida ? altElegida.polyline : plan.result.polyline_geometry,
      polyline_alternativas: plan.result.alternativas || [],
      ruta_elegida: plan.rutaElegida,
    };
  };

  // Guarda el registro completo de la ruta con las jornadas elegidas (ida y/o vuelta)
  const handleSaveCompleteRoute = () => {
    const idaT = idaPlan ? buildTrayecto(idaPlan) : undefined;
    const vueltaT = vueltaPlan ? buildTrayecto(vueltaPlan) : undefined;
    if (!idaT && !vueltaT) return;

    // Trayecto principal para los campos top-level (legacy / primario)
    const primary = idaT || vueltaT!;
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
      tipo_trayecto: primary.tipo_trayecto,
      dia_semana: selectedDay,
      variante: primary.variante || activeVariantId,
      hora_llegada_objetivo: primary.hora_llegada_objetivo,
      hora_salida_estimada: primary.hora_salida_estimada,
      // Horario elegido + validación (persistido en BD)
      hora_salida_deseada: primary.hora_salida_deseada,
      hora_llegada_deseada: primary.hora_llegada_deseada,
      horario_valido: primary.horario_valido,
      mensaje_horario: primary.mensaje_horario,
      hora_llegada_estimada: primary.hora_llegada_estimada,
      tramos_elegidos: primary.tramos_elegidos,
      tiempo_manejo_estimado_min: primary.tiempo_manejo_estimado_min,
      tiempo_abordaje_total_min: primary.tiempo_abordaje_total_min,
      tiempo_total_estimado_min: primary.tiempo_total_estimado_min,
      distancia_total_km: primary.distancia_total_km,
      tiempo_abordaje_por_alumno_min: tiempoAbordajeMin,
      estado: 'planificada',
      hora_salida_real: undefined,
      hora_llegada_real: undefined,
      // Concatenación ida + vuelta para vistas legacy (Home/Padres)
      paradas: [...(idaT ? idaT.paradas : []), ...(vueltaT ? vueltaT.paradas : [])],
      polyline_geometry: primary.polyline_geometry,
      polyline_alternativas: primary.polyline_alternativas,
      ruta_elegida: primary.ruta_elegida,
      ida: idaT,
      vuelta: vueltaT,
    };

    onSaveRoute(updatedRuta);
    onSwitchToDriver();
  };

  return (
    <div className="flex h-full flex-col lg:flex-row bg-canvas text-ink overflow-hidden">
      {/* Left Configuration Column */}
      <div className="w-full lg:w-96 flex-shrink-0 border-r border-line bg-surface overflow-y-auto p-4 space-y-4 max-h-[42vh] lg:max-h-none lg:h-full">
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

        {/* Day of Week Selector */}
        <div className="rounded-xl border border-line bg-soft-gray p-3 space-y-2">
          <label className="text-[11px] font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Día de la Ruta</span>
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {WEEK_DAYS.map((day) => {
              const isActive = selectedDay === day;
              const count = schoolStudents.filter((s) => {
                const dias = normalizeDays(s.dias_ruta);
                return dias.includes(day) && s.activo_en_rutas !== false;
              }).length;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`flex flex-col items-center rounded-lg py-1.5 text-center border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-white border-primary font-black shadow-md'
                      : 'bg-surface border-line text-muted hover:text-ink hover:border-primary/40'
                  }`}
                >
                  <span className="text-[11px] font-black">{day}</span>
                  <span className={`text-[9px] font-bold ${isActive ? 'text-white/80' : 'text-muted'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted">
            Solo se cargan alumnos con ese día activo y según su modalidad (ida/vuelta).
          </p>
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
              Programación del Horario
            </label>
            <p className="text-[10px] text-muted mb-2">
              Coloca la hora a la que quieres <b className="text-ink">recoger al alumno de la PARADA 1</b> y la hora de{' '}
              <b className="text-ink">LLEGADA</b> deseada. El sistema calcula la salida de la base y las horas de las demás
              paradas, y avisa si las horas <b className="text-alert">NO coinciden</b> para el trayecto completo (todas las
              paradas). Deja una vacía para calcularla automáticamente.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-ink uppercase tracking-wider block mb-1">
                  🕗 Hora de la PRIMERA PARADA (recogida)
                </label>
                <input
                  type="time"
                  step="60"
                  value={horaSalidaDeseada ? horaSalidaDeseada.substring(0, 5) : ''}
                  onChange={(e) => setHoraSalidaDeseada(e.target.value ? e.target.value + ':00' : '')}
                  placeholder="--:--"
                  className="w-full rounded-lg bg-surface border border-line px-3 py-2 text-xs font-bold text-primary focus:border-primary/40 focus:outline-none"
                />
                <p className="text-[9px] text-muted mt-0.5">
                  {tipoTrayecto === 'ida' ? 'Recogida del alumno de la parada 1 (la base sale antes)' : 'Primera entrega de la parada 1 (el colegio sale antes)'}
                </p>
              </div>
              <div>
                <label className="text-[11px] font-bold text-ink uppercase tracking-wider block mb-1">
                  🏫 Hora de LLEGADA deseada
                </label>
                <input
                  type="time"
                  step="60"
                  value={horaLlegadaDeseada ? horaLlegadaDeseada.substring(0, 5) : ''}
                  onChange={(e) => setHoraLlegadaDeseada(e.target.value ? e.target.value + ':00' : '')}
                  placeholder="--:--"
                  className="w-full rounded-lg bg-surface border border-line px-3 py-2 text-xs font-bold text-primary focus:border-primary/40 focus:outline-none"
                />
                <p className="text-[9px] text-muted mt-0.5">
                  {tipoTrayecto === 'ida'
                    ? `Llegada al colegio (límite: ${(horaLlegada || selectedColegio.hora_llegada_limite || '08:00:00').substring(0, 5)})`
                    : 'Llegada a la base / retorno final'}
                </p>
              </div>
            </div>

            {horarioValidacion && (
              <div
                className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold leading-snug ${
                  horarioValidacion.valido
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-rose-300 bg-rose-50 text-rose-700'
                }`}
              >
                {horarioValidacion.valido ? '✅ ' : '⛔ '}
                {horarioValidacion.mensaje}
              </div>
            )}
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

        {/* Students Checklist with Modality Tag + Day config */}
        <div className="rounded-xl border border-line bg-soft-gray p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-ink uppercase tracking-wider">
              Alumnos en esta Ruta ({eligibleStudents.length}/{schoolStudents.length})
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedStudentIds(eligibleStudents.map((s) => s.id))}
                className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
              >
                Marcar todos ({eligibleStudents.length})
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
          <p className="text-[10px] text-muted">
            Lista cargada automáticamente según días configurados, modalidad (ida/vuelta) y estado activo.
          </p>

          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {schoolStudents.map((student) => {
              const mod = student.modalidad_servicio || 'ida_y_vuelta';
              const studentDays = normalizeDays(student.dias_ruta);
              const attendsToday = studentDays.includes(selectedDay);
              const matchesJourney =
                tipoTrayecto === 'ida'
                  ? mod === 'ida_y_vuelta' || mod === 'solo_ida'
                  : mod === 'ida_y_vuelta' || mod === 'solo_vuelta';
              const isEligible = student.activo_en_rutas !== false && attendsToday && matchesJourney;
              const isSelected = selectedStudentIds.includes(student.id);

              return (
                <label
                  key={student.id}
                  className={`flex items-center justify-between gap-2 rounded-lg p-2 text-xs border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 border-primary/30 text-ink shadow-sm'
                      : isEligible
                      ? 'bg-surface/60 border-line text-ink hover:border-line'
                      : 'bg-canvas/60 border-line text-muted opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isEligible}
                      onChange={() => toggleStudent(student.id)}
                      className="accent-primary h-4 w-4 rounded cursor-pointer"
                    />
                    <div className="truncate">
                      <span className={`font-bold truncate block ${isSelected ? 'text-ink' : isEligible ? 'text-ink' : 'text-muted'}`}>
                        {student.nombre}
                      </span>
                      <span className="text-[10px] text-muted truncate block">
                        {student.direccion_recogida}
                      </span>
                      <span className="flex items-center gap-0.5 mt-0.5">
                        {WEEK_DAYS.map((d) => (
                          <span
                            key={d}
                            className={`px-1 rounded text-[8px] font-bold ${
                              studentDays.includes(d)
                                ? d === selectedDay
                                  ? 'bg-primary text-white'
                                  : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : 'bg-canvas text-muted border border-line line-through'
                            }`}
                          >
                            {d}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right space-y-1">
                    {mod === 'ida_y_vuelta' && (
                      <span className="block text-[9px] font-bold text-emerald-600 bg-emerald-50/60 px-1.5 py-0.5 rounded border border-emerald-200">
                        🔄 Ida/Vuelta
                      </span>
                    )}
                    {mod === 'solo_ida' && (
                      <span className="block text-[9px] font-bold text-primary bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                        🌅 Solo Ida
                      </span>
                    )}
                    {mod === 'solo_vuelta' && (
                      <span className="block text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                        🌇 Solo Vuelta
                      </span>
                    )}
                    {!attendsToday && (
                      <span className="block text-[8px] font-bold text-muted bg-canvas px-1 py-0.5 rounded border border-line">
                        No va el {selectedDay}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Journey staging & complete save */}
        <div className="rounded-xl border-2 border-primary/30 bg-canvas p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Save className="h-3.5 w-3.5 text-primary" />
              <span>Jornadas a guardar</span>
            </label>
            <span className="text-[10px] font-bold text-muted">
              {[idaPlan ? 1 : 0, vueltaPlan ? 1 : 0].filter(Boolean).length}/2 listas
            </span>
          </div>
          <p className="text-[10px] text-muted">
            Configura y guarda cada trayecto (ida y vuelta). Al final guarda el registro completo con ambos.
          </p>

          <div className="space-y-2">
            {/* IDA plan */}
            <div className={`rounded-lg border p-2.5 space-y-1.5 ${idaPlan ? 'border-emerald-300 bg-emerald-50/50' : 'border-line bg-surface'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-black text-ink">
                  <Sun className="h-3.5 w-3.5 text-primary" /> Ruta de IDA
                </span>
                <span className={`text-[10px] font-extrabold ${idaPlan ? 'text-emerald-600' : 'text-muted'}`}>
                  {idaPlan ? `✓ ${idaPlan.result.paradas_ordenadas.length} paradas` : 'Pendiente'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => saveJourneyPlan('ida')}
                disabled={isCalculating || !optimizationResult || tipoTrayecto !== 'ida'}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 border border-primary/25 px-3 py-1.5 text-[11px] font-extrabold text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={tipoTrayecto !== 'ida' ? 'Cambia a la pestaña de Ruta de IDA para guardarla' : 'Guardar el plan de la mañana'}
              >
                <Save className="h-3 w-3" />
                {tipoTrayecto !== 'ida' ? 'Guardar Plan IDA (cambia a la pestaña IDA)' : 'Guardar Plan IDA'}
                {horarioValidacion && !horarioValidacion.valido && tipoTrayecto === 'ida' && (
                  <span className="ml-1 rounded bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.5 text-[8px] font-black">
                    ⚠️ Horas no coinciden
                  </span>
                )}
              </button>
            </div>

            {/* VUELTA plan */}
            <div className={`rounded-lg border p-2.5 space-y-1.5 ${vueltaPlan ? 'border-emerald-300 bg-emerald-50/50' : 'border-line bg-surface'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-black text-ink">
                  <Sunset className="h-3.5 w-3.5 text-purple-500" /> Ruta de VUELTA
                </span>
                <span className={`text-[10px] font-extrabold ${vueltaPlan ? 'text-emerald-600' : 'text-muted'}`}>
                  {vueltaPlan ? `✓ ${vueltaPlan.result.paradas_ordenadas.length} paradas` : 'Pendiente'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => saveJourneyPlan('vuelta')}
                disabled={isCalculating || !optimizationResult || tipoTrayecto !== 'vuelta'}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-purple-600/10 border border-purple-300/40 px-3 py-1.5 text-[11px] font-extrabold text-purple-600 hover:bg-purple-600/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={tipoTrayecto !== 'vuelta' ? 'Cambia a la pestaña de Ruta de VUELTA para guardarla' : 'Guardar el plan de la tarde'}
              >
                <Save className="h-3 w-3" />
                {tipoTrayecto !== 'vuelta' ? 'Guardar Plan VUELTA (cambia a la pestaña VUELTA)' : 'Guardar Plan VUELTA'}
                {horarioValidacion && !horarioValidacion.valido && tipoTrayecto === 'vuelta' && (
                  <span className="ml-1 rounded bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.5 text-[8px] font-black">
                    ⚠️ Horas no coinciden
                  </span>
                )}
              </button>
            </div>
          </div>

          <button
            id="btn-apply-plan"
            onClick={handleSaveCompleteRoute}
            disabled={isCalculating || (!idaPlan && !vueltaPlan)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 px-4 text-sm font-black text-ink shadow-lg shadow-primary/20 hover:bg-primary active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>
              {idaPlan && vueltaPlan
                ? `GUARDAR RUTA COMPLETA (IDA + VUELTA · ${idaPlan.result.paradas_ordenadas.length + vueltaPlan.result.paradas_ordenadas.length} paradas)`
                : idaPlan
                ? 'GUARDAR RUTA DE IDA'
                : vueltaPlan
                ? 'GUARDAR RUTA DE VUELTA'
                : 'GUARDAR REGISTRO COMPLETO DE RUTA'}
            </span>
          </button>
        </div>
      </div>

      {/* Right Content Area: Results Formula & Map Preview & Stop Reorder Table */}
      <div className="flex-1 min-h-0 flex flex-col p-4 space-y-4 overflow-y-auto">
        {/* INVERSE DEPARTURE / FORWARD COMPLETION TIME HERO CARD */}
        {displayResult && (
          <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 p-4 sm:p-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/25">
                  {tipoTrayecto === 'ida' ? 'Algoritmo de Salida Inversa (Mañana)' : 'Ruta de Vuelta Optimizada (Tarde)'}
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <h3 className="text-2xl sm:text-3xl font-black text-ink">
                    {tipoTrayecto === 'ida' ? 'Hora de Salida de Base:' : 'Hora de Salida del Colegio:'}{' '}
                    <span className="text-primary">{displayResult.hora_salida_estimada}</span>
                  </h3>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {horarioValidacion ? (
                    <>
                      Salida de base: <b className="text-primary">{displayResult.hora_salida_estimada.substring(0, 5)}</b> · 1ª parada:{' '}
                      <b className="text-primary">{horaSalidaDeseada.substring(0, 5)}</b> · Llegada estimada:{' '}
                      <b className={horarioValidacion.valido ? 'text-emerald-600' : 'text-alert'}>
                        {horarioValidacion.horaLlegadaEstimada.substring(0, 5)}
                      </b>{' '}
                      · Llegada deseada: <span className="text-ink font-semibold">{horaLlegadaDeseada.substring(0, 5)}</span> · T_total:{' '}
                      {displayResult.tiempo_total_min} min · {selectedStudentIds.length} paradas.
                    </>
                  ) : tipoTrayecto === 'ida' ? (
                    <>
                      El conductor debe partir a las <b className="text-primary">{displayResult.hora_salida_estimada}</b> para arribar a <span className="text-ink font-semibold">{selectedColegio.nombre}</span> exactamente a las <span className="text-primary font-semibold">{horaLlegada.substring(0, 5)}</span>.
                    </>
                  ) : (
                    <>
                      Partiendo del colegio a las <b className="text-primary">{displayResult.hora_salida_estimada}</b>, la entrega del último alumno se completará en aprox. <b className="text-ink">{displayResult.tiempo_total_min} min</b>.
                    </>
                  )}
                </p>
              </div>

              {/* Mathematical Equation Breakdown */}
              <div className="rounded-xl bg-surface/95 border border-line p-3 text-xs space-y-1">
                <div className="flex justify-between gap-4 text-muted">
                  <span>T_manejo proyectado:</span>
                  <b className="text-ink">{displayResult.tiempo_manejo_min} min</b>
                </div>
                <div className="flex justify-between gap-4 text-muted">
                  <span>{tipoTrayecto === 'ida' ? 'T_abordaje' : 'T_desembarque'} ({selectedStudentIds.length} × {tiempoAbordajeMin}):</span>
                  <b className="text-ink">{displayResult.tiempo_abordaje_total_min} min</b>
                </div>
                <div className="border-t border-line pt-1 flex justify-between gap-4 font-bold text-primary">
                  <span>T_total acumulado:</span>
                  <span>{displayResult.tiempo_total_min} min ({displayResult.distancia_total_km} km)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ⚠️ Banner: las horas NO coinciden para el trayecto (todas las paradas) */}
        {horarioValidacion && !horarioValidacion.valido && (
          <div className="rounded-2xl border-2 border-rose-400/60 bg-rose-50/90 p-4 flex items-start gap-3 shadow-lg">
            <ShieldAlert className="h-6 w-6 text-alert shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="text-sm font-black text-alert flex items-center gap-2">
                Las horas NO coinciden para el trayecto
              </h4>
              <p className="text-xs text-rose-800 leading-snug">{horarioValidacion.mensaje}</p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setHoraSalidaDeseada(horarioValidacion.horaAnclaRecomendada)}
                  className="rounded-md bg-alert text-white px-2.5 py-1 text-[10px] font-black hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  1ª parada a las {horarioValidacion.horaAnclaRecomendada.substring(0, 5)}
                </button>
                <button
                  type="button"
                  onClick={() => setHoraLlegadaDeseada(horarioValidacion.horaLlegadaEstimada)}
                  className="rounded-md bg-rose-200 text-rose-800 px-2.5 py-1 text-[10px] font-black hover:bg-rose-300 transition-colors cursor-pointer"
                >
                  Llegar a las {horarioValidacion.horaLlegadaEstimada.substring(0, 5)}
                </button>
              </div>
              <p className="text-[10px] text-rose-600">
                El trayecto completo con {selectedStudentIds.length} paradas necesita{' '}
                <b>{horarioValidacion.tiempoTotalMin} min</b> (manejo + abordaje). Usa los botones para ajustar el horario.
              </p>
            </div>
          </div>
        )}

        {/* Route Variants Selector */}
        {variants.length > 1 && (
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Variantes de Ruta
                </h4>
                <p className="text-[11px] text-muted">
                  Elige la variante que más te convenga. Cada una se dibuja con su color en el mapa.
                </p>
              </div>
              <span className="text-[10px] font-bold text-muted">{variants.length} opciones</span>
            </div>

            {(() => {
              // Compute haversine distance per variant and find the shortest
              const startPoint = tipoTrayecto === 'ida' ? origen : { lat: selectedColegio.lat, lng: selectedColegio.lng };
              const endPoint = tipoTrayecto === 'ida' ? { lat: selectedColegio.lat, lng: selectedColegio.lng } : origen;
              const withDist = variants.map((v) => ({
                ...v,
                distanceKm: variantDistance(startPoint, endPoint, v.studentIds, alumnosMap),
              }));
              const shortest = Math.min(...withDist.map((v) => v.distanceKm));

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {withDist.map((v) => {
                    const meta = ROUTE_VARIANT_COLORS[v.id] || ROUTE_VARIANT_COLORS['2opt'];
                    const isActive = activeVariantId === v.id;
                    const isShortest = v.distanceKm === shortest;
                    return (
                      <button
                        key={v.id}
                        onClick={() => selectVariant(v.id)}
                        className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                          isActive
                            ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/30'
                            : 'border-line bg-soft-gray hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-4 rounded-full"
                            style={{ backgroundColor: meta.color, boxShadow: `0 0 0 1px ${meta.color}55` }}
                          />
                          <span className={`text-[11px] font-black ${isActive ? 'text-primary' : 'text-ink'}`}>
                            {v.label}
                          </span>
                          {isShortest && (
                            <span className="ml-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 text-[8px] font-black">
                              MÁS CORTA
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-muted mt-0.5 truncate">{v.description}</p>
                        <p className="text-[10px] font-black text-primary mt-0.5">{v.distanceKm} km</p>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Rutas alternativas de conducción (estilo Google Maps) */}
        {alternativasRuta.length > 0 && optimizationResult && (
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Route className="h-4 w-4 text-primary" />
                  Rutas sugeridas (calles)
                </h4>
                <p className="text-[11px] text-muted">
                  Elige la ruta de conducción; ambas se dibujan en el mapa con su color.
                </p>
              </div>
              <span className="text-[10px] font-bold text-muted">{alternativasRuta.length + 1} opciones</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRutaElegida(0)}
                className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                  rutaElegida === 0
                    ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary/30'
                    : 'border-line bg-soft-gray hover:border-primary/40'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-5 rounded-full" style={{ backgroundColor: varianteMeta.color }} />
                  <span className={`text-[11px] font-black ${rutaElegida === 0 ? 'text-primary' : 'text-ink'}`}>
                    Ruta Principal
                  </span>
                  {rutaElegida === 0 && (
                    <span className="ml-auto rounded-full bg-primary/10 text-primary border border-primary/25 px-1.5 py-0.5 text-[8px] font-black">
                      ELEGIDA
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted mt-0.5">
                  {optimizationResult.distancia_total_km} km · {optimizationResult.tiempo_manejo_min} min
                </p>
              </button>

              {alternativasRuta.map((a, i) => {
                const isSel = rutaElegida === i + 1;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRutaElegida(i + 1)}
                    className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                      isSel
                        ? 'border-cyan-500 bg-cyan-50 shadow-md ring-1 ring-cyan-400/30'
                        : 'border-line bg-soft-gray hover:border-cyan-400/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-5 rounded-full" style={{ backgroundColor: ROUTE_ALT_COLOR }} />
                      <span className={`text-[11px] font-black ${isSel ? 'text-cyan-600' : 'text-ink'}`}>
                        Alternativa {i + 1}
                      </span>
                      {isSel && (
                        <span className="ml-auto rounded-full bg-cyan-500/15 text-cyan-600 border border-cyan-400/30 px-1.5 py-0.5 text-[8px] font-black">
                          ELEGIDA
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted mt-0.5">{a.distanceKm} km · {a.durationMin} min</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Map Preview Stage */}
        <div className={`relative w-full rounded-xl overflow-hidden border border-line ${isItineraryOpen ? 'h-[300px] sm:h-[360px] lg:h-[340px]' : 'h-[300px] sm:h-[380px] lg:h-[calc(100vh-320px)] lg:min-h-[420px]'}`}>
          <SchoolRouteMap
            colegio={{
              ...selectedColegio,
              hora_llegada_limite: calcHoraLlegada || selectedColegio.hora_llegada_limite
            }}
            targetArrivalTime={calcHoraLlegada}
            tipoTrayecto={tipoTrayecto}
            origen={origen}
            onOriginChange={onUpdateOrigen}
            paradas={
              displayResult
                ? displayResult.paradas_ordenadas.map((p) => ({
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
            polylineGeometry={mapPolyline}
            polylineColor={mapPolylineColor}
            polylineDash={mapPolylineDash}
            alternativePolylines={mapAlternativePolylines}
            onLegAlternativeClick={handleLegAlternativeClick}
            onMarkerClick={handleMarkerClick}
            reorderProgress={mapReorderMode ? { sequence: mapReorderSequence, total: totalStops } : null}
          />

          {/* Floating controls: reorder from map */}
          {!mapReorderMode ? (
            <button
              type="button"
              onClick={startMapReorder}
              disabled={totalStops < 2}
              title="Toca los marcadores en el orden deseado"
              className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold shadow-lg backdrop-blur transition-all border cursor-pointer bg-surface/90 text-primary border-primary/40 hover:bg-line hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>Editar Orden en Mapa</span>
            </button>
          ) : (
            <div className="absolute top-3 left-3 right-3 z-[400] rounded-lg bg-sky-950/95 border border-sky-500/60 px-3 py-2 text-xs font-bold text-sky-100 shadow-xl flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="flex-1 min-w-[180px]">
                ✏️ Toca los marcadores en el nuevo orden. Progreso:{' '}
                <span className="text-white">{mapReorderSequence.length}/{totalStops}</span>
              </span>
              {mapReorderSequence.length > 0 && (
                <button
                  type="button"
                  onClick={() => applyMapReorder(mapReorderSequence)}
                  className="rounded-md bg-emerald-500 text-slate-950 px-2.5 py-1 text-[10px] font-black hover:bg-emerald-400 cursor-pointer"
                >
                  Aplicar ({mapReorderSequence.length})
                </button>
              )}
              <button
                type="button"
                onClick={cancelMapReorder}
                className="rounded-md bg-white/10 border border-white/30 px-2.5 py-1 text-[10px] font-bold hover:bg-white/20 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Hint: tocar alternativas de tramo en el mapa */}
          {legsRuta.length > 0 && !mapReorderMode && (
            <div className="absolute bottom-3 right-3 z-[400] flex items-center gap-1.5 rounded-lg bg-surface/95 px-2.5 py-1.5 text-[10px] font-bold text-ink backdrop-blur border border-line shadow-lg">
              <Route className="h-3 w-3 text-cyan-600" />
              <span>Toca una línea punteada para elegir el tramo</span>
            </div>
          )}
        </div>

        {/* Elige la ruta por TRAMO (entre paradas consecutivas) — debajo del mapa */}
        {legsRuta.length > 0 && (
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                  <Route className="h-4 w-4 text-primary" />
                  Elige la ruta por tramo (entre paradas)
                </h4>
                <p className="text-[11px] text-muted mt-0.5">
                  Toca directamente en el mapa la línea punteada de la alternativa que prefieras para cada tramo,
                  o selecciónala aquí abajo. La ruta combinada se dibuja en el mapa.
                </p>
              </div>
              {hasTramoChoices && (
                <button
                  type="button"
                  onClick={() => setTramosElegidos({})}
                  className="flex items-center gap-1 text-[10px] font-bold text-muted hover:text-primary border border-line rounded-lg px-2 py-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restablecer
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {legsRuta.map((leg, i) => {
                const fromLabel = waypointLabels[i] || `Punto ${i + 1}`;
                const toLabel = waypointLabels[i + 1] || `Punto ${i + 2}`;
                const chosen = tramosElegidos[i] ?? 0;
                const options = [
                  { label: 'Principal', distanceKm: leg.main.distanceKm, durationMin: leg.main.durationMin },
                  ...leg.alternatives.map((a, ai) => ({
                    label: `Alternativa ${ai + 1}`,
                    distanceKm: a.distanceKm,
                    durationMin: a.durationMin,
                  })),
                ];
                return (
                  <div key={i} className="rounded-lg border border-line bg-soft-gray p-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-black text-ink">Tramo {i + 1}</span>
                      <span className="text-[10px] text-muted font-semibold truncate">
                        {fromLabel} → {toLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {options.map((opt, oi) => {
                        const isSel = chosen === oi;
                        return (
                          <button
                            key={oi}
                            type="button"
                            onClick={() =>
                              setTramosElegidos((prev) => ({ ...prev, [i]: oi }))
                            }
                            className={`rounded-lg border px-2 py-1.5 text-left transition-all cursor-pointer ${
                              isSel
                                ? oi === 0
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                  : 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400/30'
                                : 'border-line bg-surface hover:border-primary/40'
                            }`}
                          >
                            <span
                              className={`block text-[10px] font-black ${isSel ? 'text-ink' : 'text-muted'}`}
                            >
                              {isSel && '✓ '}
                              {opt.label}
                            </span>
                            <span className="block text-[9px] text-muted font-semibold">
                              {opt.distanceKm} km · {opt.durationMin} min
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasTramoChoices && (
              <p className="text-[10px] text-muted flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-600" />
                Tramos personalizados activos: la ruta dibujada usa la alternativa elegida en cada tramo.
              </p>
            )}
          </div>
        )}

        {/* Reordering & Intermediate Stops Table */}
        <div className="rounded-xl border border-line bg-surface/70 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsItineraryOpen(!isItineraryOpen)}
            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-soft-gray/60 transition-colors cursor-pointer"
          >
            <div>
              <h4 className="text-sm font-bold text-ink flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-primary" />
                Itinerario de {tipoTrayecto === 'ida' ? 'Recogida (Hogares ➔ Colegio)' : 'Entrega (Colegio ➔ Hogares)'}
              </h4>
              <p className="text-[11px] text-muted mt-0.5">
                {isManualOrder
                  ? 'Orden personalizado manualmente. Arrastra las filas o toca los marcadores del mapa para reordenar.'
                  : 'Orden óptimo calculado mediante Algoritmo TSP 2-Opt (mínima distancia y tiempo).'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {isManualOrder && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    runRouteCalculation(false);
                  }}
                  className="flex items-center gap-1 text-xs text-primary font-bold hover:underline cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restaurar Orden 2-Opt</span>
                </button>
              )}
              {isItineraryOpen ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
            </div>
          </button>

          {isItineraryOpen && (
            <div className="px-4 pb-4">
              <p className="text-[10px] text-muted mb-2 flex items-center gap-1.5">
                <GripVertical className="h-3 w-3" />
                Arrastra cada fila con el asa ⋮⋮ para cambiar el orden, o usa los marcadores del mapa
                (botón "Editar Orden en Mapa").
              </p>

              <Reorder.Group
                values={orderedStudentIds}
                onReorder={handleReorder}
                axis="y"
                className="space-y-2 max-h-60 overflow-y-auto pr-1 list-none"
              >
                {orderedStudentIds.map((studentId, idx) => {
                  const student = alumnosMap.get(studentId);
                  const stopMeta = displayResult?.paradas_ordenadas.find((p) => p.alumno_id === studentId);

                  return (
                    <StopRow
                      key={studentId}
                      studentId={studentId}
                      index={idx}
                      total={orderedStudentIds.length}
                      student={student}
                      stopMeta={stopMeta}
                      onMoveUp={() => moveStudent(idx, 'up')}
                      onMoveDown={() => moveStudent(idx, 'down')}
                    />
                  );
                })}
              </Reorder.Group>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
