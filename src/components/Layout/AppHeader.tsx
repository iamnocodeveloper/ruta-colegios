import React from 'react';
import { Menu, X, Search, Bell, Settings, LogOut, Home, Compass, Sparkles, Users, School, Truck, History } from 'lucide-react';
import { InstantSyncBadge } from '../Auth/InstantSyncBadge';
import { APP_VERSION } from '../../services/appUpdate';
import type { StaffView } from './AppSidebar';

interface AppHeaderProps {
  currentView: StaffView;
  demoUser: { email: string; rol: string; nombre: string } | null;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
  onNavigate: (view: StaffView) => void;
  onToggleMobileMenu: () => void;
  mobileMenuOpen: boolean;
}

const VIEW_TITLES: Record<StaffView, string> = {
  home: 'Inicio',
  driver: 'Cabina Conductor',
  parent: 'Portal Representante',
  planner: 'Planificador & Salida',
  students: 'Gestión de Alumnos',
  schools: 'Colegios',
  drivers: 'Conductores',
  sql: 'Esquema SQL',
  history: 'Historial de Rutas',
  review: 'Revisión de Ruta',
};

const MOBILE_ITEMS: { id: string; view: StaffView; label: string; icon: React.ElementType }[] = [
  { id: 'nav-home', view: 'home', label: 'Inicio', icon: Home },
  { id: 'nav-driver', view: 'driver', label: 'Cabina Conductor', icon: Compass },
  { id: 'nav-planner', view: 'planner', label: 'Planificador', icon: Sparkles },
  { id: 'nav-students', view: 'students', label: 'Alumnos', icon: Users },
  { id: 'nav-schools', view: 'schools', label: 'Colegios', icon: School },
  { id: 'nav-drivers', view: 'drivers', label: 'Conductores', icon: Truck },
  { id: 'nav-history', view: 'history', label: 'Historial', icon: History },
];

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentView,
  demoUser,
  onOpenAuthModal,
  onSignOut,
  onNavigate,
  onToggleMobileMenu,
  mobileMenuOpen,
}) => {
  const initials = demoUser?.nombre
    ?.split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'A';

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6 z-30">
        {/* Left: mobile hamburger + contextual title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden rounded-chip bg-soft-gray p-2 text-ink hover:bg-line transition-colors cursor-pointer"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold text-ink">{VIEW_TITLES[currentView]}</h2>
            <p className="hidden sm:block text-[11px] font-semibold text-muted">
              RutaEscolar · Transporte en tiempo real
              <span className="ml-1.5 rounded bg-soft-gray border border-line px-1 py-0.5 text-[9px] font-black text-primary">v{APP_VERSION}</span>
            </p>
          </div>
        </div>

        {/* Right: tools */}
        <div className="flex items-center gap-2">
          {/* Decorative search */}
          <div className="hidden md:flex items-center gap-2 rounded-chip bg-soft-gray px-3 py-2 text-muted">
            <Search className="h-4 w-4" />
            <span className="text-xs font-semibold">Buscar...</span>
          </div>

          <InstantSyncBadge onOpenAuthModal={onOpenAuthModal} demoUser={demoUser} />

          {/* Notifications */}
          <button className="relative rounded-chip bg-soft-gray p-2 text-muted hover:text-ink hover:bg-line transition-colors cursor-pointer" aria-label="Notificaciones">
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-alert text-[9px] font-bold text-white">2</span>
          </button>

          {/* Settings */}
          <button className="hidden sm:flex rounded-chip bg-soft-gray p-2 text-muted hover:text-ink hover:bg-line transition-colors cursor-pointer" aria-label="Configuración">
            <Settings className="h-4.5 w-4.5" />
          </button>

          {/* Profile avatar */}
          <div className="flex items-center gap-2 rounded-chip bg-soft-gray py-1.5 pl-1.5 pr-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-white">
              {initials}
            </div>
            <span className="hidden xl:block max-w-[120px] truncate text-xs font-bold text-ink">{demoUser?.nombre || 'Admin'}</span>
          </div>

          {/* Sign out */}
          <button
            id="btn-staff-logout"
            onClick={onSignOut}
            title="Cerrar Sesión"
            className="flex items-center gap-1.5 rounded-chip bg-soft-gray px-2.5 py-2 text-muted hover:text-alert hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-semibold">Salir</span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden z-40 bg-surface border-b border-line px-3 py-3 grid grid-cols-2 gap-2 text-xs font-bold shadow-soft">
          {MOBILE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.id}
                id={item.id}
                onClick={() => {
                  onNavigate(item.view);
                  onToggleMobileMenu();
                }}
                className={`p-2.5 rounded-chip flex items-center gap-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white shadow-soft'
                    : 'bg-soft-gray text-ink hover:bg-line'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};
