# Inmobiliaria Del Castillo — Sistema de gestión

Aplicación full-stack para gestión inmobiliaria: clientes, propiedades, contratos
(venta, permuta, alquiler anual y temporario), liquidaciones con mora, finanzas y
rendiciones a propietarios, más un mapa público de propiedades con favoritos.

- **Backend:** Java 21 · Spring Boot 4 · Spring Security (JWT) · JPA · PostgreSQL
- **Frontend:** React 19 · Vite · Bootstrap · Leaflet

## Puesta en marcha

### 1. Base de datos
Crear una base PostgreSQL llamada `inmobiliariadelcastillo`.

### 2. Configuración local del backend
Copiá `backend/src/main/resources/application-local.properties.example` como
`application-local.properties` (esa copia **no se sube a git**) y completá:

```properties
spring.datasource.username=tu_usuario
spring.datasource.password=tu_clave
jwt.secret=una_cadena_aleatoria_de_48_caracteres_o_mas   # openssl rand -base64 48
# app.seed.admin-password=UnaClaveFuerte123              # opcional
```

En producción se usan variables de entorno en lugar de ese archivo:
`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`,
`SEED_ENABLED=false`, `ADMIN_INITIAL_PASSWORD`.

### 3. Backend
```bash
cd backend
./mvnw test                    # corre los tests
./mvnw spring-boot:run         # http://localhost:8080
```
En el **primer arranque** con base vacía se crea el usuario `admin` y datos de ejemplo.
Si no definiste `ADMIN_INITIAL_PASSWORD`, la contraseña inicial aparece **una sola vez** en el log.

### 4. Frontend
```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

### 5. Publicar en un servidor
- **Frontend:** antes de `npm run build`, creá `frontend/.env.production` (hay un modelo en `.env.example`) con
  `VITE_API_URL=https://tu-api.com` (la dirección pública del backend, sin `/api`).
- **Backend:** definí `CORS_ALLOWED_ORIGINS=https://tu-sitio.com` (el CORS se configura una sola vez, en `SecurityConfig`).
- El límite de intentos de login usa la IP de la conexión: si el backend queda detrás de un proxy (nginx, etc.),
  configurá el proxy para que Spring reciba la IP real (`server.forward-headers-strategy=native`).
- Las fotos y PDF subidos viven en `backend/uploads/` (no van a git): incluilos en tus respaldos.

## Sesión y seguridad

- El token de sesión (JWT, librería jjwt 0.12) viaja en una **cookie HttpOnly** (`inmobiliaria_sesion`): el JavaScript de la página no puede leerlo, así que un ataque XSS no puede robarlo. El navegador solo guarda una marca "hay sesión" que no es un secreto.
- Defensa CSRF: los pedidos que modifican datos con cookie deben llevar el header `X-Requested-With` y venir de un origen listado en `CORS_ALLOWED_ORIGINS`. El frontend ya lo hace solo.
- `COOKIE_SECURE` (por defecto `true`, exige HTTPS) y `COOKIE_SAMESITE` (`Lax`; usar `None` si el frontend y la API están en dominios distintos). En desarrollo local, `application-local.properties` ya pone `app.cookie.secure=false`.
- `POST /api/auth/logout` borra la cookie. Las herramientas que no son el navegador pueden seguir usando `Authorization: Bearer <token>`, pero el login ya no devuelve el token en el cuerpo.

## Roles y permisos

| Rol | Puede |
|---|---|
| Sin login | Ver el mapa público (`/api/propiedades/publicas`, sin datos del propietario), registrarse e iniciar sesión |
| `CLIENTE` | Lo anterior + sus propios favoritos |
| `AGENTE` | Todo el backoffice: personas, propiedades, contratos, finanzas, rendiciones, documentos |
| `ADMIN` | Todo lo del agente + crear usuarios AGENTE/ADMIN (`POST /api/auth/register` con `rol`) y administrar usuarios Firebase |

`/api/auth/register` **siempre** crea clientes salvo que quien llama sea un ADMIN autenticado.

## Reglas de negocio principales

- Antes de crear un contrato se validan: estado BCRA (solo situación 1), inhibición
  judicial (inquilino/comprador **y** propietario), legajo de la propiedad (escritura e informe de dominio)
  y que la propiedad esté **Disponible**.
- Locaciones anuales en pesos exigen índice (ICL/IPC) y frecuencia de ajuste. No aplica a ventas,
  permutas, alquileres temporarios ni contratos en USD. *(Verificá este criterio legal con tu docente.)*
- Compraventa deja la propiedad **Reservada**; al cerrar la venta pasa a **Vendida** y cambia el propietario.
  Alquiler → **Alquilada**. Rescindir devuelve la propiedad a **Disponible**.
  Solo se puede cerrar/rescindir un contrato **Vigente**.
- Liquidación mensual: `mora = días de atraso × interés diario × canon base`; la comisión se calcula sobre el canon
  (se divide a la mitad si hay co-corretaje). Sin fecha de pago real no hay mora. No se puede liquidar dos veces el mismo mes.

## Pendientes conocidos

- Generación de PDF (rendición / recibo): los endpoints responden 501 hasta agregar iText.
- `FacturadorService` tiene cálculos de saldo marcados como TODO.
- Borrado físico (no lógico) en propiedades, movimientos y rendiciones.
- Firebase es opcional y está desactivado por defecto.
