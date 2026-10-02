package com.inmobiliaria.backend.service;

import com.inmobiliaria.backend.model.*;
import com.inmobiliaria.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.Objects;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;

@Service
public class ContratoService {

    @Autowired private ContratoRepository contratoRepo;
    @Autowired private PropiedadRepository propiedadRepo;
    @Autowired private LiquidacionRepository liquidacionRepo;
    @Autowired private AuditoriaService auditoria;

    /** Estados de la operación en los que todavía se está preparando: NO bloquean la propiedad. */
    private static final java.util.Set<String> PREPARATORIOS = java.util.Set.of(
        "Borrador", "En preparación", "Documentación pendiente", "Lista para contrato", "Contrato generado", "Pendiente de firma");

    /** Valores permitidos para "Estado de la operación" (los mismos que ofrece el formulario). */
    private static final java.util.Set<String> ESTADOS_OPERACION_VALIDOS;
    static {
        java.util.Set<String> s = new java.util.LinkedHashSet<>(PREPARATORIOS);
        s.add("Firmada");
        s.add("Vigente");
        ESTADOS_OPERACION_VALIDOS = java.util.Collections.unmodifiableSet(s);
    }

    private static void validarEstadoOperacion(ContratoOperacion c) {
        String e = c.getEstadoOperacion();
        if (e == null || e.isBlank()) return;   // se completa solo
        c.setEstadoOperacion(e.trim());
        if (!ESTADOS_OPERACION_VALIDOS.contains(c.getEstadoOperacion()))
            throw new IllegalArgumentException("Estado de la operación inválido: \"" + e + "\". Opciones: "
                + String.join(", ", ESTADOS_OPERACION_VALIDOS) + ".");
    }

    private static boolean esPreparatorio(ContratoOperacion c) {
        return c.getEstadoOperacion() != null && PREPARATORIOS.contains(c.getEstadoOperacion().trim());
    }

    private static boolean esTemporario(ContratoOperacion c) {
        return c.getTipoContrato() == ContratoOperacion.TipoContrato.Locacion && c.getTempCheckIn() != null;
    }

    /** Ningún texto puede superar el largo de su columna: se avisa cuál es, en vez de fallar al guardar. */
    private static void validarLargosDeTexto(ContratoOperacion c) {
        for (java.lang.reflect.Field f : ContratoOperacion.class.getDeclaredFields()) {
            if (f.getType() != String.class || java.lang.reflect.Modifier.isStatic(f.getModifiers())) continue;
            jakarta.persistence.Column col = f.getAnnotation(jakarta.persistence.Column.class);
            if (col == null || !col.columnDefinition().isEmpty()) continue;   // los TEXT no tienen tope
            try {
                f.setAccessible(true);
                Object v = f.get(c);
                if (v instanceof String t && t.length() > col.length())
                    throw new IllegalArgumentException("El campo «" + com.inmobiliaria.backend.config.MensajesBaseDatos.legible(col.name())
                        + "» es demasiado largo (máximo " + col.length() + " caracteres; tiene " + t.length() + ").");
            } catch (IllegalAccessException ignored) { }
        }
    }

    private static void noNegativo(BigDecimal v, String campo) {
        if (v != null && v.signum() < 0) throw new IllegalArgumentException("El campo \"" + campo + "\" no puede ser negativo.");
    }

    /** Reglas de datos que no dependen de otras tablas (fechas, montos, ajuste). */
    private void validarCondiciones(ContratoOperacion c) {
        validarLargosDeTexto(c);
        sincronizarAlquilerAnual(c);
        validarGarantes(c);
        if (c.getFechaInicio() == null) throw new IllegalArgumentException("La fecha de inicio es obligatoria.");
        if (c.getFechaFin() != null && !c.getFechaFin().isAfter(c.getFechaInicio()))
            throw new IllegalArgumentException("La fecha de fin debe ser posterior a la de inicio.");
        noNegativo(c.getMontoTotalOperacion(), "monto total");
        noNegativo(c.getVenPrecio(), "precio de venta");
        noNegativo(c.getVenAnticipo(), "anticipo");
        noNegativo(c.getVenMontoCuota(), "monto de la cuota");
        noNegativo(c.getVenMontoReserva(), "reserva / seña");
        noNegativo(c.getPerDiferenciaMonto(), "diferencia de la permuta");
        noNegativo(c.getAlqCanonMonto(), "canon mensual");
        noNegativo(c.getAlqMontoDeposito(), "depósito");
        noNegativo(c.getTempPrecioNoche(), "precio por noche");
        noNegativo(c.getTempPrecioTotal(), "precio total");
        noNegativo(c.getHonMontoTotal(), "honorarios totales");
        noNegativo(c.getHonParteAMonto(), "honorarios del vendedor / locador");
        noNegativo(c.getHonParteBMonto(), "honorarios del comprador / locatario");
        validarHonorarios(c);
        if (c.getInterestMoraDiario() != null
                && (c.getInterestMoraDiario().signum() < 0 || c.getInterestMoraDiario().compareTo(BigDecimal.ONE) > 0))
            throw new IllegalArgumentException("El interés diario por mora debe estar entre 0 y 1 (0.0005 = 0,05 % por día).");
        validarPermuta(c);
        validarSinSuperposicion(c);
        boolean requierePrecio = c.getTipoContrato() != ContratoOperacion.TipoContrato.Permuta;
        if (requierePrecio && (c.getMontoTotalOperacion() == null || c.getMontoTotalOperacion().signum() <= 0))
            throw new IllegalArgumentException(c.getTipoContrato() == ContratoOperacion.TipoContrato.Compraventa
                ? "Indicá el precio de la venta (mayor a cero)."
                : (esTemporario(c) ? "Indicá el precio total de la estadía (mayor a cero)." : "Indicá el canon mensual (mayor a cero)."));
        if (c.getTipoContrato() == ContratoOperacion.TipoContrato.Locacion && c.getFechaFin() == null)
            throw new IllegalArgumentException("La fecha de fin es obligatoria en los alquileres.");

        // Ajuste de las LOCACIONES anuales en pesos. Desde el DNU 70/2023 el índice y la frecuencia se pactan
        // libremente: también se puede pactar un monto fijo (sin ajuste). Si se elige ICL o IPC, la frecuencia es obligatoria.
        boolean esLocacion = c.getTipoContrato() == ContratoOperacion.TipoContrato.Locacion;
        boolean esUsd      = c.getMonedaOperacion() != null && c.getMonedaOperacion() != ContratoOperacion.Moneda.ARS;   // moneda extranjera (USD, EUR): sin ajuste por índices locales
        if (!esLocacion || esTemporario(c) || esUsd || c.getIndiceAjuste() == null
                || c.getIndiceAjuste() == ContratoOperacion.IndiceAjuste.Ninguno) {
            c.setIndiceAjuste(ContratoOperacion.IndiceAjuste.Ninguno);
            c.setFrecuenciaAjusteMeses(null);
        } else {
            if (c.getFrecuenciaAjusteMeses() == null || c.getFrecuenciaAjusteMeses() <= 0)
                throw new IllegalStateException("Elegiste ajustar el canon por " + c.getIndiceAjuste() + ": indicá cada cuántos meses se ajusta (frecuencia de ajuste).");
            if (c.getFrecuenciaAjusteMeses() > 12)
                throw new IllegalStateException("La frecuencia de ajuste no puede superar los 12 meses.");
        }
    }

    /**
     * Alquiler anual: el canon, la moneda y las fechas se guardan en dos lugares (campos "alq..." y campos generales).
     * Acá se dejan siempre iguales, para que la lista, el cálculo de honorarios y las liquidaciones lean lo mismo.
     */
    private void sincronizarAlquilerAnual(ContratoOperacion c) {
        if (esTemporario(c)) { sincronizarTemporario(c); return; }
        if (c.getTipoContrato() != ContratoOperacion.TipoContrato.Locacion) return;
        if (c.getAlqCanonMonto() != null) c.setMontoTotalOperacion(c.getAlqCanonMonto()); else c.setAlqCanonMonto(c.getMontoTotalOperacion());
        if (c.getAlqCanonMoneda() != null) c.setMonedaOperacion(c.getAlqCanonMoneda()); else c.setAlqCanonMoneda(c.getMonedaOperacion());
        if (c.getAlqFechaInicio() != null) c.setFechaInicio(c.getAlqFechaInicio()); else c.setAlqFechaInicio(c.getFechaInicio());
        if (c.getAlqFechaFin() != null) c.setFechaFin(c.getAlqFechaFin()); else c.setAlqFechaFin(c.getFechaFin());
        if (c.getAlqDiaVencimiento() == null) c.setAlqDiaVencimiento(10);
        if (c.getAlqDiaVencimiento() < 1 || c.getAlqDiaVencimiento() > 28)
            throw new IllegalArgumentException("El día de vencimiento del alquiler debe estar entre 1 y 28.");
        if (c.getAlqPorcentajeAdministracion() == null) c.setAlqPorcentajeAdministracion(new BigDecimal("10.00"));
        if (c.getAlqPorcentajeAdministracion().signum() < 0 || c.getAlqPorcentajeAdministracion().compareTo(new BigDecimal("100")) > 0)
            throw new IllegalArgumentException("Los honorarios de administración deben estar entre 0 y 100 %.");
    }

    /** Alquiler temporario: precio total, moneda y fechas siempre coinciden con los campos generales; controles de huéspedes, seña y depósito. */
    private void sincronizarTemporario(ContratoOperacion c) {
        if (c.getTempCheckOut() != null) c.setFechaFin(c.getTempCheckOut());
        if (c.getTempCheckIn() != null) c.setFechaInicio(c.getTempCheckIn());
        // Precio total: el que se cargó; si falta, noches × precio por noche
        if (c.getTempPrecioTotal() == null && c.getTempPrecioNoche() != null && c.getTempCheckOut() != null
                && c.getTempCheckOut().isAfter(c.getTempCheckIn())) {
            long noches = java.time.temporal.ChronoUnit.DAYS.between(c.getTempCheckIn(), c.getTempCheckOut());
            c.setTempPrecioTotal(c.getTempPrecioNoche().multiply(java.math.BigDecimal.valueOf(noches)).setScale(2, RoundingMode.HALF_UP));
        }
        if (c.getTempPrecioTotal() != null) c.setMontoTotalOperacion(c.getTempPrecioTotal());
        if (c.getTempMoneda() != null) c.setMonedaOperacion(c.getTempMoneda());
        if (c.getTempHuespedes() == null || c.getTempHuespedes() < 1 || c.getTempHuespedes() > 100)
            throw new IllegalArgumentException("La cantidad de huéspedes debe estar entre 1 y 100.");
        // Seña / reserva: se carga como porcentaje (0 a 100) del precio total y el monto se calcula solo.
        if (c.getTempSeniaPorcentaje() != null) {
            BigDecimal pct = c.getTempSeniaPorcentaje();
            if (pct.signum() < 0 || pct.compareTo(new BigDecimal("100")) > 0)
                throw new IllegalArgumentException("La seña debe estar entre 0 y 100 % del precio total de la estadía.");
            if (c.getTempPrecioTotal() != null)
                c.setTempSenia(c.getTempPrecioTotal().multiply(pct).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP));
        } else if (c.getTempSenia() != null && c.getTempPrecioTotal() != null && c.getTempPrecioTotal().signum() > 0) {
            // Operaciones cargadas antes con la seña en dinero: se deriva el porcentaje
            c.setTempSeniaPorcentaje(c.getTempSenia().multiply(new BigDecimal("100"))
                .divide(c.getTempPrecioTotal(), 2, RoundingMode.HALF_UP));
        }
        noNegativo(c.getTempSenia(), "seña");
        noNegativo(c.getTempDeposito(), "depósito");
        if (c.getTempSenia() != null && c.getTempPrecioTotal() != null && c.getTempSenia().compareTo(c.getTempPrecioTotal()) > 0)
            throw new IllegalArgumentException("La seña no puede ser mayor al precio total de la estadía.");
        // Registro de cobros: fechas reales (no futuras) y en orden lógico
        java.time.LocalDate hoy = java.time.LocalDate.now();
        java.time.LocalDate fs = c.getTempSeniaCobradaFecha(), fl = c.getTempSaldoCobradoFecha();
        if (fs != null) {
            if (c.getTempSenia() == null || c.getTempSenia().signum() <= 0)
                throw new IllegalArgumentException("No hay seña pactada: cargá primero el porcentaje para poder registrar su cobro.");
            if (fs.isAfter(hoy)) throw new IllegalArgumentException("La fecha de cobro de la seña no puede ser futura.");
        }
        if (fl != null) {
            if (fl.isAfter(hoy)) throw new IllegalArgumentException("La fecha de cobro del saldo no puede ser futura.");
            if (fs != null && fl.isBefore(fs)) throw new IllegalArgumentException("El saldo no puede cobrarse antes que la seña.");
        }
    }

    /**
     * Una propiedad puede tener varias estadías temporarias en fechas distintas: no se bloquea la ficha,
     * pero dos estadías confirmadas no pueden pisarse (el día del check-out puede ser el check-in de la siguiente).
     */
    private void validarSinSuperposicion(ContratoOperacion c) {
        if (!esTemporario(c) || c.getTempCheckIn() == null || c.getTempCheckOut() == null || c.getPropiedad() == null) return;
        for (ContratoOperacion o : contratoRepo.findByPropiedadIdPropiedad(c.getPropiedad().getIdPropiedad())) {
            if (o == c || (o.getIdOperacion() != null && o.getIdOperacion().equals(c.getIdOperacion()))) continue;
            if (!esTemporario(o) || o.getEstadoContrato() != ContratoOperacion.EstadoContrato.Vigente) continue;
            if (c.getTempCheckIn().isBefore(o.getTempCheckOut()) && o.getTempCheckIn().isBefore(c.getTempCheckOut()))
                throw new IllegalStateException("Esas fechas se superponen con otra estadía confirmada de esta propiedad (del "
                    + o.getTempCheckIn() + " al " + o.getTempCheckOut() + ", operación #" + o.getIdOperacion() + ").");
        }
    }

    /** Un alquiler anual, una venta o una permuta no pueden arrancar si quedan estadías temporarias confirmadas por delante. */
    private void validarSinEstadiasPendientes(ContratoOperacion c, Propiedad prop) {
        if (esTemporario(c)) return;
        java.time.LocalDate hoy = java.time.LocalDate.now();
        for (ContratoOperacion o : contratoRepo.findByPropiedadIdPropiedad(prop.getIdPropiedad())) {
            if (o == c) continue;
            if (esTemporario(o) && o.getEstadoContrato() == ContratoOperacion.EstadoContrato.Vigente
                    && o.getTempCheckOut() != null && !o.getTempCheckOut().isBefore(hoy))
                throw new IllegalStateException("'" + prop.getTitulo() + "' tiene una estadía temporaria confirmada hasta el "
                    + o.getTempCheckOut() + " (operación #" + o.getIdOperacion() + "). Finalizala o rescindila antes.");
        }
    }

    /** Garantes / fiadores: sin repetidos, que no sean el locador ni el locatario, y sin inhibición. */
    private void validarGarantes(ContratoOperacion c) {
        if (c.getGarantesAdicionales() == null || c.getGarantesAdicionales().isEmpty()) return;
        if (c.getTipoContrato() != ContratoOperacion.TipoContrato.Locacion || esTemporario(c)) {
            c.setGarantesAdicionales(new java.util.ArrayList<>());   // solo el alquiler anual lleva garantes
            return;
        }
        java.util.List<Integer> ids = new java.util.ArrayList<>(new java.util.LinkedHashSet<>(c.getGarantesAdicionales()));
        c.setGarantesAdicionales(ids);
        Integer inquilino = c.getCompradorInquilino() == null ? null : c.getCompradorInquilino().getIdPersona();
        Integer propietario = c.getVendedorPropietario() == null ? null : c.getVendedorPropietario().getIdPersona();
        for (Integer g : ids) {
            if (g == null) throw new IllegalArgumentException("Hay un garante sin identificar.");
            if (g.equals(inquilino)) throw new IllegalStateException("El locatario no puede ser su propio garante.");
            if (g.equals(propietario)) throw new IllegalStateException("El propietario no puede ser garante del alquiler.");
            auditoria.validarNoInhibido(g);
        }
    }

    private static final java.util.Set<String> ESTADOS_HON = java.util.Set.of(
        "Pendiente", "Pactado", "Facturado", "Parcialmente abonado", "Abonado", "Anulado");
    private static final java.util.Set<String> FORMAS_PAGO_HON = java.util.Set.of("Efectivo", "Transferencia", "Cheque", "A convenir");
    private static final BigDecimal CIEN = new BigDecimal("100");

    private static void porcentaje(BigDecimal v, String campo) {
        if (v != null && (v.signum() < 0 || v.compareTo(CIEN) > 0))
            throw new IllegalArgumentException("El porcentaje de " + campo + " debe estar entre 0 y 100.");
    }

    private static BigDecimal cero(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    /**
     * Honorarios de una parte: controla que el estado sea coherente con los montos y devuelve lo que cuenta
     * para el total (una parte anulada no suma).
     */
    private BigDecimal validarParteHonorarios(String parte, BigDecimal monto, BigDecimal cobrado, String estado, String forma,
                                              String comprobante, java.time.LocalDate fechaCobro) {
        if (estado != null && !ESTADOS_HON.contains(estado)) throw new IllegalArgumentException("Estado de honorarios inválido (" + parte + ").");
        if (forma != null && !FORMAS_PAGO_HON.contains(forma)) throw new IllegalArgumentException("Forma de pago de honorarios inválida (" + parte + ").");
        String est = estado == null ? "Pendiente" : estado;
        if ("Anulado".equals(est)) return BigDecimal.ZERO;
        BigDecimal m = cero(monto);
        BigDecimal c = cero(cobrado);
        if (c.compareTo(m) > 0)
            throw new IllegalArgumentException("Honorarios " + parte + ": lo cobrado no puede superar el monto pactado.");
        switch (est) {
            case "Facturado" -> {
                if (m.signum() <= 0) throw new IllegalArgumentException("Honorarios " + parte + ": no se puede marcar Facturado sin un monto.");
                if (comprobante == null || comprobante.isBlank())
                    throw new IllegalArgumentException("Honorarios " + parte + ": indicá el N° de comprobante de la factura.");
            }
            case "Parcialmente abonado" -> {
                if (c.signum() <= 0 || c.compareTo(m) >= 0)
                    throw new IllegalArgumentException("Honorarios " + parte + ": \"Parcialmente abonado\" necesita un monto cobrado mayor a cero y menor al total.");
            }
            case "Abonado" -> {
                if (m.signum() <= 0) throw new IllegalArgumentException("Honorarios " + parte + ": no se puede marcar Abonado sin un monto.");
                if (c.compareTo(m) != 0)
                    throw new IllegalArgumentException("Honorarios " + parte + ": \"Abonado\" exige que lo cobrado sea igual al monto total.");
            }
            default -> { /* Pendiente / Pactado: puede no haber cobrado nada o algo a cuenta */ }
        }
        return m;
    }

    /** Coherencia de todos los honorarios; el total lo calcula el servidor (suma de las partes no anuladas). */
    private void validarHonorarios(ContratoOperacion c) {
        porcentaje(c.getHonParteAPorcentaje(), "la parte vendedora / locadora");
        porcentaje(c.getHonParteBPorcentaje(), "la parte compradora / locataria");
        porcentaje(c.getHonColegaPorcentaje(), "la inmobiliaria colega");
        noNegativo(c.getHonBaseCalculo(), "base de cálculo de honorarios");
        noNegativo(c.getHonParteACobrado(), "honorarios cobrados (vendedor / locador)");
        noNegativo(c.getHonParteBCobrado(), "honorarios cobrados (comprador / locatario)");
        for (String[] t : new String[][]{{c.getHonParteAComprobante(), "comprobante del vendedor / locador"}, {c.getHonParteBComprobante(), "comprobante del comprador / locatario"}})
            if (t[0] != null && t[0].length() > 50) throw new IllegalArgumentException("El " + t[1] + " es demasiado largo (máximo 50 caracteres).");
        if (c.getHonEscala() != null && c.getHonEscala().length() > 200) c.setHonEscala(c.getHonEscala().substring(0, 200));

        // "Abonado" sin indicar lo cobrado = se cobró todo (contratos cargados antes de existir este campo)
        if ("Abonado".equals(c.getHonParteAEstado()) && c.getHonParteACobrado() == null && c.getHonParteAMonto() != null) c.setHonParteACobrado(c.getHonParteAMonto());
        if ("Abonado".equals(c.getHonParteBEstado()) && c.getHonParteBCobrado() == null && c.getHonParteBMonto() != null) c.setHonParteBCobrado(c.getHonParteBMonto());

        BigDecimal a = validarParteHonorarios("del vendedor / locador", c.getHonParteAMonto(), c.getHonParteACobrado(),
            c.getHonParteAEstado(), c.getHonParteAFormaPago(), c.getHonParteAComprobante(), c.getHonParteAFechaCobro());
        BigDecimal b = validarParteHonorarios("del comprador / locatario", c.getHonParteBMonto(), c.getHonParteBCobrado(),
            c.getHonParteBEstado(), c.getHonParteBFormaPago(), c.getHonParteBComprobante(), c.getHonParteBFechaCobro());
        if (c.getHonParteAMonto() != null || c.getHonParteBMonto() != null || c.getHonMontoTotal() != null)
            c.setHonMontoTotal(a.add(b).setScale(2, RoundingMode.HALF_UP));
        if (!Boolean.TRUE.equals(c.getEsCoCorretaje())) c.setHonColegaPorcentaje(null);
    }

    /** Permuta: qué entrega cada parte, diferencia en efectivo coherente y, si entrega una propiedad cargada, que sea de la Parte B. */
    private void validarPermuta(ContratoOperacion c) {
        if (c.getTipoContrato() != ContratoOperacion.TipoContrato.Permuta) {
            c.setPerPropiedadBId(null);
            return;
        }
        if (c.getPerBienesA() != null && c.getPerBienesA().isBlank()) c.setPerBienesA(null);
        if (c.getPerBienesB() != null && c.getPerBienesB().isBlank()) c.setPerBienesB(null);
        if (c.getPerBienesB() == null && c.getPerPropiedadBId() == null)
            throw new IllegalArgumentException("Permuta: indicá qué entrega la Parte B (elegí una propiedad cargada o describí el bien).");

        java.math.BigDecimal dif = c.getPerDiferenciaMonto();
        if (dif == null || dif.signum() == 0) {
            // Sin diferencia en efectivo: nadie abona nada
            c.setPerDiferenciaMonto(java.math.BigDecimal.ZERO);
            c.setPerQuienPagaDiferencia(null);
        } else {
            if (c.getPerDiferenciaMoneda() == null)
                throw new IllegalArgumentException("Permuta: indicá la moneda de la diferencia en efectivo.");
            if (!"Parte A".equals(c.getPerQuienPagaDiferencia()) && !"Parte B".equals(c.getPerQuienPagaDiferencia()))
                throw new IllegalArgumentException("Permuta: indicá quién abona la diferencia (Parte A o Parte B).");
        }
        // Para la permuta el "monto de la operación" es la diferencia en efectivo (puede ser cero)
        c.setMontoTotalOperacion(c.getPerDiferenciaMonto());
        if (c.getPerDiferenciaMoneda() != null) c.setMonedaOperacion(c.getPerDiferenciaMoneda());

        if (c.getPerPropiedadBId() != null) {
            Integer idA = c.getPropiedad() == null ? null : c.getPropiedad().getIdPropiedad();
            if (c.getPerPropiedadBId().equals(idA))
                throw new IllegalStateException("Permuta: la propiedad de la Parte B no puede ser la misma que la de la Parte A.");
            Propiedad b = propiedadRepo.findById(c.getPerPropiedadBId())
                .orElseThrow(() -> new IllegalArgumentException("Permuta: no existe la propiedad de la Parte B."));
            if (Boolean.TRUE.equals(b.getEsComplejo()) && propiedadRepo.countByIdComplejo(b.getIdPropiedad()) > 0)
                throw new IllegalStateException("Permuta: '" + b.getTitulo() + "' es un complejo; elegí la unidad puntual.");
            Integer duenioB = b.getPropietarioActual() == null ? null : b.getPropietarioActual().getIdPersona();
            Integer parteB = c.getCompradorInquilino() == null ? null : c.getCompradorInquilino().getIdPersona();
            if (duenioB == null || !duenioB.equals(parteB))
                throw new IllegalStateException("Permuta: '" + b.getTitulo() + "' no figura a nombre de la Parte B. Elegí otra propiedad o describí el bien a mano.");
        }
    }

    /** La propiedad de la Parte B tiene que estar libre para quedar comprometida en la permuta. */
    private Propiedad propiedadPermutaLibre(ContratoOperacion c) {
        if (c.getTipoContrato() != ContratoOperacion.TipoContrato.Permuta || c.getPerPropiedadBId() == null) return null;
        Propiedad b = propiedadRepo.findById(c.getPerPropiedadBId())
            .orElseThrow(() -> new IllegalArgumentException("Permuta: no existe la propiedad de la Parte B."));
        if (b.getEstadoPropiedad() != null && b.getEstadoPropiedad() != Propiedad.EstadoPropiedad.Disponible)
            throw new IllegalStateException("Permuta: '" + b.getTitulo() + "' no está disponible (estado actual: " + b.getEstadoPropiedad() + ").");
        return b;
    }

    /** Controles sobre las personas y la documentación (BCRA, inhibición, legajo). */
    private void validarPartes(ContratoOperacion c, Integer idPropiedad, boolean revisarLegajo) {
        Integer idInquilino = c.getCompradorInquilino().getIdPersona();
        Integer idVendedor = c.getVendedorPropietario().getIdPersona();
        if (idInquilino.equals(idVendedor))
            throw new IllegalStateException("El vendedor/propietario y el comprador/inquilino no pueden ser la misma persona.");
        // Un huésped de alquiler temporario (turista que paga la estadía) no pasa por el control crediticio
        if (!esTemporario(c)) {
            auditoria.validarEstadoBcra(idInquilino);
            auditoria.validarNoInhibido(idInquilino);
        }
        auditoria.validarNoInhibido(idVendedor);
        // Un alquiler temporario no exige el legajo de escritura / informe de dominio
        if (revisarLegajo && !esTemporario(c)) auditoria.validarLegajosPropiedad(idPropiedad);
        if (revisarLegajo && c.getTipoContrato() == ContratoOperacion.TipoContrato.Permuta && c.getPerPropiedadBId() != null)
            auditoria.validarLegajosPropiedad(c.getPerPropiedadBId());
    }

    private Propiedad propiedadLibre(Integer idPropiedad) {
        Propiedad prop = propiedadRepo.findById(idPropiedad)
            .orElseThrow(() -> new IllegalArgumentException("Propiedad no encontrada: " + idPropiedad));
        if (Boolean.TRUE.equals(prop.getEsComplejo()) && propiedadRepo.countByIdComplejo(idPropiedad) > 0)
            throw new IllegalStateException(
                "'" + prop.getTitulo() + "' es un complejo con unidades. Elegí la unidad puntual que se alquila o vende.");
        if (prop.getEstadoPropiedad() != null && prop.getEstadoPropiedad() != Propiedad.EstadoPropiedad.Disponible)
            throw new IllegalStateException("La propiedad '" + prop.getTitulo()
                + "' no está disponible (estado actual: " + prop.getEstadoPropiedad() + ").");
        return prop;
    }

    /** Módulo 5: la propiedad cambia de estado cuando el contrato queda vigente. */
    /** Activa la operación sobre la propiedad. El alquiler temporario NO la bloquea (puede tener otras fechas libres). */
    private void bloquearOperacion(Propiedad prop, ContratoOperacion c) {
        if (esTemporario(c)) return;
        validarSinEstadiasPendientes(c, prop);
        bloquearPropiedad(prop, c.getTipoContrato());
        bloquearPermutaB(c);
    }

    private void bloquearPermutaB(ContratoOperacion c) {
        Propiedad b = propiedadPermutaLibre(c);
        if (b != null) { b.setEstadoPropiedad(Propiedad.EstadoPropiedad.Permutada); propiedadRepo.save(b); }
    }

    private void bloquearPropiedad(Propiedad prop, ContratoOperacion.TipoContrato tipo) {
        switch (tipo) {
            case Locacion    -> prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Alquilada);
            case Compraventa -> prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Reservada);
            case Permuta     -> prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Permutada);
        }
        propiedadRepo.save(prop);
    }

    // @Transactional: si algo falla en el medio, deshace todo (como un rollback)
    @Transactional
    public ContratoOperacion crearContrato(ContratoOperacion contrato) {

        if (contrato.getCompradorInquilino() == null)
            throw new IllegalArgumentException("El contrato debe tener un comprador/inquilino asociado.");
        if (contrato.getPropiedad() == null)
            throw new IllegalArgumentException("El contrato debe tener una propiedad asociada.");
        if (contrato.getTipoContrato() == null)
            throw new IllegalArgumentException("El contrato debe indicar el tipo (Locación, Compraventa o Permuta).");
        if (contrato.getCompradorInquilino().getIdPersona() == null || contrato.getPropiedad().getIdPropiedad() == null)
            throw new IllegalArgumentException("Propiedad y comprador/inquilino deben existir (falta el id).");

        Integer idPropiedad = contrato.getPropiedad().getIdPropiedad();
        Propiedad prop = propiedadLibre(idPropiedad);

        // El vendedor/locador SIEMPRE es el propietario actual de la ficha (no se acepta otro desde afuera)
        if (prop.getPropietarioActual() == null)
            throw new IllegalStateException("La propiedad '" + prop.getTitulo() + "' no tiene propietario cargado.");
        contrato.setVendedorPropietario(prop.getPropietarioActual());

        // Lo que decide el servidor, no el navegador
        contrato.setIdOperacion(null);
        contrato.setDocumentos(new java.util.ArrayList<>());
        if (contrato.getFechaAlta() == null) contrato.setFechaAlta(java.time.LocalDate.now());
        validarEstadoOperacion(contrato);
        boolean borrador = esPreparatorio(contrato);
        contrato.setEstadoContrato(borrador ? ContratoOperacion.EstadoContrato.Borrador : ContratoOperacion.EstadoContrato.Vigente);
        if (contrato.getEstadoOperacion() == null || contrato.getEstadoOperacion().isBlank())
            contrato.setEstadoOperacion(borrador ? "Borrador" : "Vigente");

        validarPartes(contrato, idPropiedad, true);
        validarCondiciones(contrato);

        ContratoOperacion guardado = contratoRepo.save(contrato);
        // Un borrador NO toca la propiedad: recién se bloquea cuando la operación se activa
        if (!borrador) bloquearOperacion(prop, contrato);
        return guardado;
    }

    /** Pasa un borrador a operación vigente: recién ahí la propiedad queda Alquilada / Reservada / Permutada. */
    @Transactional
    public ContratoOperacion activarContrato(Integer id) {
        ContratoOperacion c = contratoRepo.findById(id).orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));
        if (c.getEstadoContrato() != ContratoOperacion.EstadoContrato.Borrador)
            throw new IllegalStateException("Solo se puede activar una operación en borrador (estado actual: " + c.getEstadoContrato() + ").");
        Propiedad prop = propiedadLibre(c.getPropiedad().getIdPropiedad());
        validarPartes(c, prop.getIdPropiedad(), true);
        validarCondiciones(c);
        c.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
        if (esPreparatorio(c)) c.setEstadoOperacion("Vigente");
        bloquearOperacion(prop, c);
        return contratoRepo.save(c);
    }

    /** Corrige los datos de una operación en borrador o vigente. No cambia propiedad, propietario ni tipo. */
    @Transactional
    public ContratoOperacion actualizarContrato(Integer id, ContratoOperacion datos) {
        ContratoOperacion c = contratoRepo.findById(id).orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));
        if (c.getEstadoContrato() != ContratoOperacion.EstadoContrato.Borrador
                && c.getEstadoContrato() != ContratoOperacion.EstadoContrato.Vigente)
            throw new IllegalStateException("Una operación " + c.getEstadoContrato() + " ya no se puede editar.");
        if (datos.getCompradorInquilino() == null || datos.getCompradorInquilino().getIdPersona() == null)
            throw new IllegalArgumentException("El contrato debe tener un comprador/inquilino asociado.");

        validarEstadoOperacion(datos);
        Integer compradorAnterior = c.getCompradorInquilino().getIdPersona();
        java.time.LocalDate inicioAnterior = c.getFechaInicio();
        boolean conCobros = c.getIdOperacion() != null && liquidacionRepo.findByContratoIdOperacion(c.getIdOperacion()).stream()
            .anyMatch(l -> !Boolean.TRUE.equals(l.getAnulada()));
        if (conCobros) {
            // Con cobros registrados no se puede cambiar de inquilino ni mover el inicio: los recibos quedarían incoherentes
            if (!datos.getCompradorInquilino().getIdPersona().equals(compradorAnterior))
                throw new IllegalStateException("Este contrato ya tiene cobros registrados: no se puede cambiar el inquilino. Rescindilo y creá uno nuevo.");
            java.time.LocalDate inicioNuevo = datos.getAlqFechaInicio() != null ? datos.getAlqFechaInicio() : datos.getFechaInicio();
            if (inicioAnterior != null && inicioNuevo != null && !inicioAnterior.equals(inicioNuevo))
                throw new IllegalStateException("Este contrato ya tiene cobros registrados: no se puede cambiar la fecha de inicio.");
        }
        Integer permutaBAnterior = c.getPerPropiedadBId();
        String estadoOpAnterior = c.getEstadoOperacion();
        boolean eraBorrador = c.getEstadoContrato() == ContratoOperacion.EstadoContrato.Borrador;

        org.springframework.beans.BeanUtils.copyProperties(datos, c,
            "idOperacion", "propiedad", "vendedorPropietario", "tipoContrato", "estadoContrato", "documentos", "usuarioResponsable");

        // Con la permuta vigente, la propiedad de la Parte B ya quedó comprometida: no se cambia
        if (!eraBorrador) c.setPerPropiedadBId(permutaBAnterior);
        if (datos.getEstadoOperacion() == null || datos.getEstadoOperacion().isBlank()) c.setEstadoOperacion(estadoOpAnterior);
        // Una operación vigente no vuelve a "borrador"
        if (!eraBorrador && esPreparatorio(c)) c.setEstadoOperacion(estadoOpAnterior);

        boolean cambioComprador = !c.getCompradorInquilino().getIdPersona().equals(compradorAnterior);
        if (cambioComprador) {
            validarPartes(c, c.getPropiedad().getIdPropiedad(), false);
        } else if (c.getCompradorInquilino().getIdPersona().equals(c.getVendedorPropietario().getIdPersona())) {
            throw new IllegalStateException("El vendedor/propietario y el comprador/inquilino no pueden ser la misma persona.");
        }
        validarCondiciones(c);

        // Un borrador marcado como "Firmada" / "Vigente" se activa
        if (eraBorrador && !esPreparatorio(c)) {
            Propiedad prop = propiedadLibre(c.getPropiedad().getIdPropiedad());
            validarPartes(c, prop.getIdPropiedad(), true);
            c.setEstadoContrato(ContratoOperacion.EstadoContrato.Vigente);
            bloquearOperacion(prop, c);
        }
        return contratoRepo.save(c);
    }

    /** Cierra un alquiler que terminó normalmente (la propiedad vuelve a estar Disponible). */
    @Transactional
    public ContratoOperacion finalizarContrato(Integer id) {
        ContratoOperacion c = contratoRepo.findById(id).orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));
        if (c.getTipoContrato() != ContratoOperacion.TipoContrato.Locacion)
            throw new IllegalStateException("Solo los alquileres se finalizan así (las ventas se cierran con \"Cerrar venta\").");
        if (c.getEstadoContrato() != ContratoOperacion.EstadoContrato.Vigente)
            throw new IllegalStateException("Solo se puede finalizar un contrato vigente (estado actual: " + c.getEstadoContrato() + ").");
        return finalizarYLiberar(c);
    }

    private ContratoOperacion finalizarYLiberar(ContratoOperacion c) {
        c.setEstadoContrato(ContratoOperacion.EstadoContrato.Finalizado);
        Propiedad prop = c.getPropiedad();
        if (!esTemporario(c) && prop.getEstadoPropiedad() == Propiedad.EstadoPropiedad.Alquilada) {
            prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
            propiedadRepo.save(prop);
        }
        return contratoRepo.save(c);
    }

    /** Los alquileres temporarios cuyo check-out ya pasó se finalizan solos y la propiedad vuelve a Disponible. */
    @Transactional
    public int finalizarTemporariosVencidos() {
        java.time.LocalDate hoy = java.time.LocalDate.now();
        int n = 0;
        for (ContratoOperacion c : contratoRepo.findAll()) {
            if (c.getEstadoContrato() == ContratoOperacion.EstadoContrato.Vigente && esTemporario(c)
                    && c.getFechaFin() != null && c.getFechaFin().isBefore(hoy)) {
                finalizarYLiberar(c);
                n++;
            }
        }
        return n;
    }

    @Transactional
    public LiquidacionMensual registrarLiquidacion(LiquidacionMensual liq) {

        if (liq.getContrato() == null || liq.getContrato().getIdOperacion() == null) {
            throw new IllegalArgumentException("La liquidación debe indicar el contrato.");
        }
        ContratoOperacion contrato = contratoRepo
            .findById(liq.getContrato().getIdOperacion())
            .orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));

        if (contrato.getTipoContrato() != ContratoOperacion.TipoContrato.Locacion) {
            throw new IllegalStateException("Solo los contratos de Locación generan liquidaciones mensuales.");
        }
        // El saldo de una estadía puede cobrarse después del check-out (cuando el contrato ya figura Finalizado)
        boolean cobroEstadiaTardio = esTemporario(contrato) && contrato.getEstadoContrato() == ContratoOperacion.EstadoContrato.Finalizado
            && liq.getConcepto() != null && ("Seña de estadía".equals(liq.getConcepto().trim()) || "Saldo de estadía".equals(liq.getConcepto().trim()));
        if (contrato.getEstadoContrato() != ContratoOperacion.EstadoContrato.Vigente && !cobroEstadiaTardio) {
            throw new IllegalStateException("El contrato no está vigente (estado: " + contrato.getEstadoContrato() + ").");
        }
        if (liq.getFechaVencimiento() == null) {
            throw new IllegalArgumentException("La fecha de vencimiento es obligatoria.");
        }
        if (liq.getMesAnoLiquidado() == null || liq.getMesAnoLiquidado().isBlank()) {
            throw new IllegalArgumentException("El mes liquidado es obligatorio (ej: 2026-09).");
        }
        if (liq.getMontoAlquilerBase() == null || liq.getMontoAlquilerBase().signum() <= 0) {
            throw new IllegalArgumentException("El monto base del alquiler debe ser mayor a cero.");
        }
        // Concepto del cobro: "Alquiler" (el del mes, que puede pagarse en partes) u otro concepto suelto (indemnización, etc.)
        String concepto = liq.getConcepto() == null || liq.getConcepto().isBlank() ? "Alquiler" : liq.getConcepto().trim();
        if (concepto.length() > 80) throw new IllegalArgumentException("El concepto del cobro admite hasta 80 caracteres.");
        boolean esAlquiler = "Alquiler".equals(concepto);
        liq.setConcepto(concepto);
        if (!esAlquiler) {
            // Un concepto que no es el alquiler del mes no tiene vencimiento ni mora
            if (liq.getFechaPagoReal() == null) throw new IllegalArgumentException("Indicá la fecha de pago.");
            liq.setFechaVencimiento(liq.getFechaPagoReal());
        }

        List<LiquidacionMensual> previas = liquidacionRepo.findByContratoIdOperacion(contrato.getIdOperacion()).stream()
            .filter(l -> !Boolean.TRUE.equals(l.getAnulada())).toList();
        // El mismo cobro dos veces (doble clic): mismo concepto, mes, importe y fecha de pago
        boolean repetido = previas.stream().anyMatch(l ->
            concepto.equals(l.getConcepto() == null ? "Alquiler" : l.getConcepto())
            && liq.getMesAnoLiquidado().equals(l.getMesAnoLiquidado())
            && l.getMontoAlquilerBase() != null && l.getMontoAlquilerBase().compareTo(liq.getMontoAlquilerBase()) == 0
            && Objects.equals(l.getFechaPagoReal(), liq.getFechaPagoReal()));
        if (repetido) {
            throw new IllegalStateException("Ya existe un cobro idéntico (" + concepto + ", " + liq.getMesAnoLiquidado() + ") para este contrato.");
        }
        if (esAlquiler) {
            // El alquiler del mes puede cobrarse en varios pagos, pero nunca más de lo que corresponde
            BigDecimal esperado = liq.getMontoAlquilerMes() != null ? liq.getMontoAlquilerMes() : liq.getMontoAlquilerBase();
            BigDecimal yaCobrado = previas.stream()
                .filter(l -> l.getConcepto() == null || "Alquiler".equals(l.getConcepto()))
                .filter(l -> liq.getMesAnoLiquidado().equals(l.getMesAnoLiquidado()))
                .map(l -> l.getMontoAlquilerBase() == null ? BigDecimal.ZERO : l.getMontoAlquilerBase())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (yaCobrado.compareTo(esperado) >= 0)
                throw new IllegalStateException("El alquiler de " + liq.getMesAnoLiquidado() + " ya está cobrado por completo para este contrato.");
            BigDecimal saldo = esperado.subtract(yaCobrado).subtract(liq.getMontoAlquilerBase());
            if (saldo.signum() < 0)
                throw new IllegalStateException("El importe supera lo que falta cobrar del alquiler de " + liq.getMesAnoLiquidado()
                    + " (pendiente: " + esperado.subtract(yaCobrado).toPlainString() + ").");
            liq.setMontoAlquilerMes(esperado);
            liq.setSaldoAlquilerPendiente(saldo);
            liq.setPagoParcial(liq.getMontoAlquilerBase().compareTo(esperado) < 0);
        } else {
            liq.setMontoAlquilerMes(null);
            liq.setSaldoAlquilerPendiente(null);
            liq.setPagoParcial(false);
        }

        liq.setContrato(contrato);
        if (liq.getPorcentajeHonorariosAdministracion() == null)
            liq.setPorcentajeHonorariosAdministracion(contrato.getAlqPorcentajeAdministracion() != null ? contrato.getAlqPorcentajeAdministracion() : new BigDecimal("10.00"));
        BigDecimal pct = liq.getPorcentajeHonorariosAdministracion();
        if (pct.signum() < 0 || pct.compareTo(new BigDecimal("100")) > 0)
            throw new IllegalArgumentException("El porcentaje de honorarios de administración debe estar entre 0 y 100.");
        if (liq.getFechaPagoReal() != null && liq.getFechaPagoReal().isAfter(java.time.LocalDate.now().plusDays(1)))
            throw new IllegalArgumentException("La fecha de pago no puede ser futura.");
        liq.setMoneda(monedaDe(contrato));
        liq.setAnulada(false);
        calcularMontos(liq, contrato);

        return liquidacionRepo.save(liq);
    }

    private String monedaDe(ContratoOperacion c) {
        if (esTemporario(c) && c.getTempMoneda() != null) return c.getTempMoneda().name();
        ContratoOperacion.Moneda m = c.getAlqCanonMoneda() != null ? c.getAlqCanonMoneda() : c.getMonedaOperacion();
        return m == null ? "ARS" : m.name();
    }

    /**
     * Calcula mora, total cobrado, honorarios y neto a rendir.
     * - Mora = días de atraso × tasa diaria del contrato × alquiler base. Es del PROPIETARIO (accesorio del canon);
     *   solo se la queda la inmobiliaria si el contrato de administración lo autoriza expresamente (moraParaInmobiliaria).
     * - Honorarios de administración = % sobre el alquiler base (nunca sobre la mora).
     * - Co-corretaje: la comisión se divide a la mitad (criterio previo del sistema).
     */
    public void calcularMontos(LiquidacionMensual liq, ContratoOperacion contrato) {
        BigDecimal tasaMora = contrato.getInterestMoraDiario() != null ? contrato.getInterestMoraDiario() : BigDecimal.ZERO;
        BigDecimal mora = BigDecimal.ZERO;
        int diasAtraso = 0;
        if (liq.getFechaPagoReal() != null && liq.getFechaPagoReal().isAfter(liq.getFechaVencimiento())) {
            diasAtraso = (int) java.time.temporal.ChronoUnit.DAYS.between(liq.getFechaVencimiento(), liq.getFechaPagoReal());
            mora = new BigDecimal(diasAtraso).multiply(tasaMora).multiply(liq.getMontoAlquilerBase()).setScale(2, RoundingMode.HALF_UP);
        }
        liq.setDiasAtraso(diasAtraso);
        liq.setMontoMoraCalculado(mora);
        BigDecimal servicios = liq.getMontoServicios() != null ? liq.getMontoServicios() : BigDecimal.ZERO;
        liq.setMontoServicios(servicios);
        BigDecimal total = liq.getMontoAlquilerBase().add(mora);          // lo que corresponde al propietario (alquiler + mora)
        liq.setTotalAbonadoInquilino(total.add(servicios));              // lo que paga el inquilino (incluye servicios y expensas)

        boolean esCoCorretaje = Boolean.TRUE.equals(contrato.getEsCoCorretaje());
        liq.setEsCoCorretajeMensual(esCoCorretaje);
        BigDecimal comision = liq.getMontoAlquilerBase().multiply(liq.getPorcentajeHonorariosAdministracion())
            .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        BigDecimal comisionRetenida = esCoCorretaje ? comision.divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP) : comision;
        if (Boolean.TRUE.equals(liq.getMoraParaInmobiliaria())) comisionRetenida = comisionRetenida.add(mora);
        liq.setMontoComisionInmobiliaria(comisionRetenida);
        liq.setMontoNetoARendir(total.subtract(comisionRetenida));
    }

    // Módulo 5: cierre de venta — transfiere la propiedad al comprador
    @Transactional
    public void cerrarVenta(Integer idOperacion) {
        ContratoOperacion contrato = contratoRepo.findById(idOperacion)
            .orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));
        if (contrato.getTipoContrato() != ContratoOperacion.TipoContrato.Compraventa) {
            throw new IllegalStateException("El contrato no es una Compraventa.");
        }
        if (contrato.getEstadoContrato() != ContratoOperacion.EstadoContrato.Vigente) {
            throw new IllegalStateException("Solo se puede cerrar una venta vigente (estado actual: "
                + contrato.getEstadoContrato() + ").");
        }
        Propiedad prop = contrato.getPropiedad();
        prop.setIdPropietarioActualId(contrato.getCompradorInquilino().getIdPersona());
        prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Vendida);
        propiedadRepo.save(prop);
        contrato.setEstadoContrato(ContratoOperacion.EstadoContrato.Finalizado);
        contratoRepo.save(contrato);
    }

    private void liberarPermutaB(ContratoOperacion c) {
        if (c.getTipoContrato() != ContratoOperacion.TipoContrato.Permuta || c.getPerPropiedadBId() == null) return;
        propiedadRepo.findById(c.getPerPropiedadBId()).ifPresent(b -> {
            if (b.getEstadoPropiedad() == Propiedad.EstadoPropiedad.Permutada) {
                b.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
                propiedadRepo.save(b);
            }
        });
    }

    /** Cierre de una permuta: cada propiedad pasa a nombre de la otra parte y la operación queda finalizada. */
    @Transactional
    public void cerrarPermuta(Integer idOperacion) {
        ContratoOperacion c = contratoRepo.findById(idOperacion)
            .orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));
        if (c.getTipoContrato() != ContratoOperacion.TipoContrato.Permuta)
            throw new IllegalStateException("El contrato no es una Permuta.");
        if (c.getEstadoContrato() != ContratoOperacion.EstadoContrato.Vigente)
            throw new IllegalStateException("Solo se puede cerrar una permuta vigente (estado actual: " + c.getEstadoContrato() + ").");
        Integer parteA = c.getVendedorPropietario().getIdPersona();
        Integer parteB = c.getCompradorInquilino().getIdPersona();
        Propiedad a = c.getPropiedad();
        a.setIdPropietarioActualId(parteB);
        a.setEstadoPropiedad(Propiedad.EstadoPropiedad.Permutada);
        propiedadRepo.save(a);
        if (c.getPerPropiedadBId() != null) {
            Propiedad b = propiedadRepo.findById(c.getPerPropiedadBId())
                .orElseThrow(() -> new IllegalArgumentException("Permuta: no existe la propiedad de la Parte B."));
            b.setIdPropietarioActualId(parteA);
            b.setEstadoPropiedad(Propiedad.EstadoPropiedad.Permutada);
            propiedadRepo.save(b);
        }
        c.setEstadoContrato(ContratoOperacion.EstadoContrato.Finalizado);
        contratoRepo.save(c);
    }

    // Módulo 6: rescindir sin borrar — solo cambia el estado
    @Transactional
    public ContratoOperacion rescindirContrato(Integer idOperacion) {
        ContratoOperacion contrato = contratoRepo.findById(idOperacion)
            .orElseThrow(() -> new IllegalArgumentException("Contrato no encontrado."));
        boolean eraBorrador = contrato.getEstadoContrato() == ContratoOperacion.EstadoContrato.Borrador;
        if (!eraBorrador && contrato.getEstadoContrato() != ContratoOperacion.EstadoContrato.Vigente) {
            throw new IllegalStateException("Solo se puede rescindir un contrato vigente o en borrador (estado actual: "
                + contrato.getEstadoContrato() + ").");
        }
        contrato.setEstadoContrato(ContratoOperacion.EstadoContrato.Rescindido);
        // Un borrador nunca bloqueó la propiedad: no hay nada que liberar
        if (!eraBorrador && !esTemporario(contrato)) {
            Propiedad prop = contrato.getPropiedad();
            prop.setEstadoPropiedad(Propiedad.EstadoPropiedad.Disponible);
            propiedadRepo.save(prop);
            liberarPermutaB(contrato);
        }
        return contratoRepo.save(contrato);
    }

    /**
     * Fechas ocupadas por estadías temporarias de una propiedad (solo las que todavía no terminaron), ordenadas.
     * Las noches ocupadas van de "desde" (check-in) a "hasta" (check-out) sin incluir el día de salida.
     * Sin datos personales. "incluirBorradores" agrega las estadías todavía no confirmadas, marcadas como "Borrador".
     */
    public List<java.util.Map<String, Object>> ocupacionTemporaria(Integer idPropiedad, boolean incluirBorradores, Integer excluirOperacion) {
        java.time.LocalDate hoy = java.time.LocalDate.now();
        List<java.util.Map<String, Object>> out = new java.util.ArrayList<>();
        contratoRepo.findByPropiedadIdPropiedad(idPropiedad).stream()
            .filter(ContratoService::esTemporario)
            .filter(c -> c.getTempCheckIn() != null && c.getTempCheckOut() != null && !c.getTempCheckOut().isBefore(hoy))
            .filter(c -> excluirOperacion == null || !excluirOperacion.equals(c.getIdOperacion()))
            .filter(c -> c.getEstadoContrato() == ContratoOperacion.EstadoContrato.Vigente
                      || (incluirBorradores && c.getEstadoContrato() == ContratoOperacion.EstadoContrato.Borrador))
            .sorted(java.util.Comparator.comparing(ContratoOperacion::getTempCheckIn))
            .forEach(c -> {
                java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                m.put("desde", c.getTempCheckIn().toString());
                m.put("hasta", c.getTempCheckOut().toString());
                m.put("estado", c.getEstadoContrato() == ContratoOperacion.EstadoContrato.Vigente ? "Confirmada" : "Borrador");
                if (incluirBorradores) m.put("idOperacion", c.getIdOperacion());
                out.add(m);
            });
        return out;
    }

    /** Solo lectura: el cierre de temporarios vencidos lo hace la tarea diaria (ver más abajo), no una consulta GET. */
    @Transactional(readOnly = true)
    public List<ContratoOperacion> listarTodos() {
        return contratoRepo.findAll();
    }

    /** Todos los días a las 00:10 y al arrancar el servidor: finaliza los temporarios cuyo check-out ya pasó. */
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 10 0 * * *")
    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    @Transactional
    public void tareaDiaria() {
        try { finalizarTemporariosVencidos(); }
        catch (RuntimeException e) { org.slf4j.LoggerFactory.getLogger(ContratoService.class).warn("No se pudo cerrar temporarios vencidos: {}", e.getMessage()); }
    }
    public Optional<ContratoOperacion> buscarPorId(Integer id) { return contratoRepo.findById(id); }
    public List<LiquidacionMensual> listarLiquidaciones(Integer id) {
        return liquidacionRepo.findByContratoIdOperacion(id);
    }
}