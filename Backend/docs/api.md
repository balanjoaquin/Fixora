# Documentación General de API — FIXORA (`/api/v1`)

## Autenticación y cuenta
- `POST /api/v1/auth/register` — Registro de `client` o `technician` (envía correo de verificación).
- `POST /api/v1/auth/login` — Inicio de sesión con token Sanctum.
- `POST /api/v1/auth/logout` — Cierre de sesión (revoca token actual).
- `GET /api/v1/auth/me` — Datos de la cuenta autenticada.
- `GET /api/v1/auth/email/verify/{id}/{hash}` — Verificación de correo por enlace firmado.
- `POST /api/v1/auth/email/resend` — Reenvío de correo de verificación.
- `POST /api/v1/auth/forgot-password` — Solicitud de enlace de recuperación de contraseña.
- `POST /api/v1/auth/reset-password` — Restablecimiento de contraseña y revocación de sesiones.
- `PUT /api/v1/account` y `PUT /api/v1/account/password` — Actualización de cuenta y contraseña.

## Catálogo y directorio público
- `GET /api/v1/specialties` — Catálogo de especialidades activas.
- `GET /api/v1/technicians` — Búsqueda pública de técnicos visibles por especialidad, zona, distancia y disponibilidad.
- `GET /api/v1/technicians/{id}` — Perfil público del técnico con coordenadas redondeadas.
- `GET /api/v1/technicians/{id}/reviews` — Reseñas públicas y distribución de calificaciones.

## Gestión del técnico
- `GET|PUT /api/v1/technician/profile` — Consulta y edición del perfil técnico.
- `PUT /api/v1/technician/specialties` — Asignación de especialidades.
- `GET|POST /api/v1/technician/services` y `PUT|DELETE /api/v1/technician/services/{service}` — Catálogo de servicios del técnico.
- `GET|PUT /api/v1/technician/availability` — Franjas horarias semanales.
- `GET /api/v1/technician/reviews` — Reseñas recibidas por el técnico.

## Solicitudes de servicio y seguimiento
- `GET /api/v1/requests` — Listado paginado de solicitudes del usuario.
- `POST /api/v1/requests` — Creación de solicitud (requiere correo verificado).
- `GET /api/v1/requests/{serviceRequest}` — Detalle y línea de eventos inmutables.
- `POST /api/v1/requests/{serviceRequest}/accept` — Aceptar solicitud (`pending -> accepted`).
- `POST /api/v1/requests/{serviceRequest}/reject` — Rechazar solicitud (`pending -> rejected`).
- `POST /api/v1/requests/{serviceRequest}/start` — Iniciar servicio (`accepted -> in_progress`).
- `POST /api/v1/requests/{serviceRequest}/complete` — Completar servicio (`in_progress -> completed`).
- `POST /api/v1/requests/{serviceRequest}/cancel` — Cancelar solicitud.

## Reseñas y notificaciones
- `POST /api/v1/requests/{serviceRequest}/review` — Calificar solicitud completada.
- `POST /api/v1/reviews/{review}/reply` — Respuesta única del técnico.
- `GET /api/v1/notifications` — Listado paginado de notificaciones (`unread=true` opcional).
- `GET /api/v1/notifications/unread-count` — Contador de notificaciones no leídas.
- `POST /api/v1/notifications/{id}/read` — Marcar una notificación como leída.
- `POST /api/v1/notifications/read-all` — Marcar todas como leídas.

Detalle completo de contratos del Bloque B7 en `docs/api-b7.md`.