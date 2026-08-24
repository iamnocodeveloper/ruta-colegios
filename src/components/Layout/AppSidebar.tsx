import React from 'react';
import { Home, Compass, Sparkles, Users, School, Truck, History, Building2, ArrowRight } from 'lucide-react';

export type StaffView = 'home' | 'driver' | 'parent' | 'planner' | 'students' | 'schools' | 'drivers' | 'sql' | 'history' | 'review' | 'clientes';

interface AppSidebarProps {
  currentView: StaffView;
  onNavigate: (view: StaffView) => void;
  showClientes?: boolean;
}

interface NavItem {
  id: string;
  view: StaffView;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'nav-home', view: 'home', label: 'Inicio', icon: Home },
  { id: 'nav-driver', view: 'driver', label: 'Cabina Conductor', icon: Compass },
  { id: 'nav-planner', view: 'planner', label: 'Planificador', icon: Sparkles },
  { id: 'nav-students', view: 'students', label: 'Alumnos', icon: Users },
  { id: 'nav-schools', view: 'schools', label: 'Colegios', icon: School },
  { id: 'nav-drivers', view: 'drivers', label: 'Conductores', icon: Truck },
  { id: 'nav-history', view: 'history', label: 'Historial', icon: History },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({ currentView, onNavigate, showClientes = false }) => {
  const items = showClientes
    ? [...NAV_ITEMS, { id: 'nav-clientes', view: 'clientes' as StaffView, label: 'Clientes', icon: Building2 }]
    : NAV_ITEMS;

  return (
    <aside className="hidden lg:flex w-[264px] shrink-0 flex-col bg-canvas border-r border-line px-4 py-5">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white text-xl shadow-soft">
          🚌
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-ink leading-tight">RutaEscolar</h1>
          <p className="text-[11px] font-semibold text-muted">Transporte Escolar</p>
        </div>
      </div>

      {/* Main Menu */}
      <nav className="flex flex-col gap-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;
          return (
            <button
              key={item.id}
              id={item.id}
              onClick={() => onNavigate(item.view)}
              className={`group flex items-center gap-3 rounded-chip px-3.5 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-surface text-primary shadow-soft border border-line'
                  : 'text-muted hover:text-ink hover:bg-white/70'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                  isActive ? 'bg-primary/10 text-primary' : 'bg-soft-gray text-muted group-hover:text-ink'
                }`}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={2} />
              </span>
              <span>{item.label}</span>
              {isActive && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}
            </button>
          );
        })}
      </nav>

      {/* CTA Banner */}
      <div className="mt-auto">
        <div className="relative overflow-hidden rounded-card bg-primary p-5 text-white shadow-soft">
          {/* Fluid pattern */}
          <svg
            className="absolute inset-0 h-full w-full opacity-20"
            viewBox="0 0 220 140"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M0 90 C 60 60, 90 110, 150 70 S 220 40, 220 40 L 220 140 L 0 140 Z"
              fill="white"
            />
            <path
              d="M0 110 C 70 90, 120 130, 220 100 L 220 140 L 0 140 Z"
              fill="white"
              opacity="0.6"
            />
          </svg>
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-wide text-white/80">Mejora tu ruta</p>
            <p className="mt-1 text-sm font-extrabold leading-snug">
              Optimiza con tráfico real
            </p>
            <button
              onClick={() => onNavigate('planner')}
              className="mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary transition-transform hover:scale-105 cursor-pointer"
              aria-label="Abrir planificador"
            >
              <ArrowRight className="h-4.5 w-4.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
