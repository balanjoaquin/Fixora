import api from "./api";

export interface BackendUser {
  id: number;
  name: string;
  email: string;
  role: "client" | "technician" | "admin";
  phone: string | null;
  status: "active" | "suspended";
  email_verified_at?: string | null;
  technician_profile?: {
    id: number;
    headline: string | null;
    bio: string | null;
    years_experience: number;
    service_zone: string | null;
    latitude: number | null;
    longitude: number | null;
    service_radius_km: number | null;
    is_visible: boolean;
    rating_avg: string;
    rating_count: number;
    completed_count: number;
    specialties?: Array<{ id: number; name: string; slug: string; icon?: string }>;
  } | null;
}

export interface AuthResponse {
  message: string;
  data: {
    user: BackendUser;
    token: string;
    token_type: string;
  };
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
  role: "client" | "technician";
}

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>("/auth/login", { email, password });
  return response.data;
};

export const registerUser = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const response = await api.post<AuthResponse>("/auth/register", payload);
  return response.data;
};

export const logoutUser = async (): Promise<void> => {
  await api.post("/auth/logout");
};

export const getCurrentUser = async (): Promise<BackendUser> => {
  const response = await api.get<{ data: BackendUser }>("/auth/me");
  return response.data.data;
};

export const resendVerificationEmail = async () => {
  const response = await api.post<{ message: string; email_verified: boolean }>("/auth/email/resend");
  return response.data;
};

export const requestPasswordReset = async (email: string) => {
  const response = await api.post<{ message: string }>("/auth/forgot-password", { email });
  return response.data;
};

export const resetPassword = async (payload: {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}) => {
  const response = await api.post<{ message: string }>("/auth/reset-password", payload);
  return response.data;
};

export const updateAccountProfile = async (payload: { name: string; phone: string }) => {
  const response = await api.put<{ message: string; data: BackendUser }>("/account", payload);
  return response.data;
};

export const updateAccountPassword = async (payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}) => {
  const response = await api.put<{ message: string }>("/account/password", payload);
  return response.data;
};