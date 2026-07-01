-- ============================================================
-- Table: facultad
-- ============================================================
CREATE TABLE public.facultad (
    id         BIGINT      NOT NULL,
    nombre     TEXT        NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),

    PRIMARY KEY (id)
);

-- ============================================================
-- Table: carrera
-- ============================================================
CREATE TABLE public.carrera (
    id         BIGINT      NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    nombre     TEXT,
    facultad   BIGINT,

    PRIMARY KEY (id),
    FOREIGN KEY (facultad) REFERENCES public.facultad(id)
);

-- ============================================================
-- Table: estado
-- ============================================================
CREATE TABLE public.estado (
    id         BIGINT      NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    nombre     TEXT        NOT NULL,

    PRIMARY KEY (id)
);

-- ============================================================
-- Table: estudiantes
-- ============================================================
CREATE TABLE public.estudiantes (
    id                      BIGINT      NOT NULL DEFAULT nextval('estudiantes_id_seq'::regclass),
    nombre                  TEXT        NOT NULL,
    cedula                  BIGINT,
    semestre                TEXT,
    ultima_ubicacion        TEXT,
    descripcion             TEXT,
    fecha_registro          TIMESTAMPTZ NOT NULL DEFAULT now(),
    registrado_por          TEXT,
    fecha_aparecio          TIMESTAMPTZ,
    tipo_confirmacion       TEXT,
    detalles_confirmacion   TEXT,
    reportado_aparicion_por TEXT,
    contacto_reportador     TEXT,
    carrera                 BIGINT,
    tipo                    TEXT        DEFAULT 'Pregrado',
    estado                  BIGINT      NOT NULL DEFAULT 1,

    PRIMARY KEY (id),
    FOREIGN KEY (carrera) REFERENCES public.carrera(id),
    FOREIGN KEY (estado)  REFERENCES public.estado(id)
);

-- ============================================================
-- Table: contacto
-- ============================================================
CREATE TABLE public.contacto (
    id         BIGINT      NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    nombre     TEXT,
    telefonos  TEXT,
    relacion   TEXT,
    estudiante BIGINT,

    PRIMARY KEY (id),
    FOREIGN KEY (estudiante) REFERENCES public.estudiantes(id)
);

-- ============================================================
-- Table: ubicacion
-- ============================================================
CREATE TABLE public.ubicacion (
    id         BIGINT      NOT NULL,
    estudiante BIGINT      NOT NULL,
    latitud    FLOAT8      NOT NULL,
    longitud   FLOAT8      NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (id),
    FOREIGN KEY (estudiante) REFERENCES public.estudiantes(id) ON DELETE CASCADE
);

-- ============================================================
-- Table: snapshots
-- ============================================================
CREATE TABLE public.snapshots (
    id            BIGINT      NOT NULL DEFAULT nextval('snapshots_id_seq'::regclass),
    tomado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    desaparecidos INTEGER     NOT NULL,
    aparecidos    INTEGER     NOT NULL,
    fallecidos    INTEGER     NOT NULL,
    total         INTEGER     NOT NULL,

    PRIMARY KEY (id)
);
