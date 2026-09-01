-- CREATE DATABASE InmobiliariaDelCastillo;
-- USE InmobiliariaDelCastillo;

-- ========================================================
-- 1. TABLA: PERSONAS (Incluye Agentes del Equipo)
-- ========================================================
CREATE TABLE Personas (
    id_persona INT AUTO_INCREMENT PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    dni_cuit VARCHAR(20) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    email VARCHAR(100),
    direccion_particular VARCHAR(150),
    rol_principal ENUM('Propietario', 'Inquilino', 'Comprador', 'Colega', 'Agente') NOT NULL,
    -- Filtro de Riesgo Legal
    estado_bcra INT DEFAULT 1,
    inhibido BOOLEAN DEFAULT FALSE,
    link_informe_veraz_pdf VARCHAR(255),
    fecha_ultima_auditoria DATE
) ENGINE=InnoDB;

-- ========================================================
-- 2. TABLA: PROPIEDADES (Lógica de Complejos, PH y Amenities)
-- ========================================================
CREATE TABLE Propiedades (
    id_propiedad INT AUTO_INCREMENT PRIMARY KEY,
    id_propietario_actual INT NOT NULL,
    
    -- Lógica Complejo/Unidad
    id_complejo_padre INT NULL, -- Si es NULL, es independiente o es el Complejo matriz. Si tiene ID, es una unidad dentro de ese complejo.
    
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    tipo_inmueble ENUM('Casa', 'Departamento', 'Terreno', 'Local', 'Cabaña', 'Complejo', 'Galpon', 'Oficina') NOT NULL,
    tipo_operacion ENUM('Venta', 'Alquiler Permanente', 'Alquiler Temporario', 'Permuta') NOT NULL,
    
    -- Características Legales y Físicas
    es_ph BOOLEAN DEFAULT FALSE,
    precio DECIMAL(12,2) NOT NULL,
    moneda ENUM('ARS', 'USD') NOT NULL,
    
    superficie_terreno_m2 DECIMAL(10,2),
    superficie_cubierta_m2 DECIMAL(10,2),
    superficie_semicubierta_m2 DECIMAL(10,2),
    
    cant_ambientes INT DEFAULT 0,
    cant_dormitorios INT DEFAULT 0,
    cant_banos INT DEFAULT 0,
    cant_toilettes INT DEFAULT 0,
    
    -- Amenities Detallados (Clave para filtrar en la plataforma web)
    tiene_cochera BOOLEAN DEFAULT FALSE,
    capacidad_vehiculos INT DEFAULT 0,
    cochera_cubierta BOOLEAN DEFAULT FALSE,
    tiene_pileta_privada BOOLEAN DEFAULT FALSE,
    tiene_pileta_compartida BOOLEAN DEFAULT FALSE, -- Ideal para unidades en complejos
    tiene_asador_quincho BOOLEAN DEFAULT FALSE,
    tiene_patio_jardin BOOLEAN DEFAULT FALSE,
    vista_al_lago BOOLEAN DEFAULT FALSE,
    vista_a_sierras BOOLEAN DEFAULT FALSE,
    seguridad_24hs BOOLEAN DEFAULT FALSE,
    
    -- Servicios del Inmueble
    tiene_agua_corriente BOOLEAN DEFAULT FALSE,
    tiene_gas_natural BOOLEAN DEFAULT FALSE,
    tiene_cloacas BOOLEAN DEFAULT FALSE,
    tiene_internet_wifi BOOLEAN DEFAULT FALSE,
    tipo_calefaccion ENUM('Ninguna', 'Tiro Balanceado', 'Radiadores', 'Losa Radiante', 'Aire Acondicionado') DEFAULT 'Ninguna',
    
    -- Control de Estados
    estado_propiedad ENUM('Disponible', 'Reservada', 'Alquilada', 'Vendida', 'Permutada', 'Inactiva', 'En Obra') DEFAULT 'Disponible',
    
    -- Gestión Documental
    link_escritura_pdf VARCHAR(255),
    link_informe_dominio_pdf VARCHAR(255),
    
    FOREIGN KEY (id_propietario_actual) REFERENCES Personas(id_persona) ON UPDATE CASCADE,
    FOREIGN KEY (id_complejo_padre) REFERENCES Propiedades(id_propiedad) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ========================================================
-- 2.1. TABLA: IMÁGENES DE PROPIEDADES (Para Galería Web)
-- ========================================================
CREATE TABLE Imagenes_Propiedad (
    id_imagen INT AUTO_INCREMENT PRIMARY KEY,
    id_propiedad INT NOT NULL,
    url_imagen VARCHAR(255) NOT NULL,
    es_foto_principal BOOLEAN DEFAULT FALSE,
    orden_aparicion INT DEFAULT 1,
    
    FOREIGN KEY (id_propiedad) REFERENCES Propiedades(id_propiedad) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ========================================================
-- 3. TABLA: CONTRATOS Y OPERACIONES
-- ========================================================
CREATE TABLE Contratos_y_Operaciones (
    id_operacion INT AUTO_INCREMENT PRIMARY KEY,
    id_propiedad INT NOT NULL,
    id_vendedor_propietario INT NOT NULL,
    id_comprador_inquilino INT NOT NULL,
    tipo_contrato ENUM('Locacion', 'Compraventa', 'Permuta') NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    monto_total_operacion DECIMAL(12,2) NOT NULL,
    moneda_operacion ENUM('ARS', 'USD') NOT NULL,
    
    -- Reglas Locativas (DNU 70/2023 u otros)
    indice_ajuste ENUM('IPC', 'ICL', 'Fijo', 'Ninguno') DEFAULT 'Ninguno',
    frecuencia_ajuste_meses INT,
    interes_mora_diario DECIMAL(5,4) DEFAULT 0.0000,
    
    -- Reglas de Comisiones
    porcentaje_comision_vendedor DECIMAL(4,2) DEFAULT 3.00,
    porcentaje_comision_comprador DECIMAL(4,2) DEFAULT 3.00,
    es_co_corretaje BOOLEAN DEFAULT FALSE,
    id_inmobiliaria_colega INT NULL,
    
    FOREIGN KEY (id_propiedad) REFERENCES Propiedades(id_propiedad) ON UPDATE CASCADE,
    FOREIGN KEY (id_vendedor_propietario) REFERENCES Personas(id_persona) ON UPDATE CASCADE,
    FOREIGN KEY (id_comprador_inquilino) REFERENCES Personas(id_persona) ON UPDATE CASCADE,
    FOREIGN KEY (id_inmobiliaria_colega) REFERENCES Personas(id_persona) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ========================================================
-- 4. TABLA: FACTURAS DE SERVICIOS (Luz, Agua, Gas cargados por el Agente)
-- ========================================================
CREATE TABLE Facturas_Servicios (
    id_factura INT AUTO_INCREMENT PRIMARY KEY,
    id_propiedad INT NOT NULL, -- Puede ser la propiedad matriz (Complejo) o la unidad específica
    id_agente_carga INT NOT NULL, -- Agente del equipo que sube el comprobante
    tipo_servicio ENUM('Luz', 'Agua', 'Gas', 'Expensas', 'Impuestos') NOT NULL,
    periodo_mes_anio VARCHAR(20) NOT NULL, -- Ej: '04-2026'
    monto_total_factura DECIMAL(12,2) NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado_pago_ente ENUM('Pendiente', 'Pagado por Inmobiliaria', 'Pagado por Propietario') DEFAULT 'Pendiente',
    link_factura_pdf VARCHAR(255),
    
    FOREIGN KEY (id_propiedad) REFERENCES Propiedades(id_propiedad) ON UPDATE CASCADE,
    FOREIGN KEY (id_agente_carga) REFERENCES Personas(id_persona) ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ========================================================
-- 5. TABLA: LIQUIDACIONES MENSUALES (Cobros y Rendiciones)
-- ========================================================
CREATE TABLE Liquidaciones_Mensuales (
    id_liquidacion INT AUTO_INCREMENT PRIMARY KEY,
    id_contrato INT NOT NULL,
    mes_ano_liquidado VARCHAR(20) NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    fecha_pago_real DATE NULL, -- NULL si el inquilino aún no pagó
    
    -- Detalles a Cobrar al Inquilino
    monto_alquiler_base DECIMAL(12,2) NOT NULL,
    monto_luz_servicios DECIMAL(12,2) DEFAULT 0.00, -- Extraído/Prorrateado desde la tabla Facturas_Servicios
    monto_expensas DECIMAL(12,2) DEFAULT 0.00,
    monto_mora_aplicada DECIMAL(12,2) DEFAULT 0.00, -- Calculado e insertado por el backend web en base a los días de atraso
    
    total_a_cobrar_inquilino DECIMAL(12,2) GENERATED ALWAYS AS (monto_alquiler_base + monto_luz_servicios + monto_expensas + monto_mora_aplicada) STORED,
    
    -- Honorarios y Rendición al Propietario
    porcentaje_honorarios_administracion DECIMAL(4,2) DEFAULT 5.00,
    monto_comision_inmobiliaria DECIMAL(12,2) GENERATED ALWAYS AS (monto_alquiler_base * (porcentaje_honorarios_administracion / 100)) STORED,
    
    -- El propietario recibe su alquiler menos los honorarios. 
    -- Si la inmobiliaria o el propietario pagó la luz por adelantado, se ajusta aquí en la lógica de negocio, 
    -- pero estructuralmente el neto base del alquiler a rendir es este:
    monto_neto_alquiler_a_rendir DECIMAL(12,2) GENERATED ALWAYS AS (monto_alquiler_base - (monto_alquiler_base * (porcentaje_honorarios_administracion / 100))) STORED,
    
    estado_cobro_inquilino ENUM('Pendiente', 'Pagado Parcial', 'Pagado Total') DEFAULT 'Pendiente',
    estado_rendicion_propietario ENUM('Pendiente', 'Rendido') DEFAULT 'Pendiente',
    
    -- Vinculación opcional a facturas específicas que justifican los cargos extra de ese mes
    id_factura_luz_vinculada INT NULL,

    FOREIGN KEY (id_contrato) REFERENCES Contratos_y_Operaciones(id_operacion) ON UPDATE CASCADE,
    FOREIGN KEY (id_factura_luz_vinculada) REFERENCES Facturas_Servicios(id_factura) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ========================================================
-- 6. TABLA: PERMUTAS
-- ========================================================
CREATE TABLE Permutas (
    id_permuta INT AUTO_INCREMENT PRIMARY KEY,
    id_operacion_madre INT NOT NULL,
    id_propiedad_a INT NOT NULL,
    id_propiedad_b INT NOT NULL,
    diferencia_efectivo DECIMAL(12,2) DEFAULT 0.00,
    moneda_diferencia ENUM('ARS', 'USD') DEFAULT 'USD',

    FOREIGN KEY (id_operacion_madre) REFERENCES Contratos_y_Operaciones(id_operacion) ON UPDATE CASCADE,
    FOREIGN KEY (id_propiedad_a) REFERENCES Propiedades(id_propiedad) ON UPDATE CASCADE,
    FOREIGN KEY (id_propiedad_b) REFERENCES Propiedades(id_propiedad) ON UPDATE CASCADE
) ENGINE=InnoDB;