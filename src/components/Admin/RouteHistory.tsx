/**
 * Route History View
 * Lists all created routes with full data. Read-only review links, reuse for today, delete.
 */
import React, { useMemo, useState } from 'react';
import {
  History,
  Copy,
  Check,
  Calendar,
  Clock,
  MapPin,
  Users,
  Truck,
  Eye,
  RefreshCw,
  Trash2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Hourglass,
  School
} from 'lucide-react';
import { RouteHistoryEntry, buildRouteReviewLink, deleteRouteHistory } from '../../services/routeHistory';
import { formatFriendlyTime } from '../../services/routeCalculator';

interface RouteHistoryProps {
  history: RouteHistoryEntry[];
  onReview: (entry: RouteHistoryEntry) => void;
  onUseToday: (entry: RouteHistoryEntry) => void;
  onDelete?: (entry: RouteHistoryEntry) => void;
  onBack: () => void;
}

function statusBadge(estado: string) {
  switch (estado) {
    case 'en_curso':
      return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600 border border-emerald-200">● En Curso</span>;
    case 'completada':
      return <span className="rounded-full bg-soft-blue px-2 py-0.5 text-[10px] font-extrabold text-primary border border-primary/25">✓ Completada</span>;
    default:
      return <span className="rounded-full bg-soft-gray px-2 py-0.5 text-[10px] font-extrabold text-muted border border-line">Planificada</span>;
  }
}

function stopStateIcon(estado: string) {
  if (estado === 'recogido' || estado === 'completado') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (estado === 'ausente') return <AlertTriangle className="h-3.5 w-3.5 text-alert" />;
  return <Hourglass className="h-3.5 w-3.5 text-muted" />;
}

export const RouteHistory: React.FC<RouteHistoryProps> = ({
  history,
  onReview,
  onUseToday,
  onDelete,
  onBack
}) => {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) =>
        h.colegio_nombre.toLowerCase().includes(q) ||
        h.conductor_nombre.toLowerCase().includes(q) ||
        h.fecha.includes(q) ||
        h.id.toLowerCase().includes(q)
    );
  }, [history, search]);

  const copyReviewLink = (entry: RouteHistoryEntry) => {
    navigator.clipboard.writeText(buildRouteReviewLink(entry.id));
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="h-full overflow-y-auto bg-canvas p-4 sm:p-6">
      <div className="max-w-[1200px] mx-auto space-y-4">
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
              <h2 className="text-lg font-black text-ink flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <span>Historial de Rutas ({history.length})</span>
              </h2>
              <p className="text-xs text-muted">
                Todas las rutas creadas, con sus paradas, conductor, colegio y resultados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-surface border border-line px-3 py-2 text-muted">
            <span className="text-xs font-semibold">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por colegio, conductor, fecha..."
              className="w-56 bg-transparent text-xs text-ink placeholder:text-muted focus:outline-none"
            />
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="rounded-card bg-surface border border-line p-10 text-center text-muted">
            <History className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-bold">Aún no hay rutas guardadas</p>
            <p className="text-xs mt-1">Crea una ruta en el Planificador y se guardará automáticamente aquí.</p>
          </div>
        )}

        {/* History list */}
        <div className="space-y-3">
          {filtered.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="rounded-card bg-surface border border-line shadow-soft overflow-hidden">
                {/* Summary row */}
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <School className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-ink text-sm truncate">{entry.colegio_nombre}</h3>
                      {statusBadge(entry.estado)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted font-semibold">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{entry.fecha}</span>
                      {entry.dia_semana && (
                        <span className="rounded bg-primary/10 text-primary border border-primary/25 px-1.5 py-0.5 text-[10px] font-extrabold">
                          {entry.dia_semana}
                        </span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Salida {formatFriendlyTime(entry.hora_salida_estimada)}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{entry.distancia_total_km} km</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{entry.total_paradas} paradas</span>
                      <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{entry.conductor_nombre}</span>
                      {entry.variante && (
                        <span className="rounded bg-soft-blue text-primary border border-primary/25 px-1.5 py-0.5 text-[10px] font-extrabold">
                          Variante: {entry.variante}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center gap-2 text-[11px] font-extrabold">
                    <span className="rounded-full bg-emerald-50 text-emerald-600 px-2 py-1">✓ {entry.recogidos}</span>
                    <span className="rounded-full bg-rose-50 text-alert px-2 py-1">✗ {entry.ausentes}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 border-t border-line/70 bg-soft-gray px-4 py-2.5">
                  <button
                    id={`btn-history-review-${entry.id}`}
                    onClick={() => onReview(entry)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-blue-600 transition-colors cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> Ver Recorrido
                  </button>
                  <button
                    id={`btn-history-copy-${entry.id}`}
                    onClick={() => copyReviewLink(entry)}
                    className="flex items-center gap-1.5 rounded-lg bg-surface border border-line px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-line transition-colors cursor-pointer"
                  >
                    {copiedId === entry.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === entry.id ? '¡Link Copiado!' : 'Copiar Link de Revisión'}
                  </button>
                  <button
                    id={`btn-history-reuse-${entry.id}`}
                    onClick={() => onUseToday(entry)}
                    className="flex items-center gap-1.5 rounded-lg bg-surface border border-line px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-line transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Usar Hoy
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-surface border border-line px-3 py-1.5 text-[11px] font-bold text-muted hover:bg-line transition-colors cursor-pointer"
                  >
                    {isExpanded ? 'Ocultar Datos' : 'Ver Todos los Datos'}
                    <ArrowRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                  {onDelete && (
                    <button
                      id={`btn-history-delete-${entry.id}`}
                      onClick={() => onDelete(entry)}
                      className="ml-auto flex items-center gap-1.5 rounded-lg bg-surface border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-alert hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
                  )}
                </div>

                {/* Expanded: full data */}
                {isExpanded && (
                  <div className="border-t border-line/70 p-4 space-y-3 animate-fadeIn">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="rounded-xl bg-soft-gray p-2.5">
                        <p className="text-[10px] font-bold uppercase text-muted">Salida estimada</p>
                        <p className="font-extrabold text-ink mt-0.5">{formatFriendlyTime(entry.hora_salida_estimada)}</p>
                      </div>
                      <div className="rounded-xl bg-soft-gray p-2.5">
                        <p className="text-[10px] font-bold uppercase text-muted">Llegada límite</p>
                        <p className="font-extrabold text-ink mt-0.5">{formatFriendlyTime(entry.hora_llegada_objetivo)}</p>
                      </div>
                      <div className="rounded-xl bg-soft-gray p-2.5">
                        <p className="text-[10px] font-bold uppercase text-muted">Distancia total</p>
                        <p className="font-extrabold text-ink mt-0.5">{entry.distancia_total_km} km</p>
                      </div>
                      <div className="rounded-xl bg-soft-gray p-2.5">
                        <p className="text-[10px] font-bold uppercase text-muted">Tiempo total</p>
                        <p className="font-extrabold text-ink mt-0.5">{entry.tiempo_total_estimado_min} min</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="rounded-xl bg-soft-gray p-2.5">
                        <p className="text-[10px] font-bold uppercase text-muted">Modo</p>
                        <p className="font-extrabold text-ink mt-0.5 capitalize">{entry.modo_optimizacion === 'trafico_real' ? 'Tráfico real' : 'Estándar'}</p>
                      </div>
                      <div className="rounded-xl bg-soft-gray p-2.5">
                        <p className="text-[10px] font-bold uppercase text-muted">Trayecto</p>
                        <p className="font-extrabold text-ink mt-0.5 capitalize">{entry.tipo_trayecto === 'ida' ? 'Ida (Mañana)' : 'Vuelta (Tarde)'}</p>
                      </div>
                      <div className="rounded-xl bg-soft-gray p-2.5">
                        <p className="text-[10px] font-bold uppercase text-muted">Conductor</p>
                        <p className="font-extrabold text-ink mt-0.5 truncate">{entry.conductor_nombre}</p>
                      </div>
                      <div className="rounded-xl bg-soft-gray p-2.5">
                        <p className="text-[10px] font-bold uppercase text-muted">ID Ruta</p>
                        <p className="font-mono font-bold text-ink mt-0.5 truncate">{entry.id.substring(0, 13)}...</p>
                      </div>
                    </div>

                    {/* Stops list */}
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-muted mb-2">Paradas ({entry.total_paradas})</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {(entry.ruta.paradas || []).map((p, idx) => (
                          <div key={p.id || idx} className="flex items-center gap-2 rounded-lg bg-soft-gray px-2.5 py-1.5 text-[11px]">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface border border-line text-[9px] font-black text-primary shrink-0">
                              {p.orden}
                            </span>
                            <span className="truncate font-bold text-ink flex-1">{p.alumno?.nombre || 'Alumno'}</span>
                            <span className="text-muted font-mono">{formatFriendlyTime(p.hora_estimada)}</span>
                            {stopStateIcon(p.estado)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
