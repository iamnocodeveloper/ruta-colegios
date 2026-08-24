/**
 * Importador CSV de alumnos (onboarding de clientes).
 * Columnas esperadas (en orden): nombre, direccion, lat, lng, grado, dias, modalidad, representante, telefono, email
 * Admite cabecera opcional y separador coma o punto y coma.
 */

export interface CsvAlumnoRow {
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
  grado: string;
  dias: string;
  modalidad: string;
  representante: string;
  telefono: string;
  email: string;
}

export interface ParseCsvResult {
  ok: boolean;
  rows: CsvAlumnoRow[];
  error?: string;
}

const HEADERS = ['nombre', 'direccion', 'lat', 'lng', 'grado', 'dias', 'modalidad', 'representante', 'telefono', 'email'];

export function parseAlumnosCsv(text: string): ParseCsvResult {
  if (!text || !text.trim()) return { ok: false, rows: [], error: 'El CSV está vacío.' };

  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { ok: false, rows: [], error: 'El CSV está vacío.' };

  // Detectar separador (semicolón o coma) por la primera línea
  const sep = lines[0].includes(';') ? ';' : ',';

  const splitRow = (line: string) => line.split(sep).map((c) => c.trim());

  // Detectar cabecera (si la primera línea contiene "nombre" o "direccion")
  let start = 0;
  const first = splitRow(lines[0]).map((c) => c.toLowerCase());
  if (first.includes('nombre') || first.includes('direccion')) {
    start = 1;
  }

  const rows: CsvAlumnoRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    const get = (idx: number) => cells[idx] || '';
    rows.push({
      nombre: get(0),
      direccion: get(1),
      lat: Number(get(2)) || 0,
      lng: Number(get(3)) || 0,
      grado: get(4),
      dias: get(5),
      modalidad: get(6),
      representante: get(7),
      telefono: get(8),
      email: get(9),
    });
  }

  const valid = rows.filter((r) => r.nombre);
  if (valid.length === 0) {
    return { ok: false, rows: [], error: `No se encontraron filas con nombre. Columnas esperadas: ${HEADERS.join(', ')}` };
  }

  return { ok: true, rows: valid };
}
