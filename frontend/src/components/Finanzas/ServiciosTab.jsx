import ProrrateoServicios from "./ProrrateoServicios";

/** Carga de servicios / prorrateo: lo cargado se suma solo a la próxima cobranza de cada inquilino. */
export default function ServiciosTab() {
  return (
    <div className="card tab-content active">
      <div className="card-header">
        <span className="card-title"><i className="fa-solid fa-bolt"></i> Carga y Distribución de Servicios</span>
      </div>
      <ProrrateoServicios />
    </div>
  );
}
