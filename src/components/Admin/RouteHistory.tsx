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
  School,
  FileText,
  Pencil,
  Plus,
  List,
  CalendarDays
} from 'lucide-react';
import { RouteHistoryEntry, buildRouteReviewLink, deleteRouteHistory } from '../../services/routeHistory';
import { formatFriendlyTime } from '../../services/routeCalculator';
import { generateRoutePdf } from '../../services/pdfReport';
import { getJourneys } from '../../services/routeJourneys';
import { countSiblingsInStop } from '../../services/siblings';

interface RouteHistoryProps {
  history: RouteHistoryEntry[];
  onReview: (entry: RouteHistoryEntry) => void;
  onUseToday: (entry: RouteHistoryEntry) => void;
  onEdit?: (entry: RouteHistoryEntry) => void;
  onCreateNew?: () => void;
  onDelete?: (entry: RouteHistoryEntry) => void;
  onBack: () => void;
}

const DAY_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Lunes (00:00) de la semana ISO a la que pertenece `dateStr` (YYYY-MM-DD). */
function startOfIsoWeek(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0=Dom..6=Sáb
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
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
  onEdit,
  onCreateNew,
  onDelete,
  onBack
}) => {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'lista' | 'semana'>('lista');

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

  // Agrupa por semana (Lun-Dom) y, dentro de cada semana, por día de la semana —
  // para responder de un vistazo "¿qué rutas hubo esta semana / tal día?".
  const weeklyGroups = useMemo(() => {
    if (viewMode !== 'semana') return [];
    const weeks = new Map<string, { start: Date; days: Map<string, RouteHistoryEntry[]> }>();
    filtered.forEach((entry) => {
      if (!entry.fecha) return;
      const start = startOfIsoWeek(entry.fecha);
      const weekKey = start.toISOString().substring(0, 10);
      if (!weeks.has(weekKey)) weeks.set(weekKey, { start, days: new Map() });
      const week = weeks.get(weekKey)!;
      const dayLabel = entry.dia_semana || DAY_ORDER[(new Date(`${entry.fecha}T00:00:00`).getDay() + 6) % 7];
      if (!week.days.has(dayLabel)) week.days.set(dayLabel, []);
      week.days.get(dayLabel)!.push(entry);
    });
    return Array.from(weeks.values())
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .map((week) => ({
        label: formatWeekLabel(week.start),
        days: DAY_ORDER.filter((d) => week.days.has(d)).map((d) => ({ day: d, entries: week.days.get(d)! }))
      }));
  }, [filtered, viewMode]);

  const copyReviewLink = (entry: RouteHistoryEntry) => {
    navigator.clipboard.writeText(buildRouteReviewLink(entry.id));
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Una tarjeta de ruta completa (resumen + acciones + datos expandidos). Se reutiliza
  // tanto en la vista de Lista como en la vista Semanal para no duplicar el marcado.
  const renderEntry = (entry: RouteHistoryEntry) => {
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
              {entry.tiene_ida && entry.tiene_vuelta && (
                <span className="rounded bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-extrabold">
                  🌀 Ida {entry.paradas_ida ?? '—'} · Vuelta {entry.paradas_vuelta ?? '—'}
                </span>
              )}
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
            id={`btn-history-pdf-${entry.id}`}
            onClick={() => generateRoutePdf(entry)}
            className="flex items-center gap-1.5 rounded-lg bg-surface border border-primary/30 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
            title="Descargar informe en PDF con el detalle de la ruta"
          >
            <FileText className="h-3.5 w-3.5" /> Generar PDF
          </button>
          <button
            id={`btn-history-reuse-${entry.id}`}
            onClick={() => onUseToday(entry)}
            className="flex items-center gap-1.5 rounded-lg bg-surface border border-line px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-line transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Usar Hoy
          </button>
          {onEdit && (
            <button
              id={`btn-history-edit-${entry.id}`}
              onClick={() => onEdit(entry)}
              className="flex items-center gap-1.5 rounded-lg bg-surface border border-primary/30 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
              title="Abrir esta ruta en el Planificador para editar paradas, horario o conductor"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          )}
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
              {(() => {
                const journeys = getJourneys(entry.ruta);
                const groups = journeys.length > 0
                  ? journeys.map((jj) => ({ label: jj.tipo_trayecto === 'ida' ? '🌅 IDA (Mañana)' : '🌇 VUELTA (Tarde)', stops: jj.paradas || [] }))
                  : [{ label: null, stops: entry.ruta.paradas || [] }];
                return (
                  <div className="space-y-3">
                    {groups.map((g) => (
                      <div key={g.label || 'legacy'}>
                        {g.label && (
                          <p className="text-[10px] font-black uppercase tracking-wide text-primary mb-1.5">
                            {g.label} ({g.stops.length})
                          </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {g.stops.map((p, idx) => {
                            const map = new Map<string, any>();
                            g.stops.forEach((s) => {
                              if (s.alumno) map.set(s.alumno_id, s.alumno);
                            });
                            const siblingCount = countSiblingsInStop(p, g.stops, map);
                            return (
                            <div key={p.id || idx} className="rounded-lg bg-soft-gray px-2.5 py-1.5 text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface border border-line text-[9px] font-black text-primary shrink-0">
                                  {p.orden}
                                </span>
                                <span className="truncate font-bold text-ink flex-1">
                                  {p.alumno?.nombre || 'Alumno'}
                                  {siblingCount >= 2 && (
                                    <span className="ml-1.5 text-[8px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded">
                                      👨‍👩‍👧 {siblingCount} hermanos
                                    </span>
                                  )}
                                </span>
                                <span className="text-muted font-mono">{formatFriendlyTime(p.hora_estimada)}</span>
                                {stopStateIcon(p.estado)}
                              </div>
                              <div className="mt-1 flex items-center gap-1 pl-7">
                                <a
                                  href={`https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded bg-surface border border-line px-1.5 py-0.5 text-[8px] font-extrabold text-ink hover:border-primary/40 hover:text-primary transition-colors"
                                  title="Abrir en Waze"
                                >
                                  🚗 Waze
                                </a>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.lat},${p.lng}`)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded bg-surface border border-line px-1.5 py-0.5 text-[8px] font-extrabold text-ink hover:border-primary/40 hover:text-primary transition-colors"
                                  title="Abrir en Google Maps"
                                >
                                  📍 Maps
                                </a>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
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

          <div className="flex flex-wrap items-center gap-2">
            {onCreateNew && (
              <button
                id="btn-history-new-route"
                onClick={onCreateNew}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-white hover:bg-blue-600 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Nueva Ruta
              </button>
            )}

            <div className="flex items-center rounded-xl bg-surface border border-line p-1 text-xs font-bold">
              <button
                onClick={() => setViewMode('lista')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer ${
                  viewMode === 'lista' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-ink'
                }`}
              >
                <List className="h-3.5 w-3.5" /> Lista
              </button>
              <button
                onClick={() => setViewMode('semana')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer ${
                  viewMode === 'semana' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-ink'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Semanal
              </button>
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
        </div>

        {filtered.length === 0 && (
          <div className="rounded-card bg-surface border border-line p-10 text-center text-muted">
            <History className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-bold">Aún no hay rutas guardadas</p>
            <p className="text-xs mt-1">Crea una ruta en el Planificador y se guardará automáticamente aquí.</p>
          </div>
        )}

        {/* History list */}
        {viewMode === 'lista' && (
          <div className="space-y-3">{filtered.map((entry) => renderEntry(entry))}</div>
        )}

        {/* Weekly view: agrupada por semana y, dentro de cada semana, por día */}
        {viewMode === 'semana' && (
          <div className="space-y-6">
            {weeklyGroups.length === 0 && filtered.length > 0 && (
              <div className="rounded-card bg-surface border border-line p-6 text-center text-muted text-xs">
                Ninguna de las rutas filtradas tiene fecha para agrupar por semana.
              </div>
            )}
            {weeklyGroups.map((week) => (
              <div key={week.label} className="space-y-3">
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  Semana del {week.label}
                </h3>
                <div className="space-y-4">
                  {week.days.map(({ day, entries }) => (
                    <div key={day} className="space-y-2">
                      <span className="inline-flex items-center rounded-full bg-primary/10 text-primary border border-primary/25 px-2.5 py-0.5 text-[10px] font-extrabold">
                        {day} · {entries.length} {entries.length === 1 ? 'ruta' : 'rutas'}
                      </span>
                      <div className="space-y-3">{entries.map((entry) => renderEntry(entry))}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
