/**
 * Billing PDF Generators (jsPDF + autoTable)
 * Genera recibos de pago y estados de cuenta mensuales por alumno.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Alumno, Pago } from '../types';

const PRIMARY: [number, number, number] = [0, 132, 255];   // #0084FF
const INK: [number, number, number] = [28, 30, 33];       // #1C1E21
const MUTED: [number, number, number] = [138, 148, 166];  // #8A94A6
const LINE: [number, number, number] = [230, 233, 240];   // #E6E9F0
const SOFT_GRAY: [number, number, number] = [247, 248, 250]; // #F7F8FA
const GREEN: [number, number, number] = [5, 150, 105];    // #059669
const RED: [number, number, number] = [255, 80, 80];      // #FF5050
const AMBER: [number, number, number] = [217, 119, 6];    // #D97706

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function formatMoney(monto: number): string {
  return `$${Number(monto || 0).toFixed(2)}`;
}

function formatFecha(fecha: string): string {
  if (!fecha) return '—';
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
}

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

const ESTADO_LABEL: Record<string, string> = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  parcial: 'Parcial',
};

function drawHeader(doc: jsPDF, subtitle: string): number {
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('RutaEscolar · Cobranza', 14, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitle, 14, 20);
  return 30;
}

export function generatePagoPdf(pago: Pago): void {
  const alumno = pago.alumno;
  const rep = pago.representante || alumno?.representante;
  const doc = new jsPDF();
  let y = drawHeader(doc, 'Recibo de Pago');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text(`Recibo de Pago`, 14, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Alumno: ${alumno?.nombre || '—'}`, 14, y);
  y += 6;
  doc.text(`Representante: ${rep?.nombre || '—'}`, 14, y);
  y += 6;
  doc.text(`Teléfono: ${rep?.telefono_whatsapp || '—'}`, 14, y);
  y += 10;

  doc.setFillColor(...SOFT_GRAY);
  doc.setDrawColor(...LINE);
  doc.roundedRect(14, y, 182, 34, 2, 2, 'FD');
  y += 7;
  const rows: [string, string][] = [
    ['Mes cobrado', pago.mes_cobrado || '—'],
    ['Fecha de pago', formatFecha(pago.fecha_pago)],
    ['Concepto', pago.concepto || '—'],
    ['Método', METODO_LABEL[pago.metodo_pago] || pago.metodo_pago],
  ];
  for (const [k, v] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(`${k}:`, 18, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    doc.text(v, 62, y);
    y += 6;
  }
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...GREEN);
  doc.text(`Monto: ${formatMoney(pago.monto)}`, 14, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(`Estado: ${ESTADO_LABEL[pago.estado] || pago.estado}`, 14, y);

  if (pago.notas) {
    y += 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Notas: ${pago.notas}`, 14, y);
  }

  const filename = `Recibo_${slugify(alumno?.nombre || 'alumno')}_${slugify(pago.mes_cobrado)}.pdf`;
  doc.save(filename);
}

export function generateEstadoCuentaPdf(alumno: Alumno, pagos: Pago[], mes: string): void {
  const rep = alumno.representante;
  const cuota = Number(alumno.cuota_mensual || 0);
  const pagosDelMes = pagos.filter((p) => p.alumno_id === alumno.id && p.mes_cobrado === mes);
  const totalPagado = pagosDelMes.reduce((s, p) => s + Number(p.monto || 0), 0);
  const saldo = Math.max(0, cuota - totalPagado);

  const doc = new jsPDF();
  let y = drawHeader(doc, 'Estado de Cuenta Mensual');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text('Estado de Cuenta', 14, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Alumno: ${alumno.nombre}`, 14, y);
  y += 6;
  doc.text(`Representante: ${rep?.nombre || '—'}`, 14, y);
  y += 6;
  doc.text(`Mes: ${mes}`, 14, y);
  y += 10;

  const resumen: [string, string][] = [
    ['Mensualidad', formatMoney(cuota)],
    ['Total pagado', formatMoney(totalPagado)],
    ['Saldo pendiente', formatMoney(saldo)],
  ];
  for (const [k, v] of resumen) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(k, 14, y);
    doc.setFont('helvetica', 'bold');
    if (k === 'Saldo pendiente' && saldo > 0) {
      doc.setTextColor(...RED);
    } else {
      doc.setTextColor(...INK);
    }
    doc.text(v, 70, y);
    y += 7;
  }

  y += 3;
  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Concepto', 'Método', 'Estado', 'Monto']],
    body: pagosDelMes.map((p) => [
      formatFecha(p.fecha_pago),
      p.concepto || '—',
      METODO_LABEL[p.metodo_pago] || p.metodo_pago,
      ESTADO_LABEL[p.estado] || p.estado,
      formatMoney(p.monto),
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: PRIMARY, textColor: 255 },
    alternateRowStyles: { fillColor: SOFT_GRAY },
    columnStyles: {
      4: { halign: 'right' },
    },
  });

  const filename = `Estado_Cuenta_${slugify(alumno.nombre)}_${slugify(mes)}.pdf`;
  doc.save(filename);
}
