# API FIXORA — Bloque B5: Calificaciones y Comentarios (RF-11, RF-12)

## Convenciones generales
- **Prefijo base:** `/api/v1`
- **Formato:** `Accept: application/json` y `Content-Type: application/json`.
- **Timestamps:** Persistidos en **UTC** y serializados en formato ISO-8601 (`YYYY-MM-DDTHH:MM:SS+00:00`).
- **Inmutabilidad:**
  - Las reseñas creadas por los clientes **no se editan ni se eliminan** en esta versión (no existen rutas `PUT`, `PATCH` ni `DELETE` sobre `/api/v1/reviews/{id}`).
  - La respuesta pública del técnico (`technician_reply`) también es única e **inmutable** una vez publicada.
- **Privacidad:**
  - El nombre del cliente siempre se abrevia al primer nombre más la inicial del primer apellido (por ejemplo, `"Ana P."`, o la palabra única si el usuario registró un solo nombre).
  - Nunca se exponen `email`, `phone`, `user_id`, `client_id`, `service_request_id`, título ni descripción de la solicitud, dirección exacta ni coordenadas.

---

## Campos reservados para administración (no modificables en esta aplicación)
Los siguientes campos de la tabla `reviews` existen en el esquema de base de datos, pero **no se escriben ni se modifican** desde ningún endpoint de clientes ni técnicos en esta aplicación; quedan reservados exclusivamente para el módulo administrativo posterior:
- `is_hidden`: bandera de visibilidad por moderación (solo se lee para excluir reseñas ocultas del cálculo público y mostrar su estado al técnico dueño en `/api/v1/technician/reviews`).
- `moderated_by`: identificador del administrador que ocultó o restauró la reseña.
- `moderation_reason`: motivo registrado por administración.
- `moderated_at`: fecha y hora UTC de la acción de moderación.

---

## Endpoints

### 1. Calificar y comentar un servicio completado (Cliente)
- **Método y ruta:** `POST /api/v1/requests/{id}/review`
- **Autenticación y rol:** `Authorization: Bearer <token>` con rol `client` y cuenta `active`.
- **Rate limiting:** Máximo **20 acciones de reseña o respuesta por hora** por usuario (`429` al exceder).
- **Reglas de negocio:**
  - Solo el cliente dueño de la solicitud puede calificarla; cualquier otro cliente recibe `404` y un técnico recibe `403`.
  - La solicitud debe encontrarse en `status = completed`; en cualquier otro estado responde `409` con `"Solo se puede calificar un servicio completado"`.
  - Solo se permite una reseña por solicitud (`409` si ya existe, incluyendo protección ante envíos concurrentes sobre `UNIQUE(service_request_id)`).
  - La inserción de la reseña y el recálculo de `rating_avg` y `rating_count` en `technician_profiles` ocurren dentro de la misma transacción (`DB::transaction` + `lockForUpdate`).
- **Cuerpo JSON:**
```json
{
  "rating": 5,
  "comment": "Excelente servicio, puntual y dejó el tablero eléctrico funcionando perfectamente."
}