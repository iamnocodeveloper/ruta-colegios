import React, { useMemo, useState } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  MapPin,
  School,
  Truck,
  ChevronDown,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Hourglass,
  Sparkles,
  Zap,
  Database,
  History
} from 'lucide-react';
import type { Alumno, Colegio, Conductor, RutaDiaria } from '../../types';
import { formatFriendlyTime } from '../../services/routeCalculator';
import type { StaffView } from '../Layout/AppSidebar';

interface HomeDashboardProps {
  ruta: RutaDiaria;
  colegio: Colegio;
  alumnos: Alumno[];
  conductores: Conductor[];
  onNavigate: (view: StaffView) => void;
}

// ---------- Helpers ----------

function getStopStatusLabel(estado: string): { label: string; icon: React.ElementType; cls: string } {
  switch (estado) {
    case 'recogido':
      return { label: 'Recogido', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' };
    case 'ausente':
      return { label: 'Ausente', icon: AlertTriangle, cls: 'bg-rose-50 text-alert' };
    case 'completado':
      return { label: 'Completado', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' };
    default:
      return { label: 'Pendiente', icon: Hourglass, cls: 'bg-soft-gray text-muted' };
  }
}

function RouteGauge({ percent, label }: { percent: number; label: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle cx="72" cy="72" r={radius} fill="none" stroke="#F7F8FA" strokeWidth="12" />
        <circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke="#D2F638"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-extrabold text-ink">{Math.round(percent)}%</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</span>
      </div>
    </div>
  );
}

// ---------- Main Component ----------

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ ruta, colegio, alumnos, conductores, onNavigate }) => {
  const [filter, setFilter] = useState<'todos' | 'ruta' | 'alumnos' | 'sistema'>('todos');

  const paradas = ruta.paradas || [];
  const totalStops = paradas.length;
  const completedStops = paradas.filter((p) => p.estado === 'recogido' || p.estado === 'completado').length;
  const absentStops = paradas.filter((p) => p.estado === 'ausente').length;
  const progress = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;
  const pickedUp = completedStops;
  const pickUpPercent = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;
  const conductor = ruta.conductor || conductores[0];

  const nextStop = useMemo(() => {
    const pending = paradas.filter((p) => p.estado === 'pendiente').sort((a, b) => a.orden - b.orden);
    return pending[0];
  }, [paradas]);

  const activeDriver = useMemo(() => conductores.find((c) => c.id === ruta.conductor_id) || conductores[0], [conductores, ruta.conductor_id]);

  // Activity feed derived from real state
  const activities = useMemo(() => {
    const list: { id: string; type: 'ruta' | 'alumnos' | 'sistema'; title: string; desc: string; badge: string; badgeCls: string }[] = [];
    if (ruta.estado === 'en_curso') {
      list.push({ id: 'a1', type: 'ruta', title: 'Ruta en curso', desc: 'La ruta de hoy está activa. El conductor está en camino.', badge: 'En vivo', badgeCls: 'bg-emerald-50 text-emerald-600' });
    } else if (ruta.estado === 'completada') {
      list.push({ id: 'a1', type: 'ruta', title: 'Jornada completada', desc: 'Todos los estudiantes llegaron al colegio.', badge: 'Completa', badgeCls: 'bg-emerald-50 text-emerald-600' });
    } else {
      list.push({ id: 'a1', type: 'ruta', title: 'Ruta planificada', desc: 'La ruta está lista para iniciar.', badge: 'Lista', badgeCls: 'bg-soft-blue text-primary' });
    }
    if (absentStops > 0) {
      list.push({ id: 'a2', type: 'alumnos', title: `${absentStops} ausente${absentStops > 1 ? 's' : ''}`, desc: 'Estudiantes marcados como no presentados.', badge: 'Atención', badgeCls: 'bg-rose-50 text-alert' });
    }
    if (completedStops > 0) {
      list.push({ id: 'a3', type: 'alumnos', title: `${completedStops} recogido${completedStops > 1 ? 's' : ''}`, desc: 'Estudiantes a bordo confirmados por el conductor.', badge: 'OK', badgeCls: 'bg-emerald-50 text-emerald-600' });
    }
    list.push({ id: 'a4', type: 'sistema', title: 'InstantDB sincronizado', desc: 'Los datos se actualizan en tiempo real.', badge: 'Sync', badgeCls: 'bg-soft-blue text-primary' });
    return list;
  }, [ruta.estado, absentStops, completedStops]);

  const filteredActivities = filter === 'todos' ? activities : activities.filter((a) => a.type === filter);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5 max-w-[1400px] mx-auto">

        {/* ===== CENTRAL COLUMN (2/3) ===== */}
        <div className="xl:col-span-2 space-y-4 sm:space-y-5">

          {/* Main Card: Ruta de Hoy */}
          <div className="relative overflow-hidden rounded-card bg-primary p-5 sm:p-6 text-white shadow-soft">
            <svg className="absolute inset-0 h-full w-full opacity-15" viewBox="0 0 400 180" preserveAspectRatio="none" fill="none">
              <path d="M0 120 C 100 70, 180 150, 280 90 S 400 40, 400 40 L 400 180 L 0 180 Z" fill="white" />
              <path d="M0 150 C 120 120, 220 170, 400 130 L 400 180 L 0 180 Z" fill="white" opacity="0.5" />
            </svg>

            <div className="relative flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur text-xl">🎓</div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Ruta de Hoy</p>
                    <h3 className="text-lg sm:text-xl font-extrabold leading-tight">{colegio.nombre}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-neon px-3 py-1 text-[11px] font-extrabold text-ink">
                    {ruta.estado === 'en_curso' ? '● En Curso' : ruta.estado === 'completada' ? '✓ Completada' : 'Planificada'}
                  </span>
                  <button className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold backdrop-blur hover:bg-white/25 transition-colors cursor-pointer">
                    Hoy <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
                    <Clock className="h-3.5 w-3.5" /> Salida
                  </div>
                  <p className="mt-1 text-lg font-extrabold">{formatFriendlyTime(ruta.hora_salida_estimada)}</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
                    <School className="h-3.5 w-3.5" /> Llegada
                  </div>
                  <p className="mt-1 text-lg font-extrabold">{formatFriendlyTime(ruta.hora_llegada_objetivo)}</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
                    <MapPin className="h-3.5 w-3.5" /> Distancia
                  </div>
                  <p className="mt-1 text-lg font-extrabold">{ruta.distancia_total_km} km</p>
                </div>
                <div className="rounded-2xl bg-white/12 p-3 backdrop-blur">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
                    <Truck className="h-3.5 w-3.5" /> Paradas
                  </div>
                  <p className="mt-1 text-lg font-extrabold">{totalStops}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary font-extrabold text-sm">
                    {conductor?.nombre?.split(' ').map((p) => p[0]).slice(0, 2).join('') || 'C'}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{conductor?.nombre || 'Sin conductor'}</p>
                    <p className="text-[11px] text-white/70">{conductor?.vehiculo_placa || 'Sin unidad'}</p>
                  </div>
                </div>
                <button
                  id="btn-home-open-cockpit"
                  onClick={() => onNavigate('driver')}
                  className="flex items-center gap-2 rounded-chip bg-white px-4 py-2.5 text-sm font-extrabold text-primary shadow-soft hover:bg-white/90 transition-colors cursor-pointer"
                >
                  Abrir Cabina <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          {/* KPIs (grid 2 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {/* Asistencia / Recogidos */}
            <div className="rounded-card bg-surface border border-line p-5 shadow-soft">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-blue text-primary">
                  <Users className="h-5 w-5" strokeWidth={2} />
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${pickUpPercent >= 60 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-alert'}`}>
                  {pickUpPercent >= 60 ? 'Bien encaminado' : 'Atención'}
                </span>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-ink">{pickUpPercent}%</p>
              <p className="text-xs font-bold text-muted">Recogidos ({pickedUp}/{totalStops})</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-soft-gray">
                <div
                  className={`h-full rounded-full transition-all ${pickUpPercent >= 60 ? 'bg-primary' : 'bg-alert'}`}
                  style={{ width: `${pickUpPercent}%` }}
                />
              </div>
              <button
                id="btn-home-go-stops"
                onClick={() => onNavigate('driver')}
                className="mt-4 flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline cursor-pointer"
              >
                Ver lista de paradas <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Matrícula */}
            <div className="rounded-card bg-surface border border-line p-5 shadow-soft">
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-blue text-primary">
                  <UserCheck className="h-5 w-5" strokeWidth={2} />
                </div>
                <span className="rounded-full bg-soft-gray px-2.5 py-1 text-[11px] font-extrabold text-ink">Completa</span>
              </div>
              <p className="mt-4 text-3xl font-extrabold text-ink">{alumnos.length}</p>
              <p className="text-xs font-bold text-muted">Alumnos matriculados</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{completedStops} recogidos</span>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-alert">{absentStops} ausentes</span>
              </div>
              <button
                id="btn-home-go-students"
                onClick={() => onNavigate('students')}
                className="mt-4 flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline cursor-pointer"
              >
                Gestionar alumnos <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Progreso de Ruta */}
          <div className="rounded-card bg-surface border border-line p-5 sm:p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-ink">Progreso de Ruta</h3>
                <p className="text-xs font-semibold text-muted">Rendimiento del trayecto de hoy</p>
              </div>
              <span className="rounded-full bg-soft-gray px-2.5 py-1 text-[11px] font-extrabold text-ink">{totalStops} paradas</span>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row items-center gap-6">
              <div className="rounded-2xl bg-ink p-4">
                <RouteGauge percent={progress} label="completado" />
              </div>

              <div className="flex-1 w-full space-y-3">
                {/* Best performer: next stop */}
                <div className="flex items-center gap-3 rounded-2xl bg-soft-gray p-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon text-ink">
                    <Sparkles className="h-4.5 w-4.5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Próxima parada</p>
                    <p className="truncate text-sm font-extrabold text-ink">
                      {nextStop?.alumno?.nombre || (totalStops > 0 ? 'Todas completadas' : 'Sin paradas')}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-primary shrink-0">{nextStop ? formatFriendlyTime(nextStop.hora_estimada) : '—'}</span>
                </div>

                {/* Worst performer: remaining time */}
                <div className="flex items-center gap-3 rounded-2xl bg-soft-gray p-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-soft-blue text-primary">
                    <Clock className="h-4.5 w-4.5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Tiempo restante estimado</p>
                    <p className="text-sm font-extrabold text-ink">{ruta.tiempo_total_estimado_min} min</p>
                  </div>
                  <span className={`text-xs font-extrabold shrink-0 ${ruta.estado === 'en_curso' ? 'text-emerald-600' : 'text-muted'}`}>
                    {ruta.estado === 'en_curso' ? 'En camino' : 'Planificada'}
                  </span>
                </div>

                {/* Driver summary */}
                <div className="flex items-center gap-3 rounded-2xl bg-soft-gray p-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Truck className="h-4.5 w-4.5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Conductor asignado</p>
                    <p className="truncate text-sm font-extrabold text-ink">{activeDriver?.nombre || 'Sin asignar'}</p>
                  </div>
                  <button
                    id="btn-home-go-drivers"
                    onClick={() => onNavigate('drivers')}
                    className="text-xs font-extrabold text-primary hover:underline shrink-0 cursor-pointer"
                  >
                    Ver flota
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== RIGHT COLUMN (1/3) ===== */}

        {/* Timeline de Paradas de Hoy */}
        <div className="rounded-card bg-surface border border-line p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-ink flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-primary" /> Paradas de Hoy
            </h3>
          </div>

          {/* Date navigator */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => {
              const isToday = i === 2;
              return (
                <div
                  key={d}
                  className={`flex min-w-[42px] flex-col items-center rounded-chip px-2 py-1.5 text-center cursor-pointer transition-colors ${
                    isToday ? 'bg-primary text-white shadow-soft' : 'bg-soft-gray text-muted hover:bg-line'
                  }`}
                >
                  <span className="text-[10px] font-bold">{d}</span>
                  <span className="text-sm font-extrabold">{17 + i}</span>
                </div>
              );
            })}
          </div>

          {/* Timeline */}
          <div className="mt-4 space-y-0">
            {paradas.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-muted">
                <Hourglass className="h-8 w-8" />
                <p className="text-xs font-bold">Sin paradas planificadas</p>
              </div>
            )}
            {paradas.map((p, idx) => {
              const status = getStopStatusLabel(p.estado);
              const StatusIcon = status.icon;
              const isLast = idx === paradas.length - 1;
              return (
                <div key={p.id} className="relative flex gap-3 pb-4">
                  {!isLast && <span className="absolute left-[13px] top-7 bottom-0 w-px border-l border-dashed border-line" />}
                  <div className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${status.cls}`}>
                    <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0 rounded-2xl bg-soft-gray px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-extrabold text-ink">{p.alumno?.nombre || 'Alumno'}</p>
                      <span className="shrink-0 text-[11px] font-extrabold text-primary">{formatFriendlyTime(p.hora_estimada)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-muted">
                      Parada #{p.orden} · {p.distancia_desde_anterior_km || 0} km
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            id="btn-home-open-timeline"
            onClick={() => onNavigate('driver')}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-chip bg-soft-blue py-2.5 text-xs font-extrabold text-primary hover:bg-blue-100 transition-colors cursor-pointer"
          >
            Ver cabina completa <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Panel "Lo nuevo" */}
        <div className="rounded-card bg-surface border border-line p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-ink flex items-center gap-2">
              <Bell className="h-4.5 w-4.5 text-primary" /> Lo nuevo
            </h3>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-soft-gray text-[11px] font-extrabold text-muted">
              {filteredActivities.length}
            </span>
          </div>

          {/* Filter chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {([
              ['todos', 'Todos'],
              ['ruta', 'Ruta'],
              ['alumnos', 'Alumnos'],
              ['sistema', 'Sistema'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold transition-colors cursor-pointer ${
                  filter === key ? 'bg-primary text-white shadow-soft' : 'bg-soft-gray text-muted hover:bg-line'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Feed */}
          <div className="mt-4 space-y-2.5">
            {filteredActivities.map((a) => (
              <div key={a.id} className="rounded-2xl border border-line bg-soft-gray p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-ink">{a.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${a.badgeCls}`}>{a.badge}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-muted">{a.desc}</p>
              </div>
            ))}
            {filteredActivities.length === 0 && (
              <p className="py-6 text-center text-xs font-bold text-muted">Sin actividad para este filtro</p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 rounded-chip bg-soft-gray py-2 text-[11px] font-bold text-muted">
            <Zap className="h-3.5 w-3.5 text-primary" /> En vivo vía InstantDB
          </div>
        </div>

        {/* Mini footer links */}
        <div className="xl:col-span-3 flex items-center justify-center gap-4">
          <button
            id="btn-home-history"
            onClick={() => onNavigate('history')}
            className="flex items-center gap-1.5 text-[11px] font-bold text-muted hover:text-primary transition-colors cursor-pointer"
          >
            <History className="h-3.5 w-3.5" /> Historial de Rutas
          </button>
          <button
            onClick={() => onNavigate('sql')}
            className="flex items-center gap-1.5 text-[11px] font-bold text-muted hover:text-primary transition-colors cursor-pointer"
            title="Acceso interno"
          >
            <Database className="h-3.5 w-3.5" /> Esquema SQL & DB
          </button>
        </div>
      </div>
    </div>
  );
};
