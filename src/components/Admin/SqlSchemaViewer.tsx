/**
 * Database Schema Viewer: InstantDB & PostgreSQL / Insforge
 * App ID: 9bfbca9b-1445-4948-98f4-70bfcf2164a2
 */

import React, { useState } from 'react';
import { Database, Copy, Check, Download, Zap, Layers, RefreshCw, CheckCircle2 } from 'lucide-react';
import { INSTANT_APP_ID, seedInstantDatabase, db } from '../../services/instantDb';

const INSTANTDB_SCHEMA_TS = `// ==============================================================================
// INSTANTDB SCHEMA DEFINITION & ENTITIES
// App ID: ${INSTANT_APP_ID}
// ==============================================================================

import { init, i } from '@instantdb/react';

const _schema = i.schema({
  entities: {
    // 1. Colegios (Destinos Escolares)
    colegios: i.entity({
      nombre: i.string(),
      direccion: i.string(),
      lat: i.number(),
      lng: i.number(),
      hora_llegada_limite: i.string(), // "08:00:00"
      contacto_telefono: i.string().optional(),
      created_at: i.string().optional(),
    }),

    // 2. Representantes (Padres y Tutores)
    representantes: i.entity({
      nombre: i.string(),
      telefono_whatsapp: i.string(),
      magic_token: i.string(), // Token único para acceso sin contraseña
      email: i.string().optional(),
      created_at: i.string().optional(),
    }),

    // 3. Alumnos (Estudiantes y puntos de parada)
    alumnos: i.entity({
      nombre: i.string(),
      colegio_id: i.string(),
      representante_id: i.string(),
      direccion_recogida: i.string(),
      lat: i.number(),
      lng: i.number(),
      grado: i.string().optional(),
      notas_medicas: i.string().optional(),
      tiempo_abordaje_estimado_min: i.number().optional(), // Default: 2.5 min
      created_at: i.string().optional(),
    }),

    // 4. Rutas Diarias (Planificación y H_salida_estimada)
    rutas_diarias: i.entity({
      fecha: i.string(),
      colegio_id: i.string(),
      origen_lat: i.number(),
      origen_lng: i.number(),
      origen_direccion: i.string().optional(),
      modo_optimizacion: i.string(), // 'fijo' | 'trafico_real'
      hora_llegada_objetivo: i.string(),
      hora_salida_estimada: i.string(),
      hora_salida_real: i.string().optional(),
      hora_llegada_real: i.string().optional(),
      tiempo_manejo_estimado_min: i.number(),
      tiempo_abordaje_total_min: i.number(),
      tiempo_total_estimado_min: i.number(),
      distancia_total_km: i.number(),
      estado: i.string(), // 'planificada' | 'en_curso' | 'completada'
      tiempo_abordaje_por_alumno_min: i.number(),
      created_at: i.string().optional(),
      polyline_json: i.string().optional(),
    }),

    // 5. Paradas de la Ruta (Secuencia ordenada y estado por alumno)
    paradas_ruta: i.entity({
      ruta_id: i.string(),
      alumno_id: i.string(),
      orden: i.number(),
      hora_estimada: i.string(),
      hora_real: i.string().optional(),
      estado: i.string(), // 'pendiente' | 'recogido' | 'completado' | 'ausente'
      distancia_desde_anterior_km: i.number().optional(),
      tiempo_desde_anterior_min: i.number().optional(),
      lat: i.number(),
      lng: i.number(),
      created_at: i.string().optional(),
    }),

    // 6. Tracking Logs (GPS en tiempo real)
    tracking_logs: i.entity({
      ruta_id: i.string(),
      lat: i.number(),
      lng: i.number(),
      velocidad_kmh: i.number().optional(),
      rumbo_grados: i.number().optional(),
      timestamp: i.string(),
    }),

    // 7. Usuarios & Roles (Admin / Operador)
    usuarios: i.entity({
      email: i.string(),
      nombre: i.string(),
      rol: i.string(),
      created_at: i.string().optional(),
    }),
  },
});

export const db = init({ appId: '${INSTANT_APP_ID}' });
`;

const SQL_SCHEMA_CONTENT = `-- ==============================================================================
-- SCHEMA DEFINITION: INSFORGE / POSTGRESQL (CON EXTENSIÓN POSTGIS & SPATIAL INDEXES)
-- Sistema de Optimización de Rutas y Seguimiento de Transporte Escolar (PWA)
-- ==============================================================================

-- 0. Habilitar extensión espacial (PostGIS) y UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. TABLA: colegios
CREATE TABLE IF NOT EXISTS colegios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL,
    direccion TEXT NOT NULL,
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    hora_llegada_limite TIME NOT NULL DEFAULT '08:00:00',
    contacto_telefono VARCHAR(30),
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_colegios_geom ON colegios USING GIST(geom);

-- 2. TABLA: representantes
CREATE TABLE IF NOT EXISTS representantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL,
    telefono_whatsapp VARCHAR(30) NOT NULL,
    magic_token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
    email VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_representantes_magic_token ON representantes(magic_token);
CREATE INDEX IF NOT EXISTS idx_representantes_telefono ON representantes(telefono_whatsapp);

-- 3. TABLA: alumnos
CREATE TABLE IF NOT EXISTS alumnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(150) NOT NULL,
    colegio_id UUID NOT NULL REFERENCES colegios(id) ON DELETE RESTRICT,
    representante_id UUID NOT NULL REFERENCES representantes(id) ON DELETE CASCADE,
    direccion_recogida TEXT NOT NULL,
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    grado VARCHAR(50),
    notas_medicas TEXT,
    tiempo_abordaje_estimado_min NUMERIC(4, 2) DEFAULT 2.50,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alumnos_colegio ON alumnos(colegio_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_representante ON alumnos(representante_id);
CREATE INDEX IF NOT EXISTS idx_alumnos_geom ON alumnos USING GIST(geom);

-- 4. TABLA: rutas_diarias
CREATE TABLE IF NOT EXISTS rutas_diarias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    colegio_id UUID NOT NULL REFERENCES colegios(id) ON DELETE RESTRICT,
    origen_lat NUMERIC(10, 7) NOT NULL,
    origen_lng NUMERIC(10, 7) NOT NULL,
    origen_direccion TEXT,
    modo_optimizacion VARCHAR(20) NOT NULL CHECK (modo_optimizacion IN ('fijo', 'trafico_real')),
    hora_llegada_objetivo TIME NOT NULL DEFAULT '08:00:00',
    hora_salida_estimada TIME NOT NULL,
    hora_salida_real TIMESTAMP WITH TIME ZONE,
    hora_llegada_real TIMESTAMP WITH TIME ZONE,
    tiempo_manejo_estimado_min NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    tiempo_abordaje_total_min NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    distancia_total_km NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    tiempo_abordaje_por_alumno_min NUMERIC(4, 2) DEFAULT 2.50,
    estado VARCHAR(20) NOT NULL DEFAULT 'planificada' CHECK (estado IN ('planificada', 'en_curso', 'completada', 'cancelada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rutas_diarias_fecha ON rutas_diarias(fecha);
CREATE INDEX IF NOT EXISTS idx_rutas_diarias_estado ON rutas_diarias(estado);

-- 5. TABLA: paradas_ruta
CREATE TABLE IF NOT EXISTS paradas_ruta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id UUID NOT NULL REFERENCES rutas_diarias(id) ON DELETE CASCADE,
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE RESTRICT,
    orden INT NOT NULL,
    hora_estimada TIME NOT NULL,
    hora_real TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'recogido', 'completado', 'ausente')),
    distancia_desde_anterior_km NUMERIC(6, 2) DEFAULT 0.00,
    tiempo_desde_anterior_min NUMERIC(6, 2) DEFAULT 0.00,
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ruta_id, orden),
    UNIQUE(ruta_id, alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_paradas_ruta_ruta_id ON paradas_ruta(ruta_id);
CREATE INDEX IF NOT EXISTS idx_paradas_ruta_alumno_id ON paradas_ruta(alumno_id);
CREATE INDEX IF NOT EXISTS idx_paradas_ruta_estado ON paradas_ruta(estado);

-- 6. TABLA: tracking_log
CREATE TABLE IF NOT EXISTS tracking_log (
    id BIGSERIAL PRIMARY KEY,
    ruta_id UUID NOT NULL REFERENCES rutas_diarias(id) ON DELETE CASCADE,
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    velocidad_kmh NUMERIC(5, 2) DEFAULT 0.00,
    rumbo_grados NUMERIC(5, 2),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);

CREATE INDEX IF NOT EXISTS idx_tracking_log_ruta_id ON tracking_log(ruta_id);
CREATE INDEX IF NOT EXISTS idx_tracking_log_timestamp ON tracking_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_log_geom ON tracking_log USING GIST(geom);

-- 7. TABLA: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(150) UNIQUE NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    rol VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
`;

export const SqlSchemaViewer: React.FC = () => {
  const [activeSchemaTab, setActiveSchemaTab] = useState<'instantdb' | 'postgresql'>('instantdb');
  const [copied, setCopied] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const currentContent = activeSchemaTab === 'instantdb' ? INSTANTDB_SCHEMA_TS : SQL_SCHEMA_CONTENT;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const filename = activeSchemaTab === 'instantdb' ? 'instantdb_schema.ts' : 'insforge_rutaescolar_schema.sql';
    const type = activeSchemaTab === 'instantdb' ? 'text/typescript' : 'text/sql';
    const blob = new Blob([currentContent], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    setSeedSuccess(false);
    const res = await seedInstantDatabase(true);
    setIsSeeding(false);
    if (res) {
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 4000);
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100 p-4 space-y-4 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
            <Database className="h-5 w-5 text-amber-400" />
            <span>Esquema y Modelos de Datos</span>
          </h2>
          <p className="text-xs text-slate-400">
            InstantDB Reactiva (App ID: <code className="text-amber-400 font-mono">{INSTANT_APP_ID}</code>) & PostgreSQL PostGIS DDL
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Seed button */}
          <button
            onClick={handleSeedData}
            disabled={isSeeding}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
            title="Sincronizar entidades con datos reales en InstantDB"
          >
            {seedSuccess ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${isSeeding ? 'animate-spin' : ''}`} />
            )}
            <span>{seedSuccess ? '¡Sincronizado!' : isSeeding ? 'Sincronizando...' : 'Poblar InstantDB'}</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-200 border border-slate-700 hover:bg-slate-700 transition-all cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-black text-slate-950 hover:bg-amber-400 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Descargar</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher: InstantDB vs PostgreSQL */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSchemaTab('instantdb')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSchemaTab === 'instantdb'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>InstantDB (Reactivo & Auth en Vivo)</span>
        </button>

        <button
          onClick={() => setActiveSchemaTab('postgresql')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSchemaTab === 'postgresql'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Database className="h-3.5 w-3.5" />
          <span>PostgreSQL / PostGIS (Insforge SQL DDL)</span>
        </button>
      </div>

      {/* Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">1. Colegios</span>
          <span className="font-semibold text-amber-400">Destinos escolares</span>
        </div>
        <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">2. Representantes</span>
          <span className="font-semibold text-amber-400">Magic tokens & WA</span>
        </div>
        <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">3. Alumnos</span>
          <span className="font-semibold text-amber-400">Coordenadas & Grado</span>
        </div>
        <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">4. Rutas Diarias</span>
          <span className="font-semibold text-amber-400">Algoritmo H_salida</span>
        </div>
        <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">5. Paradas Ruta</span>
          <span className="font-semibold text-amber-400">Recogido / Ausente</span>
        </div>
        <div className="rounded-lg bg-slate-900 border border-slate-800 p-2.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">6. Tracking Logs</span>
          <span className="font-semibold text-amber-400">GPS en Tiempo Real</span>
        </div>
      </div>

      {/* Code Viewer */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 shadow-inner">
        <pre className="whitespace-pre-wrap">{currentContent}</pre>
      </div>
    </div>
  );
};
