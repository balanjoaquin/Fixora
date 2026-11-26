import api from "./api";

export type BackendRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

export interface BackendServiceRequest {
  id: number;
  status: BackendRequestStatus;
  title: string;
  description: string;
  approx_zone: string;
  address_line?: string;
  preferred_date: string;
  preferred_start: string;
  expires_at: string | null;
  closing_reason: string | null;
  available_actions: string[];
  can_review: boolean;
  specialty?: { id: number; name: string; slug: string };
  client?: { id: number; name: string; phone?: string };
  technician?: {
    id: number;
    name: string;
    headline: string | null;
    service_zone: string | null;
    rating_avg: string;
    rating_count: number;
    phone?: string;
  };
  created_at: string;
}

export interface CreateServiceRequestPayload {
  technician_profile_id: number;
  specialty_id: number;
  technician_service_id?: number | null;
  title: string;
  description: string;
  address_line: string;
  approx_zone: string;
  latitude?: number | null;
  longitude?: number | null;
  preferred_date: string;
  preferred_start: string;
}

export const getServiceRequests = async (status?: string) => {
  const response = await api.get<{ data: BackendServiceRequest[] }>("/requests", {
    params: status ? { status } : undefined,
  });
  return response.data.data;
};

export const createServiceRequest = async (payload: CreateServiceRequestPayload) => {
  const response = await api.post<{ data: BackendServiceRequest }>("/requests", payload);
  return response.data.data;
};

export const acceptServiceRequest = async (id: number) => {
  const response = await api.post<{ data: BackendServiceRequest }>(`/requests/${id}/accept`);
  return response.data.data;
};

export const rejectServiceRequest = async (id: number, reason: string) => {
  const response = await api.post<{ data: BackendServiceRequest }>(`/requests/${id}/reject`, { reason });
  return response.data.data;
};

export const startServiceRequest = async (id: number) => {
  const response = await api.post<{ data: BackendServiceRequest }>(`/requests/${id}/start`);
  return response.data.data;
};

export const completeServiceRequest = async (id: number) => {
  const response = await api.post<{ data: BackendServiceRequest }>(`/requests/${id}/complete`);
  return response.data.data;
};

export const cancelServiceRequest = async (id: number, reason?: string) => {
  const response = await api.post<{ data: BackendServiceRequest }>(`/requests/${id}/cancel`, {
    reason: reason || undefined,
  });
  return response.data.data;
};

export const createReviewForRequest = async (
  requestId: number,
  payload: { rating: number; comment?: string }
) => {
  const response = await api.post(`/requests/${requestId}/review`, payload);
  return response.data;
};