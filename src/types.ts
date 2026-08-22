/**
 * Data Model Types for Sistema de Optimización de Rutas y Seguimiento de Transporte Escolar
 * Aligned with PostgreSQL / Insforge Schema & PWA Specifications
 */

export interface Colegio {
  id: string;
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
  hora_llegada_limite: string; // e.g. "08:00:00"
  contacto_telefono?: string;
  created_at?: string;
}

export interface Representante {
  id: string;
  nombre: string;
  telefono_whatsapp: string; // e.g. "+584121234567" or "+34600123456"
  magic_token: string; // unique UUID token for frictionless parent portal access
  email?: string;
  created_at?: string;
}

export type ModalidadTransporte = 'ida_y_vuelta' | 'solo_ida' | 'solo_vuelta';
export type TipoTrayecto = 'ida' | 'vuelta';

export interface Conductor {
  id: string;
  nombre: string;
  telefono: string;
  email?: string;
  licencia?: string;
  vehiculo_modelo?: string;
  vehiculo_placa?: string;
  capacidad_pasajeros?: number;
  foto_url?: string;
  activo: boolean;
  created_at?: string;
}

export interface Alumno {
  id: string;
  nombre: string;
  colegio_id: string;
  representante_id: string;
  direccion_recogida: string;
  lat: number;
  lng: number;
  grado?: string;
  notas_medicas?: string;
  tiempo_abordaje_estimado_min?: number; // default 2.5 min
  modalidad_servicio?: ModalidadTransporte; // 'ida_y_vuelta' | 'solo_ida' | 'solo_vuelta'
  activo_en_rutas?: boolean; // false = excluido de las rutas (no se le asigna parada)
  created_at?: string;
  // Joined fields for UI convenience
  colegio?: Colegio;
  representante?: Representante;
}

export type ModoOptimizacion = 'fijo' | 'trafico_real';
export type EstadoRuta = 'planificada' | 'en_curso' | 'completada' | 'cancelada';
export type EstadoParada = 'pendiente' | 'recogido' | 'completado' | 'ausente';

export interface ParadaRuta {
  id: string;
  ruta_id: string;
  alumno_id: string;
  orden: number;
  hora_estimada: string; // e.g. "07:15:00"
  hora_real?: string;
  estado: EstadoParada;
  lat: number;
  lng: number;
  distancia_desde_anterior_km?: number;
  tiempo_desde_anterior_min?: number;
  alumno?: Alumno;
}

export interface RutaDiaria {
  id: string;
  fecha: string; // YYYY-MM-DD
  colegio_id: string;
  origen_lat: number;
  origen_lng: number;
  origen_direccion?: string;
  modo_optimizacion: ModoOptimizacion;
  tipo_trayecto?: TipoTrayecto; // 'ida' (mañana: casa -> colegio) | 'vuelta' (tarde: colegio -> casa)
  hora_llegada_objetivo: string; // e.g. "08:00:00"
  hora_salida_estimada: string; // calculated by algorithm e.g. "06:58:00"
  hora_salida_real?: string;
  hora_llegada_real?: string;
  tiempo_manejo_estimado_min: number; // T_manejo
  tiempo_abordaje_total_min: number; // N * T_abordaje
  tiempo_total_estimado_min: number; // T_total
  distancia_total_km: number;
  estado: EstadoRuta;
  tiempo_abordaje_por_alumno_min: number; // e.g. 2.5 min
  created_at?: string;
  colegio?: Colegio;
  conductor_id?: string;
  conductor?: Conductor;
  paradas: ParadaRuta[];
  polyline_geometry?: [number, number][]; // lat/lng pairs for map route line
}

export interface TrackingLog {
  id?: string;
  ruta_id: string;
  lat: number;
  lng: number;
  velocidad_kmh?: number;
  rumbo_grados?: number;
  timestamp: string; // ISO 8601
}

export interface RouteOptimizationRequest {
  origen: { lat: number; lng: number; direccion?: string };
  colegio_id: string;
  alumno_ids: string[];
  hora_llegada_limite: string; // "08:00:00"
  modo: ModoOptimizacion;
  tipo_trayecto?: TipoTrayecto;
  tiempo_abordaje_min: number; // default 2.5
  orden_manual?: string[]; // student ids in fixed order if manual
}

export interface RouteOptimizationResult {
  hora_salida_estimada: string;
  tiempo_manejo_min: number;
  tiempo_abordaje_total_min: number;
  tiempo_total_min: number;
  distancia_total_km: number;
  tipo_trayecto: TipoTrayecto;
  paradas_ordenadas: Array<{
    alumno_id: string;
    orden: number;
    hora_estimada: string;
    distancia_desde_anterior_km: number;
    tiempo_desde_anterior_min: number;
    lat: number;
    lng: number;
  }>;
  polyline_geometry: [number, number][];
  traffic_factor: number;
}
