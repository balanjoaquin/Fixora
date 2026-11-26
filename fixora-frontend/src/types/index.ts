export type ServiceStatus =
  | "Pendiente"
  | "Aceptada"
  | "En proceso"
  | "Finalizada"
  | "Cancelada";

export type ClientTab =
  | "overview"
  | "search"
  | "requests"
  | "profile"
  | "settings";

export type TechTab =
  | "overview"
  | "requests"
  | "calendar"
  | "jobs"
  | "reviews"
  | "profile"
  | "settings";

export type PageRoute =
  | "home"
  | "client-login"
  | "client-register"
  | "client-dashboard"
  | "tech-landing"
  | "tech-login"
  | "tech-register"
  | "tech-dashboard"
  | "email-verified"
  | "reset-password";

export type InfoDocType = "privacy" | "terms" | "support";

export interface TechnicianPublicServiceItem {
  id: number;
  specialty_id: number;
  title: string;
  description?: string | null;
  reference_price?: string | number | null;
  estimated_duration_minutes?: number | null;
}

export interface TechnicianPublicAvailabilityItem {
  id?: number;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface TechnicianSummary {
  id: string;
  name: string;
  specialty: string;
  specialtyId?: number;
  headline?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  experienceYears: number | null;
  rating: number | null;
  reviewsCount: number;
  completedCount?: number;
  city: string;
  available: boolean;
  bio: string;
  certifications: string[];
  specialties?: Array<{ id: number; name: string; slug?: string }>;
  services?: TechnicianPublicServiceItem[];
  availability?: TechnicianPublicAvailabilityItem[];
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: "client" | "technician" | "admin";
  status?: string;
  email_verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  message?: string;
  token?: string;
  access_token?: string;
  token_type?: string;
  user?: AuthUser;
  data?: {
    user: AuthUser;
    token?: string;
    access_token?: string;
    token_type?: string;
  };
}

export type ActiveModal =
  | { type: "none" }
  | {
      type: "request-service";
      defaultSpecialty?: string;
      technician?: TechnicianSummary;
      defaultZone?: string;
      defaultTitle?: string;
    }
  | { type: "technician-detail"; technician: TechnicianSummary }
  | { type: "forgot-password"; role?: "client" | "technician" }
  | { type: "info-doc"; doc: InfoDocType };

export interface ToastNotice {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
}

export interface ServiceReviewItem {
  id?: number;
  rating: number;
  comment?: string | null;
  photos?: string[] | null;
  technician_reply?: string | null;
  replied_at?: string | null;
  created_at?: string;
}

export interface ServiceRequestItem {
  id: string;
  folio: string;
  specialty: string;
  technicianId?: string;
  technicianName?: string;
  serviceTitle: string;
  description: string;
  photos?: string[] | null;
  preferredDate: string;
  preferredTime: string;
  address: string;
  status: ServiceStatus;
  review?: ServiceReviewItem | null;
  createdAt: string;
}

export interface UpdateTechnicianProfilePayload {
  headline?: string;
  bio?: string;
  service_zone?: string;
  service_area?: string;
  years_experience?: number;
  experience_years?: number;
  hourly_rate?: number;
  is_available?: boolean;
}

export type SyncTechnicianSpecialtiesPayload =
  | number[]
  | {
      specialty_ids?: number[];
      specialties?: string[];
      specialty_names?: string[];
    };

export interface CreateServiceRequestPayload {
  technician_profile_id?: number;
  technician_id?: number;
  specialty_id?: number;
  specialty_name?: string;
  technician_service_id?: number | null;
  title: string;
  description: string;
  neighborhood?: string;
  approx_zone?: string;
  zone?: string;
  address?: string;
  address_line?: string;
  preferred_date: string;
  preferred_time?: string;
  preferred_start?: string;
  photos?: File[];
}

export interface CreateReviewPayload {
  rating: number;
  comment?: string;
  photos?: File[];
}