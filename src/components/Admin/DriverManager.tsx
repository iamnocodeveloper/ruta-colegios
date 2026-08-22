/**
 * Driver Management Component (Gestión de Conductores y Flota)
 * Full CRUD for drivers with InstantDB real-time synchronization,
 * vehicle specs, passenger capacity, license data, and direct cockpit jump.
 */

import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Shield,
  Car,
  Users,
  CheckCircle2,
  XCircle,
  Search,
  Compass,
  AlertTriangle,
  FileText,
  Eye
} from 'lucide-react';
import { Conductor, RutaDiaria } from '../../types';
import { ensureUUID } from '../../services/instantDb';

interface DriverManagerProps {
  conductores: Conductor[];
  activeRuta?: RutaDiaria;
  onSaveConductor: (conductor: Conductor) => void;
  onDeleteConductor: (conductorId: string) => void;
  onSelectDriverForCockpit?: (conductorId: string) => void;
}

export const DriverManager: React.FC<DriverManagerProps> = ({
  conductores,
  activeRuta,
  onSaveConductor,
  onDeleteConductor,
  onSelectDriverForCockpit
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('+59399');
  const [email, setEmail] = useState('');
  const [licencia, setLicencia] = useState('');
  const [vehiculoModelo, setVehiculoModelo] = useState('');
  const [vehiculoPlaca, setVehiculoPlaca] = useState('');
  const [capacidad, setCapacidad] = useState<number>(16);
  const [activo, setActivo] = useState<boolean>(true);
  const [fotoUrl, setFotoUrl] = useState('');

  const handleOpenAdd = () => {
    setEditingId(null);
    setNombre('');
    setTelefono('+593991234567');
    setEmail('');
    setLicencia('Tipo E Profesional (Quito)');
    setVehiculoModelo('Toyota HiAce Escolar');
    setVehiculoPlaca('PBX-1234');
    setCapacidad(16);
    setActivo(true);
    setFotoUrl('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cond: Conductor) => {
    setEditingId(cond.id);
    setNombre(cond.nombre);
    setTelefono(cond.telefono);
    setEmail(cond.email || '');
    setLicencia(cond.licencia || '');
    setVehiculoModelo(cond.vehiculo_modelo || '');
    setVehiculoPlaca(cond.vehiculo_placa || '');
    setCapacidad(cond.capacidad_pasajeros || 16);
    setActivo(cond.activo ?? true);
    setFotoUrl(cond.foto_url || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const newDriver: Conductor = {
      id: ensureUUID(editingId || undefined),
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim() || undefined,
      licencia: licencia.trim() || undefined,
      vehiculo_modelo: vehiculoModelo.trim() || undefined,
      vehiculo_placa: vehiculoPlaca.trim().toUpperCase() || undefined,
      capacidad_pasajeros: Number(capacidad || 16),
      activo,
      foto_url: fotoUrl.trim() || undefined
    };

    onSaveConductor(newDriver);
    setIsModalOpen(false);
  };

  const handleDelete = (driverId: string) => {
    onDeleteConductor(driverId);
    setConfirmDeleteId(null);
  };

  // Filtered drivers
  const filteredDrivers = conductores.filter((d) => {
    const q = searchQuery.toLowerCase();
    return (
      d.nombre.toLowerCase().includes(q) ||
      (d.vehiculo_placa && d.vehiculo_placa.toLowerCase().includes(q)) ||
      (d.vehiculo_modelo && d.vehiculo_modelo.toLowerCase().includes(q)) ||
      d.telefono.toLowerCase().includes(q)
    );
  });

  const totalCapacidad = conductores.reduce(
    (acc, curr) => acc + (curr.activo ? (curr.capacidad_pasajeros || 16) : 0),
    0
  );
  const totalActivos = conductores.filter((c) => c.activo).length;

  return (
    <div className="flex h-full flex-col bg-canvas text-ink p-4 space-y-4 overflow-y-auto">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <span>Gestión de Conductores y Flota Escolar</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Crea, administra y asigna conductores a las rutas escolares en tiempo real
          </p>
        </div>

        <button
          id="btn-add-driver"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-black text-ink shadow-md shadow-primary/20 hover:bg-primary active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>Registrar Nuevo Conductor</span>
        </button>
      </div>

      {/* Fleet Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-line bg-surface p-3">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
            Conductores Totales
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-black text-ink">{conductores.length}</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
            Conductores Activos
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-black text-emerald-600">{totalActivos}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
            Capacidad de Flota
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-black text-primary">{totalCapacidad} puestos</span>
            <Car className="h-4 w-4 text-primary" />
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">
            Ruta Activa Asignada
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-bold text-primary truncate max-w-[120px]">
              {activeRuta?.conductor?.nombre ||
                conductores.find((c) => c.id === activeRuta?.conductor_id)?.nombre ||
                'Sin asignar'}
            </span>
            <Compass className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar conductor por nombre, placa vehicular, modelo o teléfono..."
          className="w-full rounded-xl bg-surface border border-line py-2 pl-9 pr-4 text-xs text-ink placeholder:text-muted focus:border-primary/40 focus:outline-none"
        />
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
      </div>

      {/* Drivers List / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredDrivers.map((cond) => {
          const isAssignedToActiveRoute =
            activeRuta?.conductor_id === cond.id ||
            activeRuta?.conductor?.id === cond.id;

          return (
            <div
              key={cond.id}
              className={`rounded-2xl border bg-surface p-4 transition-all flex flex-col justify-between space-y-3 ${
                isAssignedToActiveRoute
                  ? 'border-primary/50 shadow-lg shadow-primary/10 ring-1 ring-primary/20'
                  : 'border-line hover:border-line'
              }`}
            >
              {/* Header: Photo, Name, Status */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-soft-gray border border-line shrink-0">
                      {cond.foto_url ? (
                        <img
                          src={cond.foto_url}
                          alt={cond.nombre}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-black text-primary text-base">
                          {cond.nombre.charAt(0)}
                        </div>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-line ${
                          cond.activo ? 'bg-emerald-500' : 'bg-muted'
                        }`}
                        title={cond.activo ? 'Conductor Activo' : 'Conductor Inactivo'}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-ink">{cond.nombre}</h3>
                        {isAssignedToActiveRoute && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-black text-primary border border-primary/25">
                            En Ruta
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="h-3 w-3 text-emerald-600" />
                        <a
                          href={`https://wa.me/${cond.telefono.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {cond.telefono}
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(cond)}
                      title="Editar conductor"
                      className="rounded-lg p-1.5 text-muted hover:bg-soft-gray hover:text-ink transition-colors cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => setConfirmDeleteId(cond.id)}
                      title="Eliminar conductor"
                      className="rounded-lg p-1.5 text-alert hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details Pills */}
                <div className="mt-3 space-y-2 text-xs">
                  {/* Vehicle Info */}
                  <div className="flex items-center justify-between rounded-xl bg-soft-gray p-2 border border-line/80">
                    <div className="flex items-center gap-2 text-ink">
                      <Car className="h-3.5 w-3.5 text-primary" />
                      <span className="font-medium truncate max-w-[150px]">
                        {cond.vehiculo_modelo || 'Vehículo no registrado'}
                      </span>
                    </div>
                    {cond.vehiculo_placa && (
                      <span className="font-mono font-bold bg-surface px-2 py-0.5 rounded border border-line text-primary text-[11px]">
                        {cond.vehiculo_placa}
                      </span>
                    )}
                  </div>

                  {/* License & Capacity */}
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 rounded-lg bg-canvas/40 px-2 py-1.5 border border-line text-ink">
                      <Shield className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{cond.licencia || 'Licencia Prof.'}</span>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-lg bg-canvas/40 px-2 py-1.5 border border-line text-ink">
                      <Users className="h-3 w-3 text-primary shrink-0" />
                      <span>{cond.capacidad_pasajeros || 16} pasajeros máx.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action: Switch to Cockpit with this driver */}
              <div className="pt-2 border-t border-line/60 flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted font-mono truncate">
                  ID: {cond.id.substring(0, 8)}...
                </span>

                {onSelectDriverForCockpit && (
                  <button
                    onClick={() => onSelectDriverForCockpit(cond.id)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary bg-primary/10 hover:bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/40/20 transition-all cursor-pointer"
                  >
                    <Compass className="h-3 w-3" />
                    <span>Ver en Cabina</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredDrivers.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted">
            <Truck className="h-8 w-8 mx-auto text-muted mb-2" />
            <p className="text-sm font-semibold">No se encontraron conductores</p>
            <p className="text-xs mt-1 text-muted">
              Registra un nuevo conductor para asignarlo a las rutas escolares
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Delete */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-soft-gray backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface border border-line p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-alert">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="font-bold text-sm text-ink">¿Eliminar Conductor?</h3>
            </div>
            <p className="text-xs text-ink">
              Esta acción eliminará al conductor de la base de datos y de las listas de asignación.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-muted hover:bg-soft-gray cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="rounded-xl bg-rose-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-600 cursor-pointer shadow-md shadow-rose-500/20"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Driver Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-soft-gray backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-line p-5 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-sm sm:text-base text-ink">
                  {editingId ? 'Editar Conductor' : 'Registrar Nuevo Conductor'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:bg-soft-gray hover:text-ink cursor-pointer"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-bold text-ink mb-1">
                  Nombre Completo del Conductor *
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Juan Carlos Guamán"
                  className="w-full rounded-xl bg-canvas border border-line py-2 px-3 text-ink focus:border-primary/40 focus:outline-none"
                />
              </div>

              {/* Phone WhatsApp & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink mb-1">
                    Teléfono / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+593998765432"
                    className="w-full rounded-xl bg-canvas border border-line py-2 px-3 text-ink font-mono focus:border-primary/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="conductor@ejemplo.com"
                    className="w-full rounded-xl bg-canvas border border-line py-2 px-3 text-ink focus:border-primary/40 focus:outline-none"
                  />
                </div>
              </div>

              {/* License Type */}
              <div>
                <label className="block text-[11px] font-bold text-ink mb-1">
                  Licencia de Conducir
                </label>
                <input
                  type="text"
                  value={licencia}
                  onChange={(e) => setLicencia(e.target.value)}
                  placeholder="Ej: Tipo E Profesional (N° 1709448123)"
                  className="w-full rounded-xl bg-canvas border border-line py-2 px-3 text-ink focus:border-primary/40 focus:outline-none"
                />
              </div>

              {/* Vehicle Model & Plate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink mb-1">
                    Modelo de Vehículo / Buseta
                  </label>
                  <input
                    type="text"
                    value={vehiculoModelo}
                    onChange={(e) => setVehiculoModelo(e.target.value)}
                    placeholder="Ej: Toyota Coaster Escolar"
                    className="w-full rounded-xl bg-canvas border border-line py-2 px-3 text-ink focus:border-primary/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink mb-1">
                    Placa Vehicular
                  </label>
                  <input
                    type="text"
                    value={vehiculoPlaca}
                    onChange={(e) => setVehiculoPlaca(e.target.value.toUpperCase())}
                    placeholder="Ej: PBX-4521"
                    className="w-full rounded-xl bg-canvas border border-line py-2 px-3 text-ink font-mono uppercase focus:border-primary/40 focus:outline-none"
                  />
                </div>
              </div>

              {/* Capacity & Photo URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink mb-1">
                    Capacidad de Pasajeros
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={capacidad}
                    onChange={(e) => setCapacidad(Number(e.target.value))}
                    className="w-full rounded-xl bg-canvas border border-line py-2 px-3 text-ink focus:border-primary/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-ink mb-1">
                    URL Foto de Perfil
                  </label>
                  <input
                    type="url"
                    value={fotoUrl}
                    onChange={(e) => setFotoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl bg-canvas border border-line py-2 px-3 text-ink focus:border-primary/40 focus:outline-none"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between rounded-xl bg-canvas p-3 border border-line">
                <div>
                  <span className="font-bold text-ink block text-xs">
                    Estado Operativo del Conductor
                  </span>
                  <span className="text-[10px] text-muted">
                    {activo ? 'Disponible para asignación de rutas' : 'Inactivo / Fuera de servicio'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActivo(!activo)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    activo ? 'bg-emerald-500' : 'bg-soft-gray'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      activo ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-muted hover:bg-soft-gray cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-black text-ink shadow-md shadow-primary/20 hover:bg-primary active:scale-95 transition-all cursor-pointer"
                >
                  {editingId ? 'Guardar Cambios' : 'Registrar Conductor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
