# API FIXORA — Bloque B4: Solicitudes de Servicio y Seguimiento (RF-09, RF-10, RNF-03)

## Convenciones generales y manejo de zona horaria
- **Prefijo base:** `/api/v1`
- **Autenticación:** Todos los endpoints de este bloque requieren `Authorization: Bearer <token>` (Laravel Sanctum) y usuario en estado `active`.
- **Zona horaria:**
  - Todos los timestamps almacenados en MySQL (`created_at`, `expires_at`, `accepted_at`, `started_at`, `completed_at`, `closed_at`) se persisten en **UTC** y se serializan en formato ISO-8601 (`YYYY-MM-DDTHH:MM:SS+00:00`).
  - Los campos `preferred_date` (`YYYY-MM-DD`) y `preferred_start` (`HH:MM`) representan **fecha y hora local** en `config('fixora.timezone')` (`America/Mexico_City`). Toda validación contra "ahora" y contra las franjas de disponibilidad del técnico se evalúa convirtiendo explícitamente a dicha zona horaria.

---

## Reglas de privacidad (RN-09)
- **Siempre visibles para cliente y técnico participantes:** `id`, `status`, `title`, `description`, `approx_zone`, `specialty`, `service`, `preferred_date`, `preferred_start`, `expires_at`, `accepted_at`, `started_at`, `completed_at`, `closed_at`, `closing_reason`, `available_actions` y `events`.
- **Campos sensibles (`address_line`, `latitude`, `longitude`, `client.phone`, `technician.phone`):**
  - Se **omiten** completamente de la respuesta JSON cuando `status` es `pending`, `rejected`, `cancelled` o `expired`.
  - Se **incluyen** únicamente cuando `status` es `accepted`, `in_progress` o `completed`.
- **Prohibición absoluta:** Nunca se expone el correo electrónico (`email`) de la contraparte ni identificadores internos de usuario (`user_id`) del técnico.

---

## Endpoints

### 1. Crear solicitud de servicio (Cliente)
- **Método y ruta:** `POST /api/v1/requests`
- **Rol permitido:** `client` (límite: **10 solicitudes por hora** por usuario).
- **Cuerpo JSON:**
```json
{
  "technician_profile_id": 1,
  "specialty_id": 1,
  "technician_service_id": 1,
  "title": "Revisión de centro de carga en casa",
  "description": "Se dispara la pastilla principal al encender equipos de aire acondicionado.",
  "address_line": "Calle 56 #124, Col. Petrolera, Ciudad del Carmen",
  "approx_zone": "Colonia Petrolera, Ciudad del Carmen",
  "latitude": 18.6451,
  "longitude": -91.8219,
  "preferred_date": "2026-11-19",
  "preferred_start": "10:00"
}