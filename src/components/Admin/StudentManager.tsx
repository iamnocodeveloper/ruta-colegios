/**
 * Student and Parent Manager (Gestión de Alumnos y Representantes)
 * Full CRUD with InstantDB Real-Time Synchronization & Local Persistence
 */

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Edit2,
  Trash2,
  MapPin,
  Check,
  Copy,
  ExternalLink,
  School,
  AlertTriangle,
  HeartPulse,
  Phone,
  Compass
} from 'lucide-react';
import { Alumno, Colegio, Representante } from '../../types';

interface StudentManagerProps {
  alumnos: Alumno[];
  representantes: Representante[];
  colegios: Colegio[];
  onSaveAlumno: (alumno: Alumno, representante: Representante) => void;
  onDeleteAlumno: (alumnoId: string) => void;
  onOpenParentPortal: (studentId: string) => void;
}

export const StudentManager: React.FC<StudentManagerProps> = ({
  alumnos,
  representantes,
  colegios,
  onSaveAlumno,
  onDeleteAlumno,
  onOpenParentPortal
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAlumnoId, setEditingAlumnoId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Form State
  const [nombreAlumno, setNombreAlumno] = useState<string>('');
  const [grado, setGrado] = useState<string>('');
  const [direccion, setDireccion] = useState<string>('');
  const [lat, setLat] = useState<number>(10.4920);
  const [lng, setLng] = useState<number>(-66.8600);
  const [notas, setNotas] = useState<string>('');
  const [colegioId, setColegioId] = useState<string>(colegios[0]?.id || '');
  const [tiempoAbordaje, setTiempoAbordaje] = useState<number>(2.5);
  const [nombreRep, setNombreRep] = useState<string>('');
  const [telefonoWhatsApp, setTelefonoWhatsApp] = useState<string>('+584120000000');
  const [emailRep, setEmailRep] = useState<string>('');

  const handleOpenAdd = () => {
    setEditingAlumnoId(null);
    setNombreAlumno('');
    setGrado('4to Grado A');
    setDireccion('Av. Francisco de Miranda, Edif. Parque Cristal, Apt 5A, Caracas');
    setLat(10.4950);
    setLng(-66.8530);
    setNotas('');
    setColegioId(colegios[0]?.id || '');
    setTiempoAbordaje(2.5);
    setNombreRep('');
    setTelefonoWhatsApp('+584121234567');
    setEmailRep('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (alumno: Alumno) => {
    setEditingAlumnoId(alumno.id);
    setNombreAlumno(alumno.nombre);
    setGrado(alumno.grado || '');
    setDireccion(alumno.direccion_recogida);
    setLat(alumno.lat);
    setLng(alumno.lng);
    setNotas(alumno.notas_medicas || '');
    setColegioId(alumno.colegio_id);
    setTiempoAbordaje(alumno.tiempo_abordaje_estimado_min || 2.5);

    const rep = alumno.representante;
    setNombreRep(rep?.nombre || '');
    setTelefonoWhatsApp(rep?.telefono_whatsapp || '+58412');
    setEmailRep(rep?.email || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreAlumno.trim() || !nombreRep.trim()) return;

    const repId = editingAlumnoId
      ? alumnos.find((a) => a.id === editingAlumnoId)?.representante_id || 'rep_' + Date.now()
      : 'rep_' + Date.now();

    const existingRep = representantes.find((r) => r.id === repId);
    const magicToken = existingRep?.magic_token || 'tok-' + Math.random().toString(36).substring(2, 10);

    const newRep: Representante = {
      id: repId,
      nombre: nombreRep.trim(),
      telefono_whatsapp: telefonoWhatsApp.trim(),
      magic_token: magicToken,
      email: emailRep.trim()
    };

    const targetColegio = colegios.find((c) => c.id === colegioId) || colegios[0];

    const newAlumno: Alumno = {
      id: editingAlumnoId || 'alu_' + Date.now(),
      nombre: nombreAlumno.trim(),
      colegio_id: targetColegio ? targetColegio.id : colegioId,
      representante_id: repId,
      direccion_recogida: direccion.trim(),
      lat: Number(lat),
      lng: Number(lng),
      grado: grado.trim(),
      notas_medicas: notas.trim(),
      tiempo_abordaje_estimado_min: Number(tiempoAbordaje) || 2.5,
      representante: newRep,
      colegio: targetColegio
    };

    onSaveAlumno(newAlumno, newRep);
    setIsModalOpen(false);
  };

  const handleDelete = (studentId: string) => {
    onDeleteAlumno(studentId);
    setConfirmDeleteId(null);
  };

  const copyMagicLink = (studentId: string, token: string) => {
    const url = `${window.location.origin}/?magic=${token}&student=${studentId}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(studentId);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100 p-4 space-y-4 overflow-y-auto">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-400" />
            <span>Gestión de Alumnos y Representantes</span>
          </h2>
          <p className="text-xs text-slate-400">
            Control de paradas de recogida, colegios de destino, contactos de WhatsApp y Magic Tokens
          </p>
        </div>

        <button
          id="btn-add-student"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 shadow-md hover:bg-amber-400 transition-all cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Registrar Nuevo Alumno</span>
        </button>
      </div>

      {/* Grid of Student Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {alumnos.map((alumno) => {
          const rep = alumno.representante;
          const targetSchool = colegios.find((c) => c.id === alumno.colegio_id) || alumno.colegio;
          const magicToken = rep?.magic_token || `tok-${alumno.id}`;
          const isCopied = copiedToken === alumno.id;

          return (
            <div
              key={alumno.id}
              className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-100">{alumno.nombre}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-amber-400 font-semibold">{alumno.grado || 'Estudiante'}</span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-[10px] font-mono text-slate-400">ID: {alumno.id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(alumno)}
                      title="Editar Alumno"
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(alumno.id)}
                      title="Eliminar Alumno"
                      className="p-1.5 rounded-lg bg-slate-800 text-rose-400 hover:bg-rose-950/40 transition-all cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Destination School Badge */}
                <div className="mt-2 flex items-center gap-1 text-[11px] text-sky-300 bg-sky-950/40 border border-sky-800/40 px-2 py-0.5 rounded-md w-fit">
                  <School className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[220px]">{targetSchool?.nombre || 'Colegio no asignado'}</span>
                </div>

                {/* Pickup Address */}
                <div className="mt-2 text-xs text-slate-300 flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-tight">{alumno.direccion_recogida}</span>
                </div>

                {/* Medical Notes if any */}
                {alumno.notas_medicas && (
                  <div className="mt-1.5 text-[11px] text-rose-300 flex items-center gap-1 bg-rose-950/30 px-2 py-0.5 rounded border border-rose-900/30">
                    <HeartPulse className="h-3 w-3 shrink-0 text-rose-400" />
                    <span className="truncate">{alumno.notas_medicas}</span>
                  </div>
                )}

                {/* Representative details */}
                <div className="mt-2 rounded-lg bg-slate-950/70 p-2 text-xs border border-slate-800/80 space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Representante:</span>
                    <b className="text-slate-200">{rep?.nombre || 'No asignado'}</b>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Teléfono WhatsApp:</span>
                    <b className="text-emerald-400">{rep?.telefono_whatsapp || '--'}</b>
                  </div>
                </div>
              </div>

              {/* Magic Link & Parent Portal Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => copyMagicLink(alumno.id, magicToken)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-slate-800 py-1.5 px-2 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
                  title="Copiar Magic Link sin contraseña"
                >
                  {isCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{isCopied ? '¡Enlace Copiado!' : 'Copiar Magic Link'}</span>
                </button>

                <button
                  onClick={() => onOpenParentPortal(alumno.id)}
                  className="flex items-center gap-1 rounded-lg bg-amber-500/20 py-1.5 px-2.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition-all border border-amber-500/30 cursor-pointer"
                  title="Abrir Vista del Representante"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Ver Portal</span>
                </button>
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
              <h3 className="font-black text-slate-100 text-sm">¿Eliminar alumno?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Esta acción eliminará al alumno y su información de parada de la base de datos InstantDB.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-xl bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-black text-white hover:bg-rose-500 cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form: Add / Edit Student */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-black text-slate-100 text-base">
                {editingAlumnoId ? 'Editar Alumno & Representante' : 'Registrar Nuevo Alumno'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Nombre del Alumno *</label>
                  <input
                    type="text"
                    required
                    value={nombreAlumno}
                    onChange={(e) => setNombreAlumno(e.target.value)}
                    placeholder="Ej. Sofía Martínez"
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Grado / Sección</label>
                  <input
                    type="text"
                    value={grado}
                    onChange={(e) => setGrado(e.target.value)}
                    placeholder="Ej. 3er Grado A"
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Colegio de Destino *</label>
                <select
                  value={colegioId}
                  onChange={(e) => setColegioId(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100 focus:border-amber-400 focus:outline-none"
                >
                  {colegios.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.hora_llegada_limite})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Dirección de Recogida *</label>
                <input
                  type="text"
                  required
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle, Edificio, Apto, Punto de referencia..."
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Latitud GPS</label>
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
                  <label className="font-bold text-slate-400 block mb-1">Longitud GPS</label>
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
                  <label className="font-bold text-slate-300 block mb-1">Tiempo de Abordaje (min)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={tiempoAbordaje}
                    onChange={(e) => setTiempoAbordaje(parseFloat(e.target.value) || 2.5)}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Notas Médicas / Alergias</label>
                  <input
                    type="text"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Ej. Alérgico a nueces, Asma..."
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100"
                  />
                </div>
              </div>

              {/* Representative Information */}
              <div className="border-t border-slate-800 pt-2 space-y-2">
                <span className="font-bold text-amber-400 block">Datos del Representante (Para WhatsApp & Magic Link)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Nombre del Representante *</label>
                    <input
                      type="text"
                      required
                      value={nombreRep}
                      onChange={(e) => setNombreRep(e.target.value)}
                      placeholder="Ej. Carlos Martínez"
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Teléfono WhatsApp *</label>
                    <input
                      type="text"
                      required
                      value={telefonoWhatsApp}
                      onChange={(e) => setTelefonoWhatsApp(e.target.value)}
                      placeholder="+584121234567"
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-400 block mb-1">Correo Electrónico (Opcional)</label>
                  <input
                    type="email"
                    value={emailRep}
                    onChange={(e) => setEmailRep(e.target.value)}
                    placeholder="representante@gmail.com"
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 px-5 py-2 font-black text-slate-950 hover:bg-amber-400 transition-all cursor-pointer"
                >
                  Guardar Alumno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
