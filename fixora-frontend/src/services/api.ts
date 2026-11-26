import axios from "axios";
import type { AuthResponse, AuthUser } from "@/types";

const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const isExternalHost =
  typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1";

const API_BASE_URL =
  envApiUrl && !(isExternalHost && /localhost|127\.0\.0\.1/.test(envApiUrl))
    ? envApiUrl
    : "/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fixora_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Permite que el navegador asigne multipart/form-data con su boundary al subir fotos
  if (config.data instanceof FormData && config.headers) {
    delete config.headers["Content-Type"];
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem("fixora_token");
      localStorage.removeItem("fixora_user");
      window.dispatchEvent(new CustomEvent("fixora:unauthorized"));
    }
    return Promise.reject(error);
  }
);

function toMultipartFormData(
  fields: Record<string, unknown>,
  photos?: File[]
): FormData {
  const formData = new FormData();

  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null || key === "photos") return;
    if (typeof value === "boolean") {
      formData.append(key, value ? "1" : "0");
    } else {
      formData.append(key, String(value));
    }
  });

  (photos ?? []).forEach((file) => {
    formData.append("photos[]", file);
  });

  return formData;
}

/* ============================================================================
 * Interfaces de Payloads
 * ==========================================================================*/

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  role: "client" | "technician";
}

export interface ResetPasswordPayload {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface UpdateAccountPayload {
  name?: string;
  phone?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  password: string;
  password_confirmation: string;
}

export interface UpdateTechnicianProfilePayload {
  headline?: string;
  bio?: string;
  service_zone?: string;
  service_area?: string;
  years_experience?: number;
  experience_years?: number;
  is_available?: boolean;
  latitude?: number;
  longitude?: number;
}

export type SyncTechnicianSpecialtiesPayload =
  | number[]
  | {
      specialty_ids?: number[];
      specialties?: string[];
      specialty_names?: string[];
    };

export interface TechnicianServicePayload {
  specialty_id?: number;
  specialty_name?: string;
  title: string;
  description?: string;
  reference_price?: number | null;
  estimated_duration_minutes?: number | null;
  is_active?: boolean;
}

export interface AvailabilitySlotPayload {
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface PublicTechnicianSearchParams {
  q?: string;
  specialty_id?: number;
  specialty?: string;
  zone?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  available_on?: string;
  available_at?: string;
  sort?: "rating" | "distance" | "experience";
  page?: number;
  per_page?: number;
}

export interface CreateServiceRequestPayload {
  technician_profile_id?: number;
  technician_id?: number;
  specialty_id?: number;
  specialty_name?: string;
  technician_service_id?: number | null;
  title: string;
  description: string;
  address_line?: string;
  address?: string;
  approx_zone?: string;
  neighborhood?: string;
  zone?: string;
  latitude?: number | null;
  longitude?: number | null;
  preferred_date: string;
  preferred_start?: string;
  preferred_time?: string;
  photos?: File[];
}

export interface CreateReviewPayload {
  rating: number;
  comment?: string;
  photos?: File[];
}

export interface RequestNegotiationMessage {
  id: number;
  actor_id: number;
  actor_role: "client" | "technician" | "admin";
  actor_name: string;
  message: string;
  proposed_price?: number | null;
  created_at?: string;
}

export interface SendRequestMessagePayload {
  message: string;
  proposed_price?: number | null;
}

/* ============================================================================
 * 1. Autenticación y Cuenta
 * ==========================================================================*/

export function getCurrentUser() {
  return api.get<{ user?: AuthUser; data?: { user?: AuthUser } } & AuthUser>(
    "/auth/me"
  );
}

export function loginUser(payload: LoginPayload) {
  return api.post<AuthResponse>("/auth/login", payload);
}

export function registerUser(payload: RegisterPayload) {
  return api.post<AuthResponse>("/auth/register", payload);
}

export function logoutUser() {
  return api.post("/auth/logout");
}

export function forgotPassword(email: string) {
  return api.post("/auth/forgot-password", { email });
}

export function resetPassword(payload: ResetPasswordPayload) {
  return api.post("/auth/reset-password", payload);
}

export function resendVerificationEmail() {
  return api.post("/auth/email/resend");
}

export function updateAccount(payload: UpdateAccountPayload) {
  return api.put("/account", payload);
}

export function changePassword(payload: ChangePasswordPayload) {
  return api.put("/account/password", payload);
}

export function uploadAccountAvatar(file: File) {
  const formData = new FormData();
  formData.append("avatar", file);
  return api.post<{
    message?: string;
    user?: AuthUser;
    avatar_url?: string | null;
    data?: AuthUser;
  }>("/account/avatar", formData);
}

export function deleteAccountAvatar() {
  return api.delete<{
    message?: string;
    user?: AuthUser;
    avatar_url?: null;
    data?: AuthUser;
  }>("/account/avatar");
}

/* ============================================================================
 * 2. Catálogo Público y Búsqueda de Técnicos
 * ==========================================================================*/

export function getSpecialties() {
  return api.get("/specialties");
}

export function searchTechnicians(params?: PublicTechnicianSearchParams) {
  const safeParams: PublicTechnicianSearchParams = {
    ...params,
    per_page: params?.per_page ? Math.min(params.per_page, 24) : 24,
  };

  return api.get("/technicians", { params: safeParams });
}

export function getPublicTechnician(technicianProfileId: number | string) {
  return api.get(`/technicians/${technicianProfileId}`);
}

export function getPublicTechnicianReviews(technicianProfileId: number | string) {
  return api.get(`/technicians/${technicianProfileId}/reviews`);
}

/* ============================================================================
 * 3. Solicitudes de Servicio y Diálogo Previo (Cliente y Técnico)
 * ==========================================================================*/

export function getServiceRequests(params?: {
  status?: string;
  page?: number;
  per_page?: number;
}) {
  return api.get("/requests", { params });
}

export function getServiceRequestDetail(id: number | string) {
  return api.get(`/requests/${id}`);
}

export function getServiceRequestMessages(id: number | string) {
  return api.get<{ data: RequestNegotiationMessage[] }>(
    `/requests/${id}/messages`
  );
}

export function sendServiceRequestMessage(
  id: number | string,
  payload: SendRequestMessagePayload
) {
  return api.post<{ data: RequestNegotiationMessage }>(
    `/requests/${id}/messages`,
    payload
  );
}

export function createServiceRequest(payload: CreateServiceRequestPayload) {
  if (payload.photos && payload.photos.length > 0) {
    const formData = toMultipartFormData(
      payload as unknown as Record<string, unknown>,
      payload.photos
    );
    return api.post("/requests", formData);
  }

  const { photos: _unusedPhotos, ...jsonPayload } = payload;
  return api.post("/requests", jsonPayload);
}

export function acceptServiceRequest(id: number | string) {
  return api.post(`/requests/${id}/accept`);
}

export function rejectServiceRequest(id: number | string, reason?: string) {
  return api.post(`/requests/${id}/reject`, reason ? { reason } : {});
}

export function startServiceRequest(id: number | string) {
  return api.post(`/requests/${id}/start`);
}

export function completeServiceRequest(id: number | string) {
  return api.post(`/requests/${id}/complete`);
}

export function cancelServiceRequest(id: number | string, reason?: string) {
  return api.post(`/requests/${id}/cancel`, reason ? { reason } : {});
}

export function createServiceReview(
  requestId: number | string,
  payload: CreateReviewPayload
) {
  if (payload.photos && payload.photos.length > 0) {
    const formData = toMultipartFormData(
      payload as unknown as Record<string, unknown>,
      payload.photos
    );
    return api.post(`/requests/${requestId}/review`, formData);
  }

  const { photos: _unusedPhotos, ...jsonPayload } = payload;
  return api.post(`/requests/${requestId}/review`, jsonPayload);
}

/* ============================================================================
 * 4. Perfil, Servicios, Disponibilidad y Reseñas del Técnico
 * ==========================================================================*/

export function getTechnicianProfile() {
  return api.get("/technician/profile");
}

export function updateTechnicianProfile(
  payload: UpdateTechnicianProfilePayload
) {
  return api.put("/technician/profile", payload);
}

export function uploadTechnicianAvatar(file: File) {
  const formData = new FormData();
  formData.append("avatar", file);
  return api.post<{
    message?: string;
    avatar_url?: string | null;
    data?: { avatar_url?: string | null };
  }>("/technician/avatar", formData);
}

export function deleteTechnicianAvatar() {
  return api.delete<{
    message?: string;
    avatar_url?: null;
  }>("/technician/avatar");
}

export function syncTechnicianSpecialties(
  payload: SyncTechnicianSpecialtiesPayload
) {
  const body = Array.isArray(payload) ? { specialty_ids: payload } : payload;
  return api.put("/technician/specialties", body);
}

export function getTechnicianServices() {
  return api.get("/technician/services");
}

export function createTechnicianService(payload: TechnicianServicePayload) {
  return api.post("/technician/services", payload);
}

export function updateTechnicianService(
  serviceId: number | string,
  payload: Partial<TechnicianServicePayload>
) {
  return api.put(`/technician/services/${serviceId}`, payload);
}

export function deleteTechnicianService(serviceId: number | string) {
  return api.delete(`/technician/services/${serviceId}`);
}

export function getTechnicianAvailability() {
  return api.get("/technician/availability");
}

export function replaceTechnicianAvailability(slots: AvailabilitySlotPayload[]) {
  return api.put("/technician/availability", { slots });
}

export function getTechnicianReviews() {
  return api.get("/technician/reviews");
}

export function replyToReview(reviewId: number | string, reply: string) {
  return api.post(`/reviews/${reviewId}/reply`, { reply });
}

/* ============================================================================
 * 5. Notificaciones
 * ==========================================================================*/

export function getNotifications(params?: { unread?: boolean; page?: number }) {
  return api.get("/notifications", { params });
}

export function getUnreadNotificationsCount() {
  return api.get<{ unread_count: number }>("/notifications/unread-count");
}

export function markNotificationRead(id: string) {
  return api.post(`/notifications/${id}/read`);
}

export function markAllNotificationsRead() {
  return api.post("/notifications/read-all");
}

/* ============================================================================
 * Helpers de Sesión y Errores
 * ==========================================================================*/

export function extractAuthSession(responseData: unknown): {
  user: AuthUser | null;
  token: string | null;
} {
  if (!responseData || typeof responseData !== "object") {
    return { user: null, token: null };
  }

  const root = responseData as Record<string, unknown>;
  const inner =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const user =
    inner.user && typeof inner.user === "object"
      ? (inner.user as AuthUser)
      : null;

  const rawToken = inner.token ?? inner.access_token;
  const token =
    typeof rawToken === "string" && rawToken.length > 0 ? rawToken : null;

  return { user, token };
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined;

    if (data?.errors) {
      const firstKey = Object.keys(data.errors)[0];
      if (
        firstKey &&
        Array.isArray(data.errors[firstKey]) &&
        data.errors[firstKey][0]
      ) {
        return data.errors[firstKey][0];
      }
    }
    if (data?.message) return data.message;
    if (error.code === "ERR_NETWORK" || !error.response) {
      return "No se pudo conectar con el servidor. Verifica tu conexión o intenta más tarde.";
    }
  }
  return fallback;
}

export function getApiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { code?: string } | undefined)?.code;
  }
  return undefined;
}

export default api;