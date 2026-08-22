/**
 * School Management Component (Gestión de Colegios)
 * Full CRUD for schools with InstantDB and Local resilience
 */

import React, { useState } from 'react';
import {
  School,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  Clock,
  Phone,
  AlertTriangle,
  Users,
  Compass
} from 'lucide-react';
import { Alumno, Colegio } from '../../types';
import { ensureUUID } from '../../services/instantDb';
import { LocationPicker } from '../Map/LocationPicker';

interface SchoolManagerProps {
  colegios: Colegio[];
  alumnos?: Alumno[];
  onSaveColegio: (colegio: Colegio) => void;
  onDeleteColegio: (colegioId: string) => void;
}

export const SchoolManager: React.FC<SchoolManagerProps> = ({
  colegios,
  alumnos = [],
  onSaveColegio,
  onDeleteColegio
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [lat, setLat] = useState(-0.1872);
  const [lng, setLng] = useState(-78.4975);
  const [horaLlegada, setHoraLlegada] = useState('07:45:00');
  const [telefono, setTelefono] = useState('+593 2 224 1500');

  const handleOpenAdd = () => {
    setEditingId(null);
    setNombre('');
    setDireccion('Av. Manuel Córdova Galarza y Carcelén, Quito, Ecuador');
    setLat(-0.0985);
    setLng(-78.4835);
    setHoraLlegada('07:30:00');
    setTelefono('+593 2 397 6300');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (col: Colegio) => {
    setEditingId(col.id);
    setNombre(col.nombre);
    setDireccion(col.direccion);
    setLat(col.lat);
    setLng(col.lng);
    setHoraLlegada(col.hora_llegada_limite || '08:00:00');
    setTelefono(col.contacto_telefono || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const newCol: Colegio = {
      id: ensureUUID(editingId || undefined),
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      lat: Number(lat),
      lng: Number(lng),
      hora_llegada_limite: horaLlegada.length === 5 ? horaLlegada + ':00' : horaLlegada,
      contacto_telefono: telefono.trim()
    };

    onSaveColegio(newCol);
    setIsModalOpen(false);
  };

  const handleDelete = (colId: string) => {
    onDeleteColegio(colId);
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex h-full flex-col bg-canvas text-ink p-4 space-y-4 overflow-y-auto">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
            <School className="h-5 w-5 text-primary" />
            <span>Colegios e Instituciones de Destino</span>
          </h2>
          <p className="text-xs text-muted">
            Administración de sedes, coordenadas de destino y hora límite de llegada (H_llegada)
          </p>
        </div>

        <button
          id="btn-add-school"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-black text-ink hover:bg-primary transition-all shadow-md cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Agregar Nuevo Colegio</span>
        </button>
      </div>

      {/* Schools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {colegios.map((col) => {
          const assignedStudentsCount = alumnos.filter((a) => a.colegio_id === col.id).length;

          return (
            <div
              key={col.id}
              className="rounded-xl border border-line bg-surface p-4 space-y-3 shadow-md hover:border-line transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-ink">{col.nombre}</h3>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-primary font-semibold">
                      <Users className="h-3 w-3" />
                      <span>{assignedStudentsCount} alumno(s) asignado(s)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(col)}
                      title="Editar Colegio"
                      className="p-1.5 rounded-lg bg-soft-gray text-ink hover:text-white hover:bg-line transition-all"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(col.id)}
                      title="Eliminar Colegio"
                      className="p-1.5 rounded-lg bg-soft-gray text-alert hover:bg-rose-50 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Address */}
                <div className="mt-2.5 text-xs text-ink flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="leading-tight">{col.direccion}</span>
                </div>

                {/* GPS Coordinates */}
                <div className="mt-2 rounded-lg bg-soft-gray p-2 text-[11px] font-mono text-muted border border-line/80 flex justify-between">
                  <span>GPS:</span>
                  <span className="text-ink">{Number(col.lat).toFixed(4)}, {Number(col.lng).toFixed(4)}</span>
                </div>
              </div>

              {/* Bottom Specs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/80 pt-2.5 text-xs">
                <div className="flex items-center gap-1.5 text-primary font-bold">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Entrada: {col.hora_llegada_limite}</span>
                </div>
                {col.contacto_telefono && (
                  <div className="flex items-center gap-1.5 text-muted">
                    <Phone className="h-3 w-3" />
                    <span>{col.contacto_telefono}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-soft-gray p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-rose-800/50 bg-surface p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-alert">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-black text-ink text-sm">¿Eliminar este colegio?</h3>
            </div>
            <p className="text-xs text-ink">
              Esta acción eliminará el colegio de la base de datos InstantDB. Los alumnos asociados deberán ser reasignados.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-xl bg-soft-gray px-3.5 py-1.5 text-xs font-bold text-ink hover:bg-line"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-black text-white hover:bg-rose-500"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-soft-gray p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-line bg-surface p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="font-black text-ink text-base flex items-center gap-2">
                <School className="h-5 w-5 text-primary" />
                <span>{editingId ? 'Editar Colegio' : 'Registrar Nuevo Colegio'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Nombre de la Institución *</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Colegio Santiago de León de Caracas"
                  className="w-full rounded-lg bg-canvas border border-line p-2 text-ink focus:border-primary/40 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Dirección Escrita *</label>
                <input
                  type="text"
                  required
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle, Urbanización, Punto de Referencia..."
                  className="w-full rounded-lg bg-canvas border border-line p-2 text-ink focus:border-primary/40 focus:outline-none"
                />
              </div>

              {/* Interactive Location Picker Map */}
              <div className="space-y-1">
                <label className="font-bold text-primary flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Ubicación en el Mapa (Haz clic o arrastra el pin)</span>
                </label>
                <LocationPicker
                  lat={lat}
                  lng={lng}
                  pinType="school"
                  currentAddress={direccion}
                  height="200px"
                  onChange={(newLat, newLng, suggestedAddress) => {
                    setLat(newLat);
                    setLng(newLng);
                    if (suggestedAddress) {
                      setDireccion(suggestedAddress);
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted block mb-1">Latitud GPS</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || lat)}
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted block mb-1">Longitud GPS</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || lng)}
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Hora Límite de Llegada</label>
                  <input
                    type="time"
                    step="60"
                    required
                    value={horaLlegada.substring(0, 5)}
                    onChange={(e) => setHoraLlegada(e.target.value + ':00')}
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-primary font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Teléfono Contacto</label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+58 212 555 1234"
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl bg-soft-gray px-4 py-2 font-bold text-ink hover:bg-line cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-5 py-2 font-black text-ink hover:bg-primary transition-all cursor-pointer shadow-md"
                >
                  Guardar Colegio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
