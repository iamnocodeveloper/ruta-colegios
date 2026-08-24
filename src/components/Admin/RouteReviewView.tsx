/**
 * Route Review View (Read-Only)
 * Shows a saved route's full journey: map, stops, times, driver, school.
 * No editing — just viewing the created route (shared via review link).
 */
import React from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Truck,
  School,
  CheckCircle2,
  AlertTriangle,
  Hourglass,
  Copy,
  Check,
  Phone,
  MessageCircle,
  FileText
} from 'lucide-react';
import { RouteHistoryEntry } from '../../services/routeHistory';
import { SchoolRouteMap } from '../Map/SchoolRouteMap';
import { formatFriendlyTime } from '../../services/routeCalculator';
import { generateRoutePdf } from '../../services/pdfReport';
import { getJourneys } from '../../services/routeJourneys';
import { ParadaRuta } from '../../types';

interface RouteReviewViewProps {
  entry: RouteHistoryEntry;
  alumnosMap: Map<string, any>;
  onBack: () => void;
}

function stateIcon(estado: string) {
  if (estado === 'recogido' || estado === 'completado') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (estado === 'ausente') return <AlertTriangle className="h-4 w-4 text-alert" />;
  return <Hourglass className="h-4 w-4 text-muted" />;
}

interface JourneyBlockProps {
  titulo?: string;
  paradas: ParadaRuta[];
  horaSalida: string;
  horaLlegada: string;
  polyline?: [number, number][];
  tipoTrayecto?: 'ida' | 'vuelta';
  colegio: any;
  origen: { lat: number; lng: number; direccion?: string };
  alumnosMap: Map<string, any>;
}

const JourneyBlock: React.FC<JourneyBlockProps> = ({
  titulo,
  paradas,
  horaSalida,
  horaLlegada,
  polyline,
  tipoTrayecto,
  colegio,
  origen,
  alumnosMap,
}) => {
  return (
    <div className="space-y-3">
      {titulo && (
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-extrabold text-ink text-sm">{titulo}</h3>
          <span className="rounded-full bg-soft-gray border border-line px-2 py-0.5 text-[10px] font-bold text-muted">
            {paradas.length} paradas · Salida {formatFriendlyTime(horaSalida)}
          </span>
        </div>
      )}

      <div className="rounded-card bg-surface border border-line p-3 shadow-soft">
        <div className="h-[300px] sm:h-[340px] rounded-2xl overflow-hidden">
          <SchoolRouteMap
            colegio={colegio}
            origen={origen}
            paradas={paradas}
            alumnosMap={alumnosMap}
            polylineGeometry={polyline}
            targetArrivalTime={horaLlegada}
            tipoTrayecto={tipoTrayecto || 'ida'}
            onOriginChange={undefined}
          />
        </div>
      </div>

      <div className="rounded-card bg-surface border border-line p-4 shadow-soft">
        <h3 className="font-extrabold text-ink text-sm mb-3">Itinerario de Paradas ({paradas.length})</h3>
        <div className="space-y-2">
          {paradas.map((p, idx) => {
            const alumno = alumnosMap.get(p.alumno_id) || p.alumno;
            const rep = alumno?.representante;
            const repPhone = rep?.telefono_whatsapp || '';
            const repPhoneDigits = repPhone.replace(/[^0-9]/g, '');
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.lat},${p.lng}`)}`;
            const wazeUrl = `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
            return (
              <div key={p.id || idx} className="rounded-xl bg-soft-gray px-3 py-2.5 text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface border border-line text-[10px] font-black text-primary">
                    {p.orden}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink truncate">{alumno?.nombre || 'Alumno'}</p>
                    <p className="text-[10px] text-muted truncate">{alumno?.direccion_recogida || 'Dirección no registrada'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted font-mono">{formatFriendlyTime(p.hora_estimada)}</span>
                    <span className="flex items-center gap-1 font-bold">
                      {stateIcon(p.estado)}
                      <span className={
                        p.estado === 'recogido' || p.estado === 'completado' ? 'text-emerald-600' :
                        p.estado === 'ausente' ? 'text-alert' : 'text-muted'
                      }>
                        {p.estado === 'recogido' || p.estado === 'completado' ? 'Recogido' : p.estado === 'ausente' ? 'Ausente' : 'Pendiente'}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-9">
                  <a
                    href={wazeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-surface border border-line px-2.5 py-1.5 text-[10px] font-extrabold text-ink hover:border-primary/40 hover:text-primary transition-colors"
                    title="Abrir en Waze"
                  >
                    🚗 Waze
                  </a>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-surface border border-line px-2.5 py-1.5 text-[10px] font-extrabold text-ink hover:border-primary/40 hover:text-primary transition-colors"
                    title="Abrir en Google Maps"
                  >
                    📍 Google Maps
                  </a>
                  {repPhoneDigits && (
                    <a
                      href={`tel:${repPhoneDigits}`}
                      className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/25 px-2.5 py-1.5 text-[10px] font-extrabold text-primary hover:bg-primary/20 transition-colors"
                      title={`Llamar al representante ${rep?.nombre || ''}`}
                    >
                      <Phone className="h-3 w-3" /> Llamar Representante
                    </a>
                  )}
                  {repPhoneDigits && (
                    <a
                      href={`https://wa.me/${repPhoneDigits}?text=${encodeURIComponent('Hola, le escribimos por la ruta escolar de RutaEscolar.')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-[10px] font-extrabold text-emerald-600 hover:bg-emerald-100 transition-colors"
                      title={`WhatsApp de ${rep?.nombre || 'representante'}`}
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp Rep.
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const RouteReviewView: React.FC<RouteReviewViewProps> = ({ entry, alumnosMap, onBack }) => {
  const ruta = entry.ruta;
  const [copied, setCopied] = React.useState(false);

  const journeys = getJourneys(ruta);
  const showJourneys = journeys.length > 0;

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/?view=review&routeId=${encodeURIComponent(entry.id)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const colegio = ruta.colegio || {
    id: ruta.colegio_id,
    nombre: entry.colegio_nombre,
    direccion: '',
    lat: ruta.paradas?.[0]?.lat || -0.1872,
    lng: ruta.paradas?.[0]?.lng || -78.4975,
    hora_llegada_limite: ruta.hora_llegada_objetivo
  };

  const origen = {
    lat: ruta.origen_lat,
    lng: ruta.origen_lng,
    direccion: ruta.origen_direccion
  };

  return (
    <div className="h-full overflow-y-auto bg-canvas p-4 sm:p-6">
      <div className="max-w-[1100px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface border border-line text-ink hover:bg-soft-gray transition-colors cursor-pointer"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-ink">Recorrido de Ruta</h2>
                <span className="rounded-full bg-soft-blue px-2 py-0.5 text-[10px] font-extrabold text-primary border border-primary/25">Solo Lectura</span>
              </div>
              <p className="text-xs text-muted">
                {entry.colegio_nombre} · {entry.fecha} · {entry.dia_semana || ''} · Creada el {new Date(entry.created_at).toLocaleString('es-EC')}
              </p>
            </div>
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-lg bg-surface border border-line px-3 py-2 text-xs font-bold text-ink hover:bg-line transition-colors cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '¡Link Copiado!' : 'Copiar Link de Revisión'}
          </button>
          <button
            onClick={() => generateRoutePdf(entry)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 transition-colors cursor-pointer"
            title="Descargar informe en PDF con el detalle de la ruta"
          >
            <FileText className="h-3.5 w-3.5" /> Descargar PDF
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-card bg-surface border border-line p-3.5 shadow-soft">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted">
              <Clock className="h-3.5 w-3.5 text-primary" /> Salida
            </div>
            <p className="mt-1 text-lg font-extrabold text-ink">{formatFriendlyTime(ruta.hora_salida_estimada)}</p>
          </div>
          <div className="rounded-card bg-surface border border-line p-3.5 shadow-soft">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted">
              <School className="h-3.5 w-3.5 text-primary" /> Llegada
            </div>
            <p className="mt-1 text-lg font-extrabold text-ink">{formatFriendlyTime(ruta.hora_llegada_objetivo)}</p>
          </div>
          <div className="rounded-card bg-surface border border-line p-3.5 shadow-soft">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Distancia
            </div>
            <p className="mt-1 text-lg font-extrabold text-ink">{ruta.distancia_total_km} km</p>
          </div>
          <div className="rounded-card bg-surface border border-line p-3.5 shadow-soft">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted">
              <Users className="h-3.5 w-3.5 text-primary" /> Paradas
            </div>
            <p className="mt-1 text-lg font-extrabold text-ink">{ruta.paradas?.length || 0}</p>
          </div>
        </div>

        {/* Driver + route info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-card bg-surface border border-line p-4 shadow-soft flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted">Conductor asignado</p>
              <p className="font-extrabold text-ink text-sm">{ruta.conductor?.nombre || entry.conductor_nombre || 'Sin conductor'}</p>
              <p className="text-[11px] text-muted">{ruta.conductor?.vehiculo_placa || 'Unidad no registrada'}</p>
            </div>
          </div>
          <div className="rounded-card bg-surface border border-line p-4 shadow-soft flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted">Tipo de ruta</p>
              <p className="font-extrabold text-ink text-sm capitalize">
                {showJourneys
                  ? `Ida + Vuelta (${journeys.length === 2 ? 'jornada completa' : '1 jornada'})`
                  : ruta.tipo_trayecto === 'ida'
                  ? 'Ida (Mañana)'
                  : 'Vuelta (Tarde)'}
              </p>
              <p className="text-[11px] text-muted capitalize">
                {ruta.modo_optimizacion === 'trafico_real' ? 'Modo tráfico real' : 'Modo estándar'} · Tiempo total {ruta.tiempo_total_estimado_min} min
                {ruta.variante ? ` · Variante: ${ruta.variante}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Map + Stops (una por trayecto; ruta combinada muestra IDA y VUELTA) */}
        {showJourneys ? (
          <div className="space-y-6">
            {journeys.map((j) => (
              <JourneyBlock
                key={j.tipo_trayecto}
                titulo={j.tipo_trayecto === 'ida' ? '🌅 Recorrido IDA (Hogares ➔ Colegio)' : '🌇 Recorrido VUELTA (Colegio ➔ Hogares)'}
                paradas={j.paradas || []}
                horaSalida={j.hora_salida_estimada}
                horaLlegada={j.hora_llegada_objetivo}
                polyline={j.polyline_geometry}
                tipoTrayecto={j.tipo_trayecto}
                colegio={colegio}
                origen={origen}
                alumnosMap={alumnosMap}
              />
            ))}
          </div>
        ) : (
          <JourneyBlock
            paradas={ruta.paradas || []}
            horaSalida={ruta.hora_salida_estimada}
            horaLlegada={ruta.hora_llegada_objetivo}
            polyline={ruta.polyline_geometry}
            tipoTrayecto={ruta.tipo_trayecto || 'ida'}
            colegio={colegio}
            origen={origen}
            alumnosMap={alumnosMap}
          />
        )}
      </div>
    </div>
  );
};
