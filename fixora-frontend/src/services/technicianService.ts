import api from "./api";

export interface SpecialtyItem {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  is_active: boolean;
}

export interface PublicTechnicianSummary {
  id: number;
  name: string;
  headline: string | null;
  years_experience: number;
  service_zone: string | null;
  specialties: Array<{ id: number; name: string; slug: string; icon: string | null }>;
  rating_avg: string;
  rating_count: number;
  completed_count: number;
  verified: boolean;
}

export interface AvailabilitySlotPayload {
  weekday: number;
  start_time: string;
  end_time: string;
}

export const getSpecialties = async (): Promise<SpecialtyItem[]> => {
  const response = await api.get<{ data: SpecialtyItem[] }>("/specialties");
  return response.data.data;
};

export const getPublicTechnicians = async (params: {
  q?: string;
  specialty_id?: number;
  specialty?: string;
  zone?: string;
  sort?: "rating" | "experience" | "recent" | "distance";
} = {}): Promise<PublicTechnicianSummary[]> => {
  const response = await api.get<{ data: PublicTechnicianSummary[] }>("/technicians", { params });
  return response.data.data;
};

export const getTechnicianById = async (id: number) => {
  const response = await api.get(`/technicians/${id}`);
  return response.data.data;
};

export const getOwnTechnicianProfile = async () => {
  const response = await api.get("/technician/profile");
  return response.data.data;
};

export const updateTechnicianProfile = async (payload: {
  headline?: string | null;
  bio?: string | null;
  years_experience: number;
  service_zone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  service_radius_km?: number | null;
}) => {
  const response = await api.put("/technician/profile", payload);
  return response.data;
};

export const syncTechnicianSpecialties = async (specialtyIds: number[]) => {
  const response = await api.put("/technician/specialties", {
    specialty_ids: specialtyIds,
  });
  return response.data;
};

export const getTechnicianAvailability = async () => {
  const response = await api.get<{
    data: Array<{ id: number; weekday: number; start_time: string; end_time: string }>;
  }>("/technician/availability");
  return response.data.data;
};

export const updateTechnicianAvailability = async (slots: AvailabilitySlotPayload[]) => {
  const response = await api.put("/technician/availability", { slots });
  return response.data;
};