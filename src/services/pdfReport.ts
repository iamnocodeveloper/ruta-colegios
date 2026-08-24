/**
 * PDF Route Report Generator (jsPDF + autoTable)
 * Produces a clean, text-only A4 report for a saved route:
 *   - Brand header (primary color) + school + route metadata
 *   - Summary block (driver, times, distance, counters)
 *   - Ordered stop table with state-colored rows (no maps / no images)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RouteHistoryEntry } from './routeHistory';
import { formatFriendlyTime } from './routeCalculator';

// Design-system colors (Soft UI)
const PRIMARY: [number, number, number] = [0, 132, 255];   // #0084FF
const INK: [number, number, number] = [28, 30, 33];         // #1C1E21
const MUTED: [number, number, number] = [138, 148, 166];    // #8A94A6
const LINE: [number, number, number] = [230, 233, 240];     // #E6E9F0
const SOFT_GRAY: [number, number, number] = [247, 248, 250]; // #F7F8FA
const GREEN: [number, number, number] = [5, 150, 105];      // #059669
const RED: [number, number, number] = [255, 80, 80];        // #FF5050
const AMBER: [number, number, number] = [217, 119, 6];      // #D97706
const GREEN_FILL: [number, number, number] = [209, 250, 229]; // #D1FAE5
const RED_FILL: [number, number, number] = [254, 226, 226];   // #FEE2E2
const AMBER_FILL: [number, number, number] = [254, 243, 199]; // #FEF3C7

const VARIANT_LABELS: Record<string, string> = {
  '2opt': 'Óptima (2-Opt)',
  nearest: 'Vecino Cercano',
  farthest: 'Extremos Primero',
  random: 'Aleatoria',
  manual: 'Manual',
};

const ESTADO_RUTA_LABELS: Record<string, string> = {
  planificada: 'Planificada',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function formatFecha(fecha: string): string {
  if (!fecha) return '—';
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString('es-EC', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface EstadoMeta {
  label: string;
  color: [number, number, number];
  fill: [number, number, number];
}

function estadoParada(estado: string): EstadoMeta {
  if (estado === 'recogido' || estado === 'completado') {
    return { label: 'Recogido', color: GREEN, fill: GREEN_FILL };
  }
  if (estado === 'ausente') {
    return { label: 'Ausente', color: RED, fill: RED_FILL };
  }
  return { label: 'Pendiente', color: AMBER, fill: AMBER_FILL };
}

/**
 * Draw a "label / value" field with muted label and bold value.
 */
function drawField(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  opts?: { valueColor?: [number, number, number]; valueSize?: number; valueFontStyle?: string }
) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x, y - 2.5);

  doc.setFont('helvetica', opts?.valueFontStyle || 'bold');
  doc.setFontSize(opts?.valueSize || 10);
  doc.setTextColor(...(opts?.valueColor || INK));
  doc.text(value, x, y + 1.5);
}

/**
 * Generate and download the PDF report for a saved route.
 */
export function generateRoutePdf(entry: RouteHistoryEntry): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth(); // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const margin = 14;

  const ruta = entry.ruta || ({} as RouteHistoryEntry['ruta']);
  const paradas = (ruta.paradas || []).slice().sort((a, b) => a.orden - b.orden);
  const recogidos = paradas.filter((p) => p.estado === 'recogido' || p.estado === 'completado').length;
  const ausentes = paradas.filter((p) => p.estado === 'ausente').length;
  const pendientes = paradas.length - recogidos - ausentes;
  const generatedAt = new Date().toLocaleString('es-EC');

  // ===== Header bar =====
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('RutaEscolar', margin, 13);
  doc.setFontSize(11);
  doc.text('INFORME DE RUTA', pageW - margin, 13, { align: 'right' });

  let y = 34;

  // ===== School =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(entry.colegio_nombre || 'Colegio', margin, y);
  if (ruta.colegio?.direccion) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(ruta.colegio.direccion, margin, y + 4.5);
    y += 9;
  }
  y += 6;

  // ===== Route metadata (two columns) =====
  const colX2 = pageW / 2 + 4;
  drawField(doc, 'Fecha de la ruta', formatFecha(entry.fecha), margin, y);
  drawField(doc, 'Día de la ruta', entry.dia_semana || '—', colX2, y);
  y += 11;
  drawField(doc, 'Trayecto', entry.tipo_trayecto === 'ida' ? 'Ida (Mañana)' : 'Vuelta (Tarde)', margin, y);
  drawField(doc, 'Variante', VARIANT_LABELS[entry.variante || ''] || entry.variante || '—', colX2, y);
  y += 11;
  drawField(doc, 'Estado', ESTADO_RUTA_LABELS[entry.estado] || entry.estado, margin, y);
  drawField(
    doc,
    'Modo de estimación',
    entry.modo_optimizacion === 'trafico_real' ? 'Tráfico real' : 'Estándar (fijo)',
    colX2,
    y
  );
  y += 11;
  drawField(doc, 'Generado', generatedAt, margin, y);
  drawField(
    doc,
    'Hora de salida estimada',
    formatFriendlyTime(entry.hora_salida_estimada),
    colX2,
    y,
    { valueColor: PRIMARY }
  );

  // Divider
  y += 10;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  // ===== Summary block =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Resumen', margin, y);
  y += 4;

  const boxX = margin;
  const boxW = pageW - margin * 2;
  const boxH = 42;
  doc.setFillColor(...SOFT_GRAY);
  doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'F');

  const conductor = ruta.conductor?.nombre || entry.conductor_nombre || 'Sin conductor';
  const placa = ruta.conductor?.vehiculo_placa || 'Unidad no registrada';

  drawField(doc, 'Conductor y unidad', `${conductor} — ${placa}`, margin + 5, y + 8);
  drawField(doc, 'Hora llegada objetivo', formatFriendlyTime(entry.hora_llegada_objetivo), colX2 + 2, y + 8);
  drawField(doc, 'Distancia total', `${entry.distancia_total_km} km`, margin + 5, y + 19);
  drawField(
    doc,
    'Tiempo total estimado',
    `${entry.tiempo_total_estimado_min} min (manejo ${ruta.tiempo_manejo_estimado_min ?? '—'} + abordaje ${ruta.tiempo_abordaje_total_min ?? '—'})`,
    colX2 + 2,
    y + 19
  );
  drawField(doc, 'Paradas', String(paradas.length), margin + 5, y + 30);
  drawField(doc, 'ID de ruta', entry.id, colX2 + 2, y + 30, { valueSize: 9 });

  // Colored counters (right side of summary box)
  const counterX = pageW - margin - 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('RECOGIDOS', counterX, y + 8 - 2.5, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(...GREEN);
  doc.text(String(recogidos), counterX, y + 8 + 1.5, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('AUSENTES', counterX, y + 19 - 2.5, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(...RED);
  doc.text(String(ausentes), counterX, y + 19 + 1.5, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('PENDIENTES', counterX, y + 30 - 2.5, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(...AMBER);
  doc.text(String(pendientes), counterX, y + 30 + 1.5, { align: 'right' });

  y += boxH + 8;

  // ===== Stops table =====
  const body = paradas.map((p) => {
    const meta = estadoParada(p.estado);
    return [
      String(p.orden),
      p.alumno?.nombre || 'Alumno',
      p.alumno?.direccion_recogida || 'Dirección no registrada',
      formatFriendlyTime(p.hora_estimada),
      `${p.distancia_desde_anterior_km ?? 0} km`,
      meta,
    ] as (string | EstadoMeta)[];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Alumno', 'Ubicación', 'Hora est.', 'Dist. ant.', 'Estado']],
    body: body as any[],
    margin: { left: margin, right: margin, bottom: 18 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: INK,
      cellPadding: 2.5,
      lineColor: LINE,
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: PRIMARY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 46 },
      2: { cellWidth: 62 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const raw = data.row.raw as (string | EstadoMeta)[];
      const meta = raw?.[5] as EstadoMeta | undefined;
      if (meta) {
        data.cell.styles.fillColor = meta.fill;
        if (data.column.index === 5) {
          data.cell.styles.textColor = meta.color;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: () => {
      const pages = doc.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`Generado por RutaEscolar · ${generatedAt}`, margin, pageH - 8);
      doc.text(`Página ${pages}`, pageW - margin, pageH - 8, { align: 'right' });
    },
  });

  // ===== Footer totals =====
  const finalY = (doc as any).lastAutoTable?.finalY || y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(
    `Total: ${paradas.length} paradas · ${recogidos} recogidos · ${ausentes} ausentes · ${pendientes} pendientes`,
    margin,
    finalY + 8
  );

  const filename = `Informe_Ruta_${slugify(entry.colegio_nombre)}_${entry.fecha}.pdf`;
  doc.save(filename);
}
