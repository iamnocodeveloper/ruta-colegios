-- ==============================================================================
-- SCHEMA DEFINITION: INSFORGE / POSTGRESQL (CON EXTENSIÓN POSTGIS)
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
    hermano_ids JSONB DEFAULT '[]'::jsonb,
    cuota_mensual NUMERIC(10, 2) DEFAULT 0.00,
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
    -- Horario elegido por el usuario: hora de salida y hora de llegada deseadas
    hora_salida_deseada TIME,
    hora_llegada_deseada TIME,
    -- true si H_salida + T_total <= H_llegada (el horario cubre TODAS las paradas)
    horario_valido BOOLEAN DEFAULT TRUE,
    hora_llegada_estimada TIME,
    -- Tramos/paradas elegidos: JSONB { legIndex: indiceAlternativa } (0 = principal)
    tramos_elegidos JSONB DEFAULT '{}'::jsonb,
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

-- 5.1 TABLA: pagos (cobranza)
CREATE TABLE IF NOT EXISTS pagos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    representante_id UUID NOT NULL REFERENCES representantes(id) ON DELETE CASCADE,
    monto NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
    mes_cobrado VARCHAR(7) NOT NULL, -- YYYY-MM
    concepto VARCHAR(150),
    metodo_pago VARCHAR(20) NOT NULL DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'otro')),
    estado VARCHAR(20) NOT NULL DEFAULT 'pagado' CHECK (estado IN ('pagado', 'pendiente', 'parcial')),
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pagos_alumno ON pagos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_pagos_representante ON pagos(representante_id);
CREATE INDEX IF NOT EXISTS idx_pagos_mes_cobrado ON pagos(mes_cobrado);

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

-- 7. TABLA DE AUDITORÍA: webhook_logs_whatsapp
CREATE TABLE IF NOT EXISTS webhook_logs_whatsapp (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruta_id UUID REFERENCES rutas_diarias(id) ON DELETE SET NULL,
    alumno_id UUID REFERENCES alumnos(id) ON DELETE SET NULL,
    evento VARCHAR(50) NOT NULL,
    telefono_destinatario VARCHAR(30) NOT NULL,
    payload_json JSONB NOT NULL,
    http_status_code INT,
    respuesta_api TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_alumno ON webhook_logs_whatsapp(alumno_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_timestamp ON webhook_logs_whatsapp(timestamp DESC);

-- ==============================================================================
-- VISTAS ÚTILES PARA EL PORTAL DE REPRESENTANTES Y CONDUCTOR
-- ==============================================================================

-- Vista del panel del representante con token mágico
CREATE OR REPLACE VIEW v_panel_representante AS
SELECT 
    r.magic_token,
    r.nombre AS representante_nombre,
    r.telefono_whatsapp,
    a.id AS alumno_id,
    a.nombre AS alumno_nombre,
    a.direccion_recogida,
    a.lat AS alumno_lat,
    a.lng AS alumno_lng,
    c.nombre AS colegio_nombre,
    c.direccion AS colegio_direccion,
    c.hora_llegada_limite AS colegio_hora_llegada,
    rd.id AS ruta_id,
    rd.fecha AS ruta_fecha,
    rd.estado AS ruta_estado,
    rd.hora_salida_estimada,
    pr.id AS parada_id,
    pr.orden AS parada_orden,
    pr.hora_estimada AS parada_hora_estimada,
    pr.hora_real AS parada_hora_real,
    pr.estado AS parada_estado,
    tl.lat AS van_lat_actual,
    tl.lng AS van_lng_actual,
    tl.timestamp AS van_ultimo_reporte
FROM representantes r
JOIN alumnos a ON a.representante_id = r.id
JOIN colegios c ON a.colegio_id = c.id
LEFT JOIN paradas_ruta pr ON pr.alumno_id = a.id
LEFT JOIN rutas_diarias rd ON rd.id = pr.ruta_id AND rd.fecha = CURRENT_DATE
LEFT JOIN LATERAL (
    SELECT lat, lng, timestamp 
    FROM tracking_log 
    WHERE ruta_id = rd.id 
    ORDER BY timestamp DESC 
    LIMIT 1
) tl ON TRUE;
