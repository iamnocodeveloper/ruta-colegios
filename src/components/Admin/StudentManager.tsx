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
  Compass,
  ArrowUpDown,
  Sun,
  Sunset
} from 'lucide-react';
import { Alumno, Colegio, ModalidadTransporte, Representante } from '../../types';
import { ensureUUID } from '../../services/instantDb';
import { normalizeDays } from '../../services/routeCalculator';
import { normalizeSiblingIds } from '../../services/siblings';
import { LocationPicker } from '../Map/LocationPicker';

interface StudentManagerProps {
  alumnos: Alumno[];
  representantes: Representante[];
  colegios: Colegio[];
  onSaveAlumnoWithSiblings: (
    alumno: Alumno,
    representante: Representante,
    siblings: Alumno[]
  ) => void;
  onDeleteAlumno: (alumnoId: string) => void;
  onOpenParentPortal: (studentId: string) => void;
  onToggleActivoRutas?: (alumnoId: string, activo: boolean) => void;
}

export const StudentManager: React.FC<StudentManagerProps> = ({
  alumnos,
  representantes,
  colegios,
  onSaveAlumnoWithSiblings,
  onDeleteAlumno,
  onOpenParentPortal,
  onToggleActivoRutas
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingAlumnoId, setEditingAlumnoId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [filterModalidad, setFilterModalidad] = useState<string>('todos');

  // Form State
  const [nombreAlumno, setNombreAlumno] = useState<string>('');
  const [grado, setGrado] = useState<string>('');
  const [direccion, setDireccion] = useState<string>('');
  const [lat, setLat] = useState<number>(-0.1810);
  const [lng, setLng] = useState<number>(-78.4795);
  const [notas, setNotas] = useState<string>('');
  const [colegioId, setColegioId] = useState<string>(colegios[0]?.id || '');
  const [tiempoAbordaje, setTiempoAbordaje] = useState<number>(2.5);
  const [modalidadServicio, setModalidadServicio] = useState<ModalidadTransporte>('ida_y_vuelta');
  const [diasRuta, setDiasRuta] = useState<string[]>(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']);
  const [nombreRep, setNombreRep] = useState<string>('');
  const [telefonoWhatsApp, setTelefonoWhatsApp] = useState<string>('+593990000000');
  const [emailRep, setEmailRep] = useState<string>('');
  const [hermanoIds, setHermanosIds] = useState<string[]>([]);
  const [cuotaMensual, setCuotaMensual] = useState<number>(0);

  const handleOpenAdd = () => {
    setEditingAlumnoId(null);
    setNombreAlumno('');
    setGrado('4to Grado A');
    setDireccion('Av. República del Salvador y Portugal, Edif. Almagro, Apt 5A, Quito');
    setLat(-0.1810);
    setLng(-78.4795);
    setNotas('');
    setColegioId(colegios[0]?.id || '');
    setTiempoAbordaje(2.5);
    setModalidadServicio('ida_y_vuelta');
    setDiasRuta(['Lun', 'Mar', 'Mié', 'Jue', 'Vie']);
    setNombreRep('');
    setTelefonoWhatsApp('+593991234567');
    setEmailRep('');
    setHermanosIds([]);
    setCuotaMensual(0);
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
    setModalidadServicio(alumno.modalidad_servicio || 'ida_y_vuelta');
    setDiasRuta(alumno.dias_ruta && alumno.dias_ruta.length > 0 ? alumno.dias_ruta : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']);

    const rep = alumno.representante;
    setNombreRep(rep?.nombre || '');
    setTelefonoWhatsApp(rep?.telefono_whatsapp || '+59399');
    setEmailRep(rep?.email || '');
    setHermanosIds(normalizeSiblingIds(alumno.hermano_ids));
    setCuotaMensual(alumno.cuota_mensual || 0);
    setIsModalOpen(true);
  };

  const toggleHermano = (id: string) => {
    const isAdding = !hermanoIds.includes(id);
    setHermanosIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

    if (isAdding) {
      const sib = alumnos.find((a) => a.id === id);
      if (sib) {
        setLat(sib.lat);
        setLng(sib.lng);
        setDireccion(sib.direccion_recogida);
        setNombreRep(sib.representante?.nombre || nombreRep);
        setTelefonoWhatsApp(sib.representante?.telefono_whatsapp || telefonoWhatsApp);
        setEmailRep(sib.representante?.email || emailRep);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreAlumno.trim() || !nombreRep.trim()) return;

    const aluId = ensureUUID(editingAlumnoId || undefined);

    const rawRepId = editingAlumnoId
      ? alumnos.find((a) => a.id === editingAlumnoId)?.representante_id
      : undefined;
    const repId = ensureUUID(rawRepId);

    const existingRep = representantes.find((r) => r.id === repId);
    const magicToken = existingRep?.magic_token || 'tok-' + Math.random().toString(36).substring(2, 10);

    // Los hermanos comparten la MISMA ubicación y el MISMO representante.
    // Se canoniza tomando los datos del primer hermano seleccionado, de modo que
    // todos los miembros del grupo queden idénticos aunque el formulario difiera.
    const selectedSiblings = alumnos.filter((a) => hermanoIds.includes(a.id));
    const canonical = selectedSiblings[0];
    const canonicalRepId = canonical?.representante_id || repId;
    const canonicalRep = representantes.find((r) => r.id === canonicalRepId);

    const newRep: Representante = {
      id: canonicalRepId,
      nombre: canonicalRep?.nombre || nombreRep.trim(),
      telefono_whatsapp: canonicalRep?.telefono_whatsapp || telefonoWhatsApp.trim(),
      magic_token: canonicalRep?.magic_token || magicToken,
      email: canonicalRep?.email || emailRep.trim()
    };

    const finalLat = canonical ? canonical.lat : Number(lat);
    const finalLng = canonical ? canonical.lng : Number(lng);
    const finalDireccion = canonical ? canonical.direccion_recogida : direccion.trim();

    const group = Array.from(new Set([aluId, ...hermanoIds]));

    const targetColegio = colegios.find((c) => c.id === colegioId) || colegios[0];

    const newAlumno: Alumno = {
      id: aluId,
      nombre: nombreAlumno.trim(),
      colegio_id: targetColegio ? targetColegio.id : (colegioId ? ensureUUID(colegioId) : colegios[0]?.id || ensureUUID()),
      representante_id: canonicalRepId,
      direccion_recogida: finalDireccion,
      lat: finalLat,
      lng: finalLng,
      grado: grado.trim(),
      notas_medicas: notas.trim(),
      tiempo_abordaje_estimado_min: Number(tiempoAbordaje) || 2.5,
      modalidad_servicio: modalidadServicio,
      dias_ruta: diasRuta.length > 0 ? diasRuta : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
      hermano_ids: group.filter((id) => id !== aluId),
      cuota_mensual: Number(cuotaMensual) || 0,
      representante: newRep,
      colegio: targetColegio
    };

    const siblings: Alumno[] = selectedSiblings.map((sib) => ({
      ...sib,
      representante_id: canonicalRepId,
      direccion_recogida: finalDireccion,
      lat: finalLat,
      lng: finalLng,
      hermano_ids: group.filter((id) => id !== sib.id),
      representante: newRep,
      colegio: colegios.find((c) => c.id === sib.colegio_id) || sib.colegio || targetColegio
    }));

    onSaveAlumnoWithSiblings(newAlumno, newRep, siblings);
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
    <div className="flex h-full flex-col bg-canvas text-ink p-4 space-y-4 overflow-y-auto">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span>Gestión de Alumnos y Representantes</span>
          </h2>
          <p className="text-xs text-muted">
            Control de paradas de recogida, colegios de destino, contactos de WhatsApp y Magic Tokens
          </p>
        </div>

        <button
          id="btn-add-student"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-ink shadow-md hover:bg-primary transition-all cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          <span>Registrar Nuevo Alumno</span>
        </button>
      </div>

      {/* Filter Tabs by Modality */}
      <div className="flex items-center gap-2 overflow-x-auto py-2.5 px-0.5 text-xs">
        <span className="text-muted text-xs font-bold shrink-0">Filtrar por servicio:</span>
        <button
          onClick={() => setFilterModalidad('todos')}
          className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
            filterModalidad === 'todos'
              ? 'bg-primary text-white shadow'
              : 'bg-surface text-ink hover:bg-soft-gray'
          }`}
        >
          Todos ({alumnos.length})
        </button>
        <button
          onClick={() => setFilterModalidad('ida_y_vuelta')}
          className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
            filterModalidad === 'ida_y_vuelta'
              ? 'bg-emerald-500 text-ink shadow'
              : 'bg-surface text-ink hover:bg-soft-gray'
          }`}
        >
          🔄 Ida y Vuelta ({alumnos.filter((a) => (a.modalidad_servicio || 'ida_y_vuelta') === 'ida_y_vuelta').length})
        </button>
        <button
          onClick={() => setFilterModalidad('solo_ida')}
          className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
            filterModalidad === 'solo_ida'
              ? 'bg-primary text-white shadow'
              : 'bg-surface text-ink hover:bg-soft-gray'
          }`}
        >
          🌅 Solo Ida ({alumnos.filter((a) => a.modalidad_servicio === 'solo_ida').length})
        </button>
        <button
          onClick={() => setFilterModalidad('solo_vuelta')}
          className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
            filterModalidad === 'solo_vuelta'
              ? 'bg-purple-500 text-ink shadow'
              : 'bg-surface text-ink hover:bg-soft-gray'
          }`}
        >
          🌇 Solo Vuelta ({alumnos.filter((a) => a.modalidad_servicio === 'solo_vuelta').length})
        </button>
      </div>

      {/* Grid of Student Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {alumnos
          .filter((a) => {
            if (filterModalidad === 'todos') return true;
            const mod = a.modalidad_servicio || 'ida_y_vuelta';
            return mod === filterModalidad;
          })
          .map((alumno) => {
          const rep = alumno.representante;
          const targetSchool = colegios.find((c) => c.id === alumno.colegio_id) || alumno.colegio;
          const magicToken = rep?.magic_token || `tok-${alumno.id}`;
          const isCopied = copiedToken === alumno.id;
          const mod = alumno.modalidad_servicio || 'ida_y_vuelta';

          return (
            <div
              key={alumno.id}
              className="rounded-xl border border-line bg-surface p-4 space-y-3 shadow-md hover:border-line transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-ink">{alumno.nombre}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-primary font-semibold">{alumno.grado || 'Estudiante'}</span>
                      <span className="text-[10px] text-muted">•</span>
                      <span className="text-[10px] font-mono text-muted">ID: {alumno.id.substring(0, 8)}...</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(alumno)}
                      title="Editar Alumno"
                      className="p-1.5 rounded-lg bg-soft-gray text-ink hover:text-white hover:bg-line transition-all cursor-pointer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(alumno.id)}
                      title="Eliminar Alumno"
                      className="p-1.5 rounded-lg bg-soft-gray text-alert hover:bg-rose-50 transition-all cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Modality & Destination School Badges */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {mod === 'ida_y_vuelta' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                      <ArrowUpDown className="h-3 w-3" />
                      <span>Ida y Vuelta</span>
                    </span>
                  )}
                  {mod === 'solo_ida' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                      <Sun className="h-3 w-3" />
                      <span>Solo Ida (Mañana)</span>
                    </span>
                  )}
                  {mod === 'solo_vuelta' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                      <Sunset className="h-3 w-3" />
                      <span>Solo Vuelta (Tarde)</span>
                    </span>
                  )}

                  <div className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/25 px-2 py-0.5 rounded-full">
                    <School className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[150px]">{targetSchool?.nombre || 'Colegio'}</span>
                  </div>

                  {normalizeSiblingIds(alumno.hermano_ids).length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      👨‍👩‍👧 {normalizeSiblingIds(alumno.hermano_ids).length + 1} hermanos
                    </span>
                  )}
                </div>

                {/* Days of week chips */}
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((day) => {
                    const studentDays = normalizeDays(alumno.dias_ruta);
                    const isOn = studentDays.includes(day);
                    return (
                      <span
                        key={day}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                          isOn
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-canvas text-muted border border-line line-through'
                        }`}
                      >
                        {day}
                      </span>
                    );
                  })}
                </div>

                {/* Pickup Address */}
                <div className="mt-2 text-xs text-ink flex items-start gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="leading-tight">{alumno.direccion_recogida}</span>
                </div>

                {/* Medical Notes if any */}
                {alumno.notas_medicas && (
                  <div className="mt-1.5 text-[11px] text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    <HeartPulse className="h-3 w-3 shrink-0 text-alert" />
                    <span className="truncate">{alumno.notas_medicas}</span>
                  </div>
                )}

                {/* Active in routes toggle */}
                <div className={`mt-2 flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 border text-xs transition-all ${
                  alumno.activo_en_rutas === false
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-emerald-50/50 border-emerald-200'
                }`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-sm ${alumno.activo_en_rutas === false ? 'text-alert' : 'text-emerald-600'}`}>
                      {alumno.activo_en_rutas === false ? '⛔' : '✅'}
                    </span>
                    <div className="min-w-0">
                      <p className={`font-bold ${alumno.activo_en_rutas === false ? 'text-alert' : 'text-emerald-600'}`}>
                        {alumno.activo_en_rutas === false ? 'Inactivo en rutas' : 'Activo en rutas'}
                      </p>
                      <p className="text-[10px] text-muted truncate">
                        {alumno.activo_en_rutas === false
                          ? 'No se le asignará parada en la ruta'
                          : 'Se incluye en el cálculo de la ruta'}
                      </p>
                    </div>
                  </div>
                  <button
                    id={`btn-toggle-ruta-${alumno.id}`}
                    onClick={() => onToggleActivoRutas?.(alumno.id, alumno.activo_en_rutas === false)}
                    title={alumno.activo_en_rutas === false ? 'Activar en rutas' : 'Desactivar de rutas'}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer ${
                      alumno.activo_en_rutas === false ? 'bg-line' : 'bg-emerald-500'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        alumno.activo_en_rutas === false ? 'left-0.5' : 'left-[18px]'
                      }`}
                    />
                  </button>
                </div>

                {/* Representative details */}
                <div className="mt-2 rounded-lg bg-soft-gray p-2 text-xs border border-line/80 space-y-1">
                  <div className="flex justify-between text-muted">
                    <span>Representante:</span>
                    <b className="text-ink">{rep?.nombre || 'No asignado'}</b>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Teléfono WhatsApp:</span>
                    <b className="text-emerald-600">{rep?.telefono_whatsapp || '--'}</b>
                  </div>
                </div>
              </div>

              {/* Magic Link & Parent Portal Action Buttons */}
              <div className="pt-2 border-t border-line/80 flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => copyMagicLink(alumno.id, magicToken)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-soft-gray py-1.5 px-2 text-[11px] font-semibold text-ink hover:bg-line transition-all cursor-pointer"
                  title="Copiar Magic Link sin contraseña"
                >
                  {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{isCopied ? '¡Enlace Copiado!' : 'Copiar Magic Link'}</span>
                </button>

                <button
                  onClick={() => onOpenParentPortal(alumno.id)}
                  className="flex items-center gap-1 rounded-lg bg-primary/10 py-1.5 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/30 transition-all border border-primary/25 cursor-pointer"
                  title="Abrir Vista del Representante"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Ver Portal</span>
                </button>

                {/* Location & call quick actions */}
                <div className="flex items-center gap-1 w-full sm:w-auto">
                  <a
                    href={`https://waze.com/ul?ll=${alumno.lat},${alumno.lng}&navigate=yes`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-lg bg-surface border border-line py-1.5 px-2.5 text-[11px] font-bold text-ink hover:border-primary/40 hover:text-primary transition-all"
                    title="Abrir ubicación en Waze"
                  >
                    🚗 Waze
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${alumno.lat},${alumno.lng}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-lg bg-surface border border-line py-1.5 px-2.5 text-[11px] font-bold text-ink hover:border-primary/40 hover:text-primary transition-all"
                    title="Abrir ubicación en Google Maps"
                  >
                    📍 Maps
                  </a>
                  {rep?.telefono_whatsapp && (
                    <a
                      href={`tel:${rep.telefono_whatsapp.replace(/[^0-9]/g, '')}`}
                      className="flex flex-1 sm:flex-none items-center justify-center gap-1 rounded-lg bg-primary/10 border border-primary/25 py-1.5 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition-all"
                      title={`Llamar a ${rep.nombre || 'representante'}`}
                    >
                      <Phone className="h-3 w-3" /> Llamar
                    </a>
                  )}
                </div>
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
              <h3 className="font-black text-ink text-sm">¿Eliminar alumno?</h3>
            </div>
            <p className="text-xs text-ink">
              Esta acción eliminará al alumno y su información de parada de la base de datos InstantDB.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-xl bg-soft-gray px-3.5 py-1.5 text-xs font-bold text-ink hover:bg-line cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-soft-gray p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-line bg-surface p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="font-black text-ink text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span>{editingAlumnoId ? 'Editar Alumno & Representante' : 'Registrar Nuevo Alumno'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Nombre del Alumno *</label>
                  <input
                    type="text"
                    required
                    value={nombreAlumno}
                    onChange={(e) => setNombreAlumno(e.target.value)}
                    placeholder="Ej. Sofía Martínez"
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink focus:border-primary/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Grado / Sección</label>
                  <input
                    type="text"
                    value={grado}
                    onChange={(e) => setGrado(e.target.value)}
                    placeholder="Ej. 3er Grado A"
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink focus:border-primary/40 focus:outline-none"
                  />
                </div>
              </div>

              {/* Service Modality Selector (Ida y Vuelta / Solo Ida / Solo Vuelta) */}
              <div className="rounded-xl border border-line bg-soft-gray p-3 space-y-2">
                <label className="font-bold text-primary block">
                  Modalidad del Servicio de Transporte *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalidadServicio('ida_y_vuelta')}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      modalidadServicio === 'ida_y_vuelta'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-600 ring-1 ring-emerald-500'
                        : 'bg-surface border-line text-muted hover:bg-soft-gray hover:text-ink'
                    }`}
                  >
                    <span className="text-base mb-0.5">🔄</span>
                    <span className="font-bold text-[11px] leading-tight">Ida y Vuelta</span>
                    <span className="text-[9px] text-muted mt-0.5">Mañana y Tarde</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalidadServicio('solo_ida')}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      modalidadServicio === 'solo_ida'
                        ? 'bg-sky-950/80 border-sky-500 text-primary ring-1 ring-sky-500'
                        : 'bg-surface border-line text-muted hover:bg-soft-gray hover:text-ink'
                    }`}
                  >
                    <span className="text-base mb-0.5">🌅</span>
                    <span className="font-bold text-[11px] leading-tight">Solo Ida</span>
                    <span className="text-[9px] text-muted mt-0.5">Solo Mañana</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalidadServicio('solo_vuelta')}
                    className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      modalidadServicio === 'solo_vuelta'
                        ? 'bg-purple-950/80 border-purple-500 text-purple-600 ring-1 ring-purple-500'
                        : 'bg-surface border-line text-muted hover:bg-soft-gray hover:text-ink'
                    }`}
                  >
                    <span className="text-base mb-0.5">🌇</span>
                    <span className="font-bold text-[11px] leading-tight">Solo Vuelta</span>
                    <span className="text-[9px] text-muted mt-0.5">Solo Tarde</span>
                  </button>
                </div>
                <p className="text-[10px] text-muted">
                  {modalidadServicio === 'ida_y_vuelta' && '• El alumno será incluido en el cálculo tanto de la ruta de ida (mañana) como en la de vuelta (tarde).'}
                  {modalidadServicio === 'solo_ida' && '• El alumno SOLO se incluirá al planificar la ruta de la mañana (recogida en casa hacia el colegio).'}
                  {modalidadServicio === 'solo_vuelta' && '• El alumno SOLO se incluirá al planificar la ruta de la tarde (salida del colegio hacia casa).'}
                </p>
              </div>

              {/* Days of Week Checkboxes */}
              <div className="rounded-xl border border-line bg-soft-gray p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-primary block">
                    Días que asiste a la ruta
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDiasRuta(diasRuta.length === 5 ? [] : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'])
                    }
                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    {diasRuta.length === 5 ? 'Quitar todos' : 'Marcar todos'}
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((day) => {
                    const isOn = diasRuta.includes(day);
                    return (
                      <label
                        key={day}
                        className={`flex flex-col items-center rounded-lg border py-2 cursor-pointer transition-all ${
                          isOn
                            ? 'bg-primary text-white border-primary shadow-md'
                            : 'bg-surface border-line text-muted hover:border-primary/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isOn}
                          onChange={() =>
                            setDiasRuta((prev) =>
                              isOn ? prev.filter((d) => d !== day) : [...prev, day]
                            )
                          }
                        />
                        <span className="text-xs font-black">{day}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted">
                  Los días marcados controlan si el alumno se carga automáticamente al planificar la ruta de ese día.
                </p>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Colegio de Destino *</label>
                <select
                  value={colegioId}
                  onChange={(e) => setColegioId(e.target.value)}
                  className="w-full rounded-lg bg-canvas border border-line p-2 text-ink focus:border-primary/40 focus:outline-none"
                >
                  {colegios.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} (Entrada: {c.hora_llegada_limite})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Dirección de Recogida *</label>
                <input
                  type="text"
                  required
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle, Edificio, Apto, Punto de referencia..."
                  className="w-full rounded-lg bg-canvas border border-line p-2 text-ink focus:border-primary/40 focus:outline-none"
                />
              </div>

              {/* Interactive Location Picker Map for Student Pickup Spot */}
              <div className="space-y-1">
                <label className="font-bold text-primary flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Punto de Recogida en el Mapa (Haz clic o arrastra el pin)</span>
                </label>
                <LocationPicker
                  lat={lat}
                  lng={lng}
                  pinType="student"
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
                  <label className="font-bold text-ink block mb-1">Tiempo de Abordaje (min)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={tiempoAbordaje}
                    onChange={(e) => setTiempoAbordaje(parseFloat(e.target.value) || 2.5)}
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Notas Médicas / Alergias</label>
                  <input
                    type="text"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Ej. Alérgico a nueces, Asma..."
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">Mensualidad ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cuotaMensual}
                  onChange={(e) => setCuotaMensual(parseFloat(e.target.value) || 0)}
                  placeholder="Ej. 45.00"
                  className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                />
              </div>

              {/* Representative Information */}
              <div className="border-t border-line pt-2 space-y-2">
                <span className="font-bold text-primary block">Datos del Representante (Para WhatsApp & Magic Link)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-ink block mb-1">Nombre del Representante *</label>
                    <input
                      type="text"
                      required
                      value={nombreRep}
                      onChange={(e) => setNombreRep(e.target.value)}
                      placeholder="Ej. Carlos Martínez"
                      className="w-full rounded-lg bg-canvas border border-line p-2 text-ink focus:border-primary/40 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-ink block mb-1">Teléfono WhatsApp *</label>
                    <input
                      type="text"
                      required
                      value={telefonoWhatsApp}
                      onChange={(e) => setTelefonoWhatsApp(e.target.value)}
                      placeholder="+584121234567"
                      className="w-full rounded-lg bg-canvas border border-line p-2 text-ink focus:border-primary/40 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-muted block mb-1">Correo Electrónico (Opcional)</label>
                  <input
                    type="email"
                    value={emailRep}
                    onChange={(e) => setEmailRep(e.target.value)}
                    placeholder="representante@gmail.com"
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                  />
                </div>
              </div>

              {/* Sibling selection */}
              <div className="border-t border-line pt-2 space-y-2">
                <span className="font-bold text-primary block">Hermanos (misma parada y mismo representante)</span>
                <p className="text-[10px] text-muted">
                  Al marcar un hermano, este alumno copiará su ubicación exacta y datos del representante.
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {alumnos
                    .filter((a) => a.id !== editingAlumnoId)
                    .map((a) => (
                      <label
                        key={a.id}
                        className={`flex items-center gap-2 rounded-lg border p-2 text-xs cursor-pointer transition-all ${
                          hermanoIds.includes(a.id)
                            ? 'bg-amber-50 border-amber-300 text-ink'
                            : 'bg-surface border-line text-muted hover:border-line'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={hermanoIds.includes(a.id)}
                          onChange={() => toggleHermano(a.id)}
                          className="accent-amber-500 h-4 w-4 rounded cursor-pointer"
                        />
                        <span className="truncate">{a.nombre}</span>
                      </label>
                    ))}
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
