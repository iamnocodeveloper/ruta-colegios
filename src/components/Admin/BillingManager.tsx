/**
 * Billing Manager (Cobranza)
 * Registro de pagos por alumno: fecha, monto, mes cobrado, concepto, método y estado.
 * Incluye cuota mensual por alumno, cálculo de saldo pendiente y comprobantes PDF.
 */

import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Plus,
  Edit2,
  Trash2,
  FileText,
  Receipt,
  AlertTriangle,
  Check,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Alumno, EstadoPago, MetodoPago, Pago, Representante } from '../../types';
import { ensureUUID } from '../../services/instantDb';
import { generatePagoPdf, generateEstadoCuentaPdf } from '../../services/billingPdf';

interface BillingManagerProps {
  alumnos: Alumno[];
  representantes: Representante[];
  pagos: Pago[];
  onSavePago: (pago: Pago) => void;
  onDeletePago: (pagoId: string) => void;
}

const MES_ACTUAL = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

const HOY = new Date().toISOString().substring(0, 10);

const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

const ESTADO_LABEL: Record<EstadoPago, string> = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  parcial: 'Parcial',
};

function formatMoney(n: number): string {
  return `$${Number(n || 0).toFixed(2)}`;
}

function formatFecha(fecha: string): string {
  if (!fecha) return '—';
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const BillingManager: React.FC<BillingManagerProps> = ({
  alumnos,
  representantes,
  pagos,
  onSavePago,
  onDeletePago
}) => {
  const [mesSeleccionado, setMesSeleccionado] = useState<string>(MES_ACTUAL);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPagoId, setEditingPagoId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [alumnoId, setAlumnoId] = useState<string>('');
  const [fechaPago, setFechaPago] = useState<string>(HOY);
  const [mesCobrado, setMesCobrado] = useState<string>(MES_ACTUAL);
  const [monto, setMonto] = useState<number>(0);
  const [concepto, setConcepto] = useState<string>('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [estado, setEstado] = useState<EstadoPago>('pagado');
  const [notas, setNotas] = useState<string>('');

  const alumnoSeleccionado = alumnos.find((a) => a.id === alumnoId);

  const resumenAlumno = (id: string) => {
    const alu = alumnos.find((a) => a.id === id);
    const cuota = Number(alu?.cuota_mensual || 0);
    const delMes = pagos.filter((p) => p.alumno_id === id && p.mes_cobrado === mesSeleccionado);
    const totalPagado = delMes.reduce((s, p) => s + Number(p.monto || 0), 0);
    const saldo = Math.max(0, cuota - totalPagado);
    const estadoMes: string =
      cuota > 0
        ? totalPagado >= cuota
          ? 'pagado'
          : totalPagado > 0
          ? 'parcial'
          : 'pendiente'
        : 'sin_cuota';
    return { alu, cuota, totalPagado, saldo, estadoMes, delMes };
  };

  const totals = useMemo(() => {
    const cobrado = pagos
      .filter((p) => p.mes_cobrado === mesSeleccionado && p.estado === 'pagado')
      .reduce((s, p) => s + Number(p.monto || 0), 0);
    const pendiente = alumnos.reduce((s, a) => s + resumenAlumno(a.id).saldo, 0);
    return { cobrado, pendiente };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagos, alumnos, mesSeleccionado]);

  const pagosDelMes = pagos.filter((p) => p.mes_cobrado === mesSeleccionado);

  const handleOpenAdd = (prefillAlumnoId?: string) => {
    setEditingPagoId(null);
    setAlumnoId(prefillAlumnoId || '');
    setFechaPago(HOY);
    setMesCobrado(mesSeleccionado);
    setMonto(0);
    setConcepto('');
    setMetodoPago('efectivo');
    setEstado('pagado');
    setNotas('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pago: Pago) => {
    setEditingPagoId(pago.id);
    setAlumnoId(pago.alumno_id);
    setFechaPago(pago.fecha_pago);
    setMesCobrado(pago.mes_cobrado);
    setMonto(pago.monto);
    setConcepto(pago.concepto);
    setMetodoPago(pago.metodo_pago);
    setEstado(pago.estado);
    setNotas(pago.notas || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alumnoId || monto <= 0) return;

    const alu = alumnos.find((a) => a.id === alumnoId);
    const rep = alu?.representante || representantes.find((r) => r.id === alu?.representante_id);
    const mesAuto = fechaPago.substring(0, 7) || mesSeleccionado;

    const newPago: Pago = {
      id: ensureUUID(editingPagoId || undefined),
      alumno_id: alumnoId,
      representante_id: alu?.representante_id || rep?.id || '',
      monto: Number(monto),
      fecha_pago: fechaPago,
      mes_cobrado: mesCobrado || mesAuto,
      concepto: concepto.trim() || `Mensualidad ${mesCobrado || mesAuto}`,
      metodo_pago: metodoPago,
      estado,
      notas: notas.trim(),
      alumno: alu,
      representante: rep,
    };

    onSavePago(newPago);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    onDeletePago(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex h-full flex-col bg-canvas text-ink p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-ink flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <span>Cobranza</span>
          </h2>
          <p className="text-xs text-muted">
            Registra pagos, fechas y montos por alumno para un mejor control mensual
          </p>
        </div>
        <button
          onClick={() => handleOpenAdd()}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-ink shadow-md hover:bg-primary transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Registrar Pago</span>
        </button>
      </div>

      {/* Month selector + totals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-1">
          <label className="font-bold text-ink block mb-1 text-xs">Mes de cobranza</label>
          <input
            type="month"
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
            className="w-full rounded-lg bg-canvas border border-line p-2 text-xs text-ink focus:border-primary/40 focus:outline-none"
          />
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[11px] text-muted font-bold">Cobrado en el mes</p>
            <p className="text-sm font-black text-emerald-600">{formatMoney(totals.cobrado)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-alert">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[11px] text-muted font-bold">Pendiente total</p>
            <p className="text-sm font-black text-alert">{formatMoney(totals.pendiente)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[11px] text-muted font-bold">Alumnos</p>
            <p className="text-sm font-black text-ink">{alumnos.length}</p>
          </div>
        </div>
      </div>

      {/* Alumnos summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {alumnos.map((alumno) => {
          const r = resumenAlumno(alumno.id);
          return (
            <div
              key={alumno.id}
              className="rounded-xl border border-line bg-surface p-4 space-y-3 shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-ink">{alumno.nombre}</h3>
                    <p className="text-[11px] text-muted">{alumno.representante?.nombre || 'Sin representante'}</p>
                  </div>
                  {r.estadoMes === 'pagado' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <Check className="h-3 w-3" /> Pagado
                    </span>
                  )}
                  {r.estadoMes === 'parcial' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Parcial
                    </span>
                  )}
                  {r.estadoMes === 'pendiente' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      <Clock className="h-3 w-3" /> Pendiente
                    </span>
                  )}
                  {r.estadoMes === 'sin_cuota' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted bg-soft-gray border border-line px-2 py-0.5 rounded-full">
                      Sin cuota
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-soft-gray p-2">
                    <p className="text-[10px] text-muted font-bold">Cuota</p>
                    <p className="text-xs font-black text-ink">{formatMoney(r.cuota)}</p>
                  </div>
                  <div className="rounded-lg bg-soft-gray p-2">
                    <p className="text-[10px] text-muted font-bold">Pagado</p>
                    <p className="text-xs font-black text-emerald-600">{formatMoney(r.totalPagado)}</p>
                  </div>
                  <div className="rounded-lg bg-soft-gray p-2">
                    <p className="text-[10px] text-muted font-bold">Saldo</p>
                    <p className="text-xs font-black text-alert">{formatMoney(r.saldo)}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-line/80 flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => handleOpenAdd(alumno.id)}
                  className="flex items-center gap-1 rounded-lg bg-primary/10 py-1.5 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/30 transition-all border border-primary/25 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Registrar</span>
                </button>
                <button
                  onClick={() => generateEstadoCuentaPdf(alumno, pagos, mesSeleccionado)}
                  className="flex items-center gap-1 rounded-lg bg-soft-gray py-1.5 px-2.5 text-[11px] font-semibold text-ink hover:bg-line transition-all cursor-pointer"
                  title="Descargar estado de cuenta"
                >
                  <FileText className="h-3 w-3" />
                  <span>Estado</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payments list */}
      <div className="border-t border-line pt-3">
        <h3 className="text-sm font-black text-ink mb-2 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          Pagos de {mesSeleccionado}
        </h3>
        <div className="space-y-2">
          {pagosDelMes.length === 0 && (
            <p className="text-xs text-muted">No hay pagos registrados en este mes.</p>
          )}
          {pagosDelMes.map((pago) => (
            <div
              key={pago.id}
              className="rounded-lg border border-line bg-surface p-3 flex items-center justify-between gap-2 flex-wrap"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink">{pago.alumno?.nombre || 'Alumno'}</p>
                <p className="text-[11px] text-muted truncate">
                  {pago.concepto} · {formatFecha(pago.fecha_pago)} · {METODO_LABEL[pago.metodo_pago]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-emerald-600">{formatMoney(pago.monto)}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    pago.estado === 'pagado'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : pago.estado === 'parcial'
                      ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : 'bg-rose-50 text-rose-600 border border-rose-200'
                  }`}
                >
                  {ESTADO_LABEL[pago.estado]}
                </span>
                <button
                  onClick={() => generatePagoPdf(pago)}
                  title="Descargar recibo"
                  className="p-1.5 rounded-lg bg-soft-gray text-ink hover:bg-line transition-all cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleOpenEdit(pago)}
                  title="Editar pago"
                  className="p-1.5 rounded-lg bg-soft-gray text-ink hover:text-white hover:bg-line transition-all cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(pago.id)}
                  title="Eliminar pago"
                  className="p-1.5 rounded-lg bg-soft-gray text-alert hover:bg-rose-50 transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-soft-gray p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-rose-800/50 bg-surface p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-alert">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-black text-ink text-sm">¿Eliminar pago?</h3>
            </div>
            <p className="text-xs text-ink">Esta acción eliminará el registro de pago de la base de datos.</p>
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

      {/* Add/Edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-soft-gray p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="font-black text-ink text-base flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <span>{editingPagoId ? 'Editar Pago' : 'Registrar Pago'}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-muted hover:text-ink cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">Alumno *</label>
                <select
                  required
                  value={alumnoId}
                  onChange={(e) => setAlumnoId(e.target.value)}
                  className="w-full rounded-lg bg-canvas border border-line p-2 text-ink focus:border-primary/40 focus:outline-none"
                >
                  <option value="">Seleccionar alumno</option>
                  {alumnos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({formatMoney(a.cuota_mensual || 0)}/mes)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Fecha de pago *</label>
                  <input
                    type="date"
                    required
                    value={fechaPago}
                    onChange={(e) => {
                      setFechaPago(e.target.value);
                      if (e.target.value) setMesCobrado(e.target.value.substring(0, 7));
                    }}
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Mes cobrado</label>
                  <input
                    type="month"
                    value={mesCobrado}
                    onChange={(e) => setMesCobrado(e.target.value)}
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Monto ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={monto}
                    onChange={(e) => setMonto(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                  />
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Concepto</label>
                  <input
                    type="text"
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    placeholder="Ej. Mensualidad marzo"
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-ink block mb-1">Método de pago</label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-ink block mb-1">Estado</label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as EstadoPago)}
                    className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                  >
                    <option value="pagado">Pagado</option>
                    <option value="parcial">Parcial</option>
                    <option value="pendiente">Pendiente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-muted block mb-1">Notas (Opcional)</label>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ej. Pago por transferencia bancaria"
                  className="w-full rounded-lg bg-canvas border border-line p-2 text-ink"
                />
              </div>

              {alumnoSeleccionado && (
                <div className="rounded-lg bg-soft-gray border border-line p-2 text-[11px] text-muted">
                  Mensualidad de {alumnoSeleccionado.nombre}: {formatMoney(alumnoSeleccionado.cuota_mensual || 0)}
                </div>
              )}

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
                  Guardar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
