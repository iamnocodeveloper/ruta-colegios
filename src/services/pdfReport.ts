/**
 * PDF Route Report Generator (jsPDF + autoTable)
 * Produces a clean, text-only A4 report for a saved route:
 *   - Brand header (primary color) + school + route metadata
 *   - Summary block (driver, times, distance, counters)
 *   - ⚠️ Schedule alert (indicaciones iniciales) when the chosen hours don't
 *     cover the full journey ("Las horas NO coinciden para el trayecto")
 *   - Ordered stop table with pickup/delivery time AND arrival at the NEXT
 *     point; the last stop is picked up and the arrival is at the META
 *     (destination: school on IDA, base on VUELTA)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RouteHistoryEntry } from './routeHistory';
import { formatFriendlyTime, minutesToTimeString, timeStringToMinutes } from './routeCalculator';
import { getJourneys } from './routeJourneys';
import { ParadaRuta, RutaDiaria } from '../types';

// Design-system colors (Soft UI)
const PRIMARY: [number, number, number] = [0, 132, 255];   // #0084FF
const INK: [number, number, number] = [28, 30, 33];         // #1C1E21
const MUTED: [number, number, number] = [138, 148, 166];    // #8A94A6
const LINE: [number, number, number] = [230, 233, 240];     // #E6E9F0
const SOFT_GRAY: [number, number, number] = [247, 248, 250]; // #F7F8FA
const GREEN: [number, number, number] = [5, 150, 105];      // #059669
const RED: [number, number, number] = [255, 80, 80];        // #FF5050
const AMBER: [number, number, number] = [217, 119, 6];      // #D97706
const RED_FILL: [number, number, number] = [254, 226, 226];   // #FEE2E2
const RED_DARK: [number, number, number] = [136, 19, 55];     // #881337

const VARIANT_LABELS: Record<string, string> = {
  '2opt': 'Óptima (2-Opt)',
  nearest: 'Vecino Cercano',
  farthest: 'Extremos Primero',
  random: 'Aleatoria',
  manual: 'Manual',
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

// ===========================================================================
// Horario de llegada al siguiente punto (y a la META en la última parada)
// ===========================================================================

/**
 * Fuente de horario: un trayecto (ida/vuelta) o la ruta legacy (campos top-level).
 * Solo se usan los campos de horario; RutaTrayecto y RutaDiaria los satisfacen.
 */
type ScheduleSource = {
  horario_valido?: boolean;
  mensaje_horario?: string;
  hora_salida_deseada?: string;
  hora_llegada_deseada?: string;
  hora_llegada_estimada?: string;
  hora_llegada_objetivo?: string;
  tiempo_total_estimado_min?: number;
  tiempo_manejo_estimado_min?: number;
  tiempo_abordaje_por_alumno_min?: number;
  paradas?: ParadaRuta[];
};

/**
 * Hora de llegada de cada parada:
 *   - paradas intermedias → hora estimada del SIGUIENTE punto (parada siguiente)
 *   - última parada      → llegada a la META (colegio en IDA / base en VUELTA)
 */
function stopArrivalNext(stops: ParadaRuta[], idx: number, src: ScheduleSource): string {
  if (idx < stops.length - 1) {
    // Llegada al siguiente punto = hora estimada de la próxima parada
    return formatFriendlyTime(stops[idx + 1].hora_estimada);
  }
  // Última parada → llegada a la meta (destino final)
  const calc = src.hora_llegada_estimada || src.hora_llegada_objetivo;
  if (calc) return formatFriendlyTime(calc);
  // Fallback: última parada + abordaje + tramo final (base → meta)
  const last = stops[idx];
  const tLast = timeStringToMinutes(last.hora_estimada);
  const abordaje = src.tiempo_abordaje_por_alumno_min ?? 2.5;
  const totalDrive = src.tiempo_manejo_estimado_min ?? 0;
  const stopsDrive = stops.reduce((s, p) => s + (p.tiempo_desde_anterior_min ?? 0), 0);
  const finalLeg = Math.max(0, totalDrive - stopsDrive);
  return formatFriendlyTime(minutesToTimeString(tLast + abordaje + finalLeg));
}

// ===========================================================================
// Alerta de horario: "Las horas NO coinciden para el trayecto"
// ===========================================================================

interface ScheduleAlertInfo {
  label: string; // 'Recorrido IDA (…)' / 'Recorrido VUELTA (…)' o ''
  message: string;
  count: number;
  totalMin: number;
  suggestedFirstStop?: string; // HH:MM:SS
  suggestedArrival?: string;   // HH:MM:SS
}

/** Alerta de un trayecto (o de la ruta legacy) cuando las horas NO coinciden. */
function journeyAlert(src: ScheduleSource): Omit<ScheduleAlertInfo, 'label'> | null {
  if (src.horario_valido !== false) return null;
  // jsPDF con fuentes estándar no dibuja emojis: se limpia el ⚠️ del mensaje.
  const message =
    (src.mensaje_horario || 'Las horas no coinciden para el trayecto.')
      .replace(/⚠️/g, '')
      .replace(/⚠/g, '')
      .trim();
  const count = src.paradas?.length || 0;
  const totalMin = src.tiempo_total_estimado_min ?? 0;

  let suggestedFirstStop: string | undefined;
  let suggestedArrival: string | undefined;
  if (src.hora_salida_deseada && src.hora_llegada_deseada && src.hora_llegada_estimada) {
    // 1ª parada recomendada = H_llegada_deseada - duración real desde la 1ª parada
    const ancla = timeStringToMinutes(src.hora_salida_deseada);
    const llegadaDeseada = timeStringToMinutes(src.hora_llegada_deseada);
    const llegadaEstimada = timeStringToMinutes(src.hora_llegada_estimada);
    const tiempoDesdeAncla = Math.max(0, llegadaEstimada - ancla);
    suggestedArrival = minutesToTimeString(llegadaEstimada);
    suggestedFirstStop = minutesToTimeString(llegadaDeseada - tiempoDesdeAncla);
  } else if (src.hora_llegada_estimada) {
    suggestedArrival = src.hora_llegada_estimada;
  }

  return { message, count, totalMin, suggestedFirstStop, suggestedArrival };
}

/** Recolecta todas las alertas de la ruta (ida / vuelta / legacy). */
function collectAlerts(ruta: RutaDiaria): ScheduleAlertInfo[] {
  const alerts: ScheduleAlertInfo[] = [];
  const journeys = getJourneys(ruta);
  if (journeys.length > 0) {
    for (const j of journeys) {
      const info = journeyAlert(j);
      if (info) {
        alerts.push({
          label:
            j.tipo_trayecto === 'ida'
              ? 'Recorrido IDA (Hogares - Colegio)'
              : 'Recorrido VUELTA (Colegio - Hogares)',
          ...info,
        });
      }
    }
  } else {
    const info = journeyAlert(ruta);
    if (info) alerts.push({ label: '', ...info });
  }
  return alerts;
}

/**
 * Draw a red alert box (indicaciones iniciales) with the schedule mismatch.
 */
function drawScheduleAlert(
  doc: jsPDF,
  info: ScheduleAlertInfo,
  y: number,
  pageW: number,
  margin: number
): number {
  const boxX = margin;
  const boxW = pageW - margin * 2;
  const pad = 5;
  const lineH = 4.2;

  const messageLines = doc.splitTextToSize(info.message, boxW - pad * 2) as string[];
  const contextLines = doc.splitTextToSize(
    `El trayecto completo con ${info.count} paradas necesita ${info.totalMin} min (manejo + abordaje). Ajusta el horario elegido para que las horas coincidan.`,
    boxW - pad * 2
  ) as string[];
  const recLines = (info.suggestedFirstStop ? 1 : 0) + (info.suggestedArrival ? 1 : 0);
  const labelH = info.label ? 4.5 : 0;

  const contentH =
    6 + labelH + messageLines.length * lineH + 2.5 + recLines * lineH + 2 + contextLines.length * lineH + 1;
  const height = pad * 2 + contentH;

  // Fondo + borde rojo
  doc.setFillColor(...RED_FILL);
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.5);
  doc.roundedRect(boxX, y, boxW, height, 2, 2, 'FD');

  let cy = y + pad + 4.5;

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...RED);
  doc.text('Las horas NO coinciden para el trayecto', boxX + pad, cy);
  cy += 6;

  // Etiqueta del trayecto (ida / vuelta) si aplica
  if (info.label) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(info.label, boxX + pad, cy);
    cy += labelH;
  }

  // Mensaje completo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(...RED_DARK);
  doc.text(messageLines, boxX + pad, cy);
  cy += messageLines.length * lineH + 2.5;

  // Recomendaciones
  if (info.suggestedFirstStop || info.suggestedArrival) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    if (info.suggestedFirstStop) {
      doc.text(`1ª parada a las ${info.suggestedFirstStop.substring(0, 5)}`, boxX + pad, cy);
      cy += lineH;
    }
    if (info.suggestedArrival) {
      doc.text(`Llegar a las ${info.suggestedArrival.substring(0, 5)}`, boxX + pad, cy);
      cy += lineH;
    }
    cy += 2;
  }

  // Contexto / acción
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(contextLines, boxX + pad, cy + 1);

  return y + height + 6;
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
  const journeys = getJourneys(ruta);
  const paradas = (journeys.length > 0 ? journeys.flatMap((j) => j.paradas || []) : ruta.paradas || [])
    .slice()
    .sort((a, b) => a.orden - b.orden);
  const recogidos = paradas.filter((p) => p.estado === 'recogido' || p.estado === 'completado').length;
  const ausentes = paradas.filter((p) => p.estado === 'ausente').length;
  const pendientes = paradas.length - recogidos - ausentes;
  const trayectoLabel =
    journeys.length > 0
      ? `Ida + Vuelta (${journeys.length} jornada${journeys.length > 1 ? 's' : ''})`
      : entry.tipo_trayecto === 'ida'
      ? 'Ida (Mañana)'
      : 'Vuelta (Tarde)';
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
  drawField(doc, 'Trayecto', trayectoLabel, margin, y);
  drawField(doc, 'Variante', VARIANT_LABELS[entry.variante || ''] || entry.variante || '—', colX2, y);
  y += 11;
  drawField(
    doc,
    'Modo de estimación',
    entry.modo_optimizacion === 'trafico_real' ? 'Tráfico real' : 'Estándar (fijo)',
    margin,
    y
  );
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

  // ===== ⚠️ Indicaciones iniciales: alerta cuando las horas NO coinciden =====
  const alerts = collectAlerts(ruta);
  for (const alert of alerts) {
    y = drawScheduleAlert(doc, alert, y, pageW, margin);
  }

  // ===== Stops table(s): una por trayecto (ida / vuelta) =====
  const drawStopsTable = (
    label: string,
    stops: ParadaRuta[],
    startY: number,
    src: ScheduleSource,
    horaHeader: string
  ): number => {
    if (label) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...PRIMARY);
      doc.text(label, margin, startY);
      startY += 5;
    }

    const body = stops.map((p, i) => [
      String(p.orden),
      p.alumno?.nombre || 'Alumno',
      p.alumno?.direccion_recogida || 'Dirección no registrada',
      formatFriendlyTime(p.hora_estimada),
      stopArrivalNext(stops, i, src),
      `${p.distancia_desde_anterior_km ?? 0} km`,
    ]);

    autoTable(doc, {
      startY,
      head: [['#', 'Alumno', 'Ubicación', horaHeader, 'Llegada sig.', 'Dist. ant.']],
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
        fontSize: 8.5,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 46 },
        2: { cellWidth: 60 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 4) return;
        // La llegada de la última parada es a la META (destino final): destacarla
        if (data.row.index === stops.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = PRIMARY;
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

    return (doc as any).lastAutoTable?.finalY ?? startY;
  };

  let finalY = y;
  if (journeys.length > 0) {
    for (const j of journeys) {
      const label =
        j.tipo_trayecto === 'ida'
          ? 'Recorrido IDA (Hogares - Colegio)'
          : 'Recorrido VUELTA (Colegio - Hogares)';
      const horaHeader = j.tipo_trayecto === 'vuelta' ? 'Entrega' : 'Recogida';
      finalY = drawStopsTable(label, j.paradas || [], finalY + 4, j, horaHeader);
    }
  } else {
    const horaHeader = entry.tipo_trayecto === 'vuelta' ? 'Entrega' : 'Recogida';
    finalY = drawStopsTable('Itinerario de Paradas', paradas, y, ruta, horaHeader);
  }

  // ===== Footer totals =====
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
