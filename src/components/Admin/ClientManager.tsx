/**
 * ClientManager — Gestión de clientes (multi-tenant, solo superadmin).
 *  - Activar/desactivar el modo multi-cliente (requiere configurar el dashboard de InstantDB).
 *  - Crear, activar/desactivar y "gestionar" clientes.
 *  - Respaldo de solo lectura.
 *  - Importador CSV de alumnos por cliente.
 */

import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Plus,
  Save,
  Power,
  Settings2,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Database
} from 'lucide-react';
import { Cliente } from '../../types';
import { downloadBackup } from '../../services/backup';
import { parseAlumnosCsv, CsvAlumnoRow } from '../../services/clientCsvImport';

interface ClientManagerProps {
  clientes: Cliente[];
  colegiosCount: number;
  alumnosCount: number;
  conductoresCount: number;
  multitenantActive: boolean;
  backupData: Record<string, any>;
  onSetMultitenant: (on: boolean) => Promise<void>;
  onSaveCliente: (cliente: Cliente) => Promise<void>;
  onDeactivateCliente: (id: string) => Promise<void>;
  onManageCliente: (id: string) => void;
  onImportAlumnos: (clienteId: string, rows: CsvAlumnoRow[]) => Promise<void>;
  onBack: () => void;
}

const PLANS = [
  { id: 'basico', label: 'Básico ($90/año)' },
  { id: 'pro', label: 'Pro ($180/año)' },
  { id: 'premium', label: 'Premium ($300/año)' },
  { id: 'escolar', label: 'Escolar (colegio)' },
];

export const ClientManager: React.FC<ClientManagerProps> = ({
  clientes,
  colegiosCount,
  alumnosCount,
  conductoresCount,
  multitenantActive,
  backupData,
  onSetMultitenant,
  onSaveCliente,
  onDeactivateCliente,
  onManageCliente,
  onImportAlumnos,
  onBack,
}) => {
  const [nombre, setNombre] = useState('');
  const [plan, setPlan] = useState('pro');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const createCliente = async () => {
    if (!nombre.trim()) return;
    await onSaveCliente({
      id: crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}`,
      nombre: nombre.trim(),
      plan,
      activo: true,
    });
    setNombre('');
    setMsg({ type: 'ok', text: `Cliente "${nombre.trim()}" creado.` });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleImportCsv = async (clientId: string) => {
    if (!clientId || !csvText.trim()) return;
    const parsed = parseAlumnosCsv(csvText);
    if (!parsed.ok) {
      setMsg({ type: 'err', text: parsed.error || 'Error al leer el CSV.' });
      return;
    }
    setImporting(true);
    try {
      await onImportAlumnos(clientId, parsed.rows);
      setMsg({ type: 'ok', text: `Se importaron ${parsed.rows.length} alumnos.` });
      setCsvText('');
    } catch (e) {
      setMsg({ type: 'err', text: 'No se pudo importar el CSV.' });
    } finally {
      setImporting(false);
    }
  };

  const readFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.readAsText(f);
  };

  return (
    <div className="h-full overflow-y-auto bg-canvas p-4 sm:p-6">
      <div className="max-w-[1100px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface border border-line text-ink hover:bg-soft-gray transition-colors cursor-pointer"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </button>
            <div>
              <h2 className="text-lg font-black text-ink flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span>Clientes (multi-tenant)</span>
              </h2>
              <p className="text-xs text-muted">
                Crea y gestiona los clientes (conductores/colegios). Cada uno ve solo sus datos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadBackup(backupData)}
              className="flex items-center gap-1.5 rounded-xl bg-surface border border-line px-3 py-2 text-xs font-bold text-ink hover:bg-soft-gray transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Descargar respaldo
            </button>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${multitenantActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
              {multitenantActive ? '● Multi-cliente ACTIVO' : '○ Multi-cliente inactivo'}
            </span>
          </div>
        </div>

        {msg && (
          <div className={`rounded-xl border p-3 text-xs font-bold flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-alert'}`}>
            {msg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {msg.text}
          </div>
        )}

        {/* Panel de activación */}
        {!multitenantActive && (
          <div className="rounded-card bg-surface border border-line shadow-soft p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-extrabold text-ink">Activar modo multi-cliente</h3>
            </div>
            <ol className="text-xs text-muted space-y-1.5 list-decimal list-inside">
              <li>En el dashboard de <b>InstantDB</b> crea la entidad <code className="bg-soft-gray px-1 rounded">clientes</code> (campos: <code>nombre</code>, <code>plan</code>, <code>activo</code>, <code>created_at</code>).</li>
              <li>Agrega el atributo <code className="bg-soft-gray px-1 rounded">cliente_id</code> (texto, opcional) a: colegios, representantes, alumnos, conductores, rutas_diarias, paradas_ruta, tracking_logs, usuarios, eventos_ruta, webhook_logs.</li>
              <li>Pulsa <b>Activar</b>: se creará el cliente raíz "Mi Instalación" y se asignará <code>cliente_id</code> a tus datos actuales (no se borra nada).</li>
            </ol>
            <button
              onClick={() => onSetMultitenant(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white hover:bg-blue-600 transition-colors cursor-pointer"
            >
              <Power className="h-4 w-4" /> Activar multi-cliente
            </button>
          </div>
        )}

        {/* Crear cliente */}
        {multitenantActive && (
          <>
            <div className="rounded-card bg-surface border border-line shadow-soft p-4 space-y-3">
              <h3 className="text-sm font-extrabold text-ink flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" /> Nuevo cliente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px_auto] gap-2">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre del cliente (ej. Transportes XYZ)"
                  className="rounded-xl bg-canvas border border-line px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="rounded-xl bg-canvas border border-line px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none cursor-pointer"
                >
                  {PLANS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <button
                  onClick={createCliente}
                  disabled={!nombre.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-white hover:bg-blue-600 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" /> Crear
                </button>
              </div>
            </div>

            {/* Lista de clientes */}
            <div className="space-y-3">
              {clientes.length === 0 && (
                <div className="rounded-card bg-surface border border-line p-8 text-center text-muted">
                  <Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold">Aún no hay clientes</p>
                  <p className="text-xs mt-1">Crea el primero con el formulario de arriba.</p>
                </div>
              )}

              {clientes.map((c) => (
                <div key={c.id} className={`rounded-card bg-surface border shadow-soft p-4 ${c.activo ? 'border-line' : 'border-rose-200 opacity-70'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-ink text-sm">{c.nombre}</h4>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${c.activo ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-alert border border-rose-200'}`}>
                          {c.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        Plan: <b className="text-primary capitalize">{c.plan || 'basico'}</b>
                        {c.id === 'c0000000-0000-4000-8000-000000000001' ? ' · (cliente raíz)' : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onManageCliente(c.id)}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-blue-600 transition-colors cursor-pointer"
                      >
                        <Settings2 className="h-3.5 w-3.5" /> Gestionar
                      </button>
                      <button
                        onClick={() => onDeactivateCliente(c.id)}
                        title={c.activo ? 'Desactivar' : 'Activar'}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-extrabold transition-colors cursor-pointer ${c.activo ? 'border-rose-200 text-alert hover:bg-rose-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}
                      >
                        <Power className="h-3.5 w-3.5" /> {c.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>

                  {/* Import CSV */}
                  <div className="mt-3 border-t border-line/70 pt-3">
                    <p className="text-[11px] font-bold text-muted flex items-center gap-1.5">
                      <Upload className="h-3 w-3" /> Importar alumnos (CSV) a este cliente
                    </p>
                    <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
                        />
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="rounded-lg bg-soft-gray border border-line px-3 py-1.5 text-[11px] font-bold text-ink hover:bg-line transition-colors cursor-pointer"
                        >
                          Elegir archivo
                        </button>
                        <span className="text-[10px] text-muted truncate">
                          {csvText ? `${csvText.split('\n').filter(Boolean).length} líneas` : 'CSV: nombre,direccion,lat,lng,grado,dias,modalidad,representante,telefono,email'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleImportCsv(c.id)}
                        disabled={importing}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 border border-primary/25 px-3 py-1.5 text-[11px] font-extrabold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5" /> {importing ? 'Importando...' : 'Importar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Resumen global */}
            <div className="rounded-card bg-surface border border-line shadow-soft p-4 text-xs text-muted flex flex-wrap gap-x-6 gap-y-1">
              <span><b className="text-ink">{clientes.length}</b> clientes</span>
              <span><b className="text-ink">{colegiosCount}</b> colegios</span>
              <span><b className="text-ink">{alumnosCount}</b> alumnos</span>
              <span><b className="text-ink">{conductoresCount}</b> conductores</span>
              <span className="text-[10px]">El superadmin gestiona cada cliente con "Gestionar".</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
