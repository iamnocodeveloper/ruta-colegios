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
  Users
} from 'lucide-react';
import { Alumno, Colegio } from '../../types';

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
  const [lat, setLat] = useState(10.4995);
  const [lng, setLng] = useState(-66.8525);
  const [horaLlegada, setHoraLlegada] = useState('08:00:00');
  const [telefono, setTelefono] = useState('+58 212 000 0000');

  const handleOpenAdd = () => {
    setEditingId(null);
    setNombre('');
    setDireccion('Av. Principal de Los Palos Grandes, Caracas');
    setLat(10.4980);
    setLng(-66.8490);
    setHoraLlegada('08:00:00');
    setTelefono('+58 212 555 1234');
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
      id: editingId || 'col_' + Date.now(),
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
    <div className="flex h-full flex-col bg-slate-950 text-slate-100 p-4 space-y-4 overflow-y-auto">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
            <School className="h-5 w-5 text-amber-400" />
            <span>Colegios e Instituciones de Destino</span>
          </h2>
          <p className="text-xs text-slate-400">
            Administración de sedes, coordenadas de destino y hora límite de llegada (H_llegada)
          </p>
        </div>

        <button
          id="btn-add-school"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-amber-400 transition-all shadow-md cursor-pointer"
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
              className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{col.nombre}</h3>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                      <Users className="h-3 w-3" />
                      <span>{assignedStudentsCount} alumno(s) asignado(s)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(col)}
                      title="Editar Colegio"
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(col.id)}
                      title="Eliminar Colegio"
                      className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-950/50 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Address */}
                <div className="mt-2.5 text-xs text-slate-300 flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-tight">{col.direccion}</span>
                </div>

                {/* GPS Coordinates */}
                <div className="mt-2 rounded-lg bg-slate-950/70 p-2 text-[11px] font-mono text-slate-400 border border-slate-800/80 flex justify-between">
                  <span>GPS:</span>
                  <span className="text-slate-300">{Number(col.lat).toFixed(4)}, {Number(col.lng).toFixed(4)}</span>
                </div>
              </div>

              {/* Bottom Specs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2.5 text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Entrada: {col.hora_llegada_limite}</span>
                </div>
                {col.contacto_telefono && (
                  <div className="flex items-center gap-1.5 text-slate-400">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-rose-800/50 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-black text-slate-100 text-sm">¿Eliminar este colegio?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Esta acción eliminará el colegio de la base de datos InstantDB. Los alumnos asociados deberán ser reasignados.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-xl bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-black text-slate-100 text-base">
                {editingId ? 'Editar Colegio' : 'Registrar Nuevo Colegio'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Nombre de la Institución *</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Colegio Santiago de León de Caracas"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Dirección Exacta *</label>
                <input
                  type="text"
                  required
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle, Urbanización, Punto de Referencia..."
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Latitud</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || lat)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Longitud</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || lng)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Hora Límite de Llegada</label>
                  <input
                    type="time"
                    step="60"
                    required
                    value={horaLlegada.substring(0, 5)}
                    onChange={(e) => setHoraLlegada(e.target.value + ':00')}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Teléfono Contacto</label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+58 212 555 1234"
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 font-bold text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 px-5 py-2 font-black text-slate-950 hover:bg-amber-400 transition-all cursor-pointer"
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
