import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  FileText,
  Home,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  Star,
  Tag,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";
import { NotificationsBell } from "@/components/common/NotificationsBell";
import { PhotoGallery } from "@/components/common/PhotoGallery";
import {
  ServiceReceiptModal,
  type ReceiptOrderData,
} from "@/components/modals/ServiceReceiptModal";
import { useNav } from "@/context/NavigationContext";
import {
  acceptServiceRequest,
  changePassword,
  completeServiceRequest,
  createTechnicianService,
  deleteTechnicianAvatar,
  deleteTechnicianService,
  getApiErrorMessage,
  getServiceRequestMessages,
  getServiceRequests,
  getSpecialties,
  getTechnicianAvailability,
  getTechnicianProfile,
  getTechnicianReviews,
  getTechnicianServices,
  logoutUser,
  rejectServiceRequest,
  replaceTechnicianAvailability,
  replyToReview,
  sendServiceRequestMessage,
  startServiceRequest,
  syncTechnicianSpecialties,
  updateAccount,
  updateTechnicianProfile,
  updateTechnicianService,
  uploadTechnicianAvatar,
  type AvailabilitySlotPayload,
  type RequestNegotiationMessage,
} from "@/services/api";
import type { TechTab } from "@/types";

interface SpecialtyItem {
  id: number;
  name: string;
}

interface TechnicianCatalogItem {
  id: number;
  specialty_id?: number | null;
  title: string;
  description?: string | null;
  reference_price?: string | number | null;
  is_active: boolean;
  specialty?: { id: number; name: string };
}

interface TechnicianReviewItem {
  id: number;
  rating: number;
  comment?: string | null;
  photos?: string[] | null;
  technician_reply?: string | null;
  replied_at?: string | null;
  created_at?: string;
  client?: { id?: number; name?: string };
  service_request?: {
    id?: number;
    title?: string;
    specialty?: { name?: string };
  };
}

interface RawRequestItem {
  id: number;
  folio?: string;
  title: string;
  description: string;
  photos?: string[] | null;
  approx_zone?: string;
  neighborhood?: string;
  address_line?: string;
  address?: string;
  preferred_date?: string;
  preferred_start?: string;
  preferred_time?: string;
  completed_at?: string | null;
  status: string;
  client?: { id?: number; name: string; phone?: string };
  specialty?: { id?: number; name: string };
  technician_service?: {
    id: number;
    title: string;
    reference_price?: string | number | null;
  };
  review?: {
    rating: number;
    comment?: string | null;
    photos?: string[] | null;
    technician_reply?: string | null;
    created_at?: string;
  } | null;
  events?: Array<{ id: number; reason?: string | null }>;
}

type RequestFilterTab =
  | "Pendiente"
  | "Aceptada"
  | "En proceso"
  | "Finalizada"
  | "Cancelada";

type JobsFilterTab =
  | "Pendientes"
  | "Aceptados"
  | "En proceso"
  | "Finalizados"
  | "Cancelados";

const WEEKDAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const VALID_TECH_TABS: TechTab[] = [
  "overview",
  "requests",
  "calendar",
  "jobs",
  "reviews",
  "profile",
  "settings",
];

function normalizeStatus(raw: string): RequestFilterTab {
  const s = (raw || "").toLowerCase();
  if (s === "accepted" || s === "aceptada") return "Aceptada";
  if (s === "in_progress" || s === "en proceso" || s === "started") {
    return "En proceso";
  }
  if (s === "completed" || s === "finalizada" || s === "finished") {
    return "Finalizada";
  }
  if (s === "cancelled" || s === "rejected" || s === "cancelada") {
    return "Cancelada";
  }
  return "Pendiente";
}

export function TechDashboardPage() {
  const { user, setUser, go, showToast } = useNav();

  const [activeTab, setActiveTab] = useState<TechTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RawRequestItem[]>([]);

  const [receiptOrder, setReceiptOrder] = useState<ReceiptOrderData | null>(
    null
  );

  const [requestFilter, setRequestFilter] =
    useState<RequestFilterTab>("Pendiente");
  const [jobsFilter, setJobsFilter] = useState<JobsFilterTab>("Finalizados");

  const [chatRequest, setChatRequest] = useState<RawRequestItem | null>(null);
  const [chatMessages, setChatMessages] = useState<RequestNegotiationMessage[]>(
    []
  );
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.avatar_url ?? null
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [fullName, setFullName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [serviceZone, setServiceZone] = useState("");
  const [yearsExperience, setYearsExperience] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [ratingAvg, setRatingAvg] = useState<string>("0.00");

  const [catalogItems, setCatalogItems] = useState<TechnicianCatalogItem[]>([]);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceSpecialty, setServiceSpecialty] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [savingCatalogItem, setSavingCatalogItem] = useState(false);

  const [reviews, setReviews] = useState<TechnicianReviewItem[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<number | null>(null);

  const [catalogSpecialties, setCatalogSpecialties] = useState<SpecialtyItem[]>(
    []
  );
  const [mySpecialties, setMySpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [slots, setSlots] = useState<AvailabilitySlotPayload[]>([]);
  const [newWeekday, setNewWeekday] = useState<number>(1);
  const [newStartTime, setNewStartTime] = useState<string>("09:00");
  const [newEndTime, setNewEndTime] = useState<string>("18:00");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [reqRes, profRes, specRes, availRes, revRes, srvRes] =
      await Promise.allSettled([
        getServiceRequests(),
        getTechnicianProfile(),
        getSpecialties(),
        getTechnicianAvailability(),
        getTechnicianReviews(),
        getTechnicianServices(),
      ]);

    if (reqRes.status === "fulfilled") {
      const raw = reqRes.value.data?.data ?? reqRes.value.data ?? [];
      setRequests(Array.isArray(raw) ? raw : []);
    }

    if (profRes.status === "fulfilled") {
      const prof = profRes.value.data?.data ?? profRes.value.data ?? {};
      setHeadline(prof.headline ?? "");
      setBio(prof.bio ?? "");
      setServiceZone(prof.service_zone ?? prof.service_area ?? "");
      setYearsExperience(
        Number(prof.years_experience ?? prof.experience_years ?? 0)
      );
      setIsVisible(Boolean(prof.is_visible ?? prof.is_available ?? true));
      setRatingAvg(String(prof.rating_avg ?? "0.00"));
      setAvatarUrl(prof.avatar_url ?? null);

      const assigned: SpecialtyItem[] = Array.isArray(prof.specialties)
        ? prof.specialties
        : [];
      setMySpecialties(assigned.map((s) => s.name));
    }

    if (specRes.status === "fulfilled") {
      const rawSpec = specRes.value.data?.data ?? specRes.value.data ?? [];
      setCatalogSpecialties(Array.isArray(rawSpec) ? rawSpec : []);
    }

    if (availRes.status === "fulfilled") {
      const rawSlots =
        availRes.value.data?.data ?? availRes.value.data?.slots ?? [];
      setSlots(Array.isArray(rawSlots) ? rawSlots : []);
    }

    if (revRes.status === "fulfilled") {
      const rawRevs = revRes.value.data?.data ?? revRes.value.data ?? [];
      setReviews(Array.isArray(rawRevs) ? rawRevs : []);
    }

    if (srvRes.status === "fulfilled") {
      const rawSrvs = srvRes.value.data?.data ?? srvRes.value.data ?? [];
      setCatalogItems(Array.isArray(rawSrvs) ? rawSrvs : []);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (user?.name) setFullName(user.name);
    if (user?.phone) setPhone(user.phone);
  }, [user]);

  const handleNotificationNavigate = (targetTab: string) => {
    if (VALID_TECH_TABS.includes(targetTab as TechTab)) {
      setActiveTab(targetTab as TechTab);
      void loadAll();
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg"];
    if (!validTypes.includes(file.type)) {
      showToast({
        type: "error",
        title: "Formato no permitido",
        message: "Solo se admiten imágenes en formato PNG o JPG.",
      });
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      showToast({
        type: "error",
        title: "Archivo demasiado pesado",
        message: "La foto de perfil debe pesar máximo 2 MB.",
      });
      return;
    }

    const previousUrl = avatarUrl;
    const optimisticPreview = URL.createObjectURL(file);
    setAvatarUrl(optimisticPreview);
    setUploadingAvatar(true);

    try {
      const res = await uploadTechnicianAvatar(file);
      const serverUrl =
        res.data?.avatar_url ?? res.data?.data?.avatar_url ?? null;

      if (serverUrl) {
        setAvatarUrl(serverUrl);
        if (user) {
          setUser({ ...user, avatar_url: serverUrl });
        }
      }

      showToast({
        type: "success",
        title: "Foto actualizada",
        message: "Tu foto de perfil se guardó correctamente en el servidor.",
      });
    } catch (err: unknown) {
      setAvatarUrl(previousUrl);
      showToast({
        type: "error",
        title: "Error al subir foto",
        message: getApiErrorMessage(err, "No se pudo subir la imagen."),
      });
    } finally {
      URL.revokeObjectURL(optimisticPreview);
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      await deleteTechnicianAvatar();
      setAvatarUrl(null);
      if (user) {
        setUser({ ...user, avatar_url: null });
      }
      showToast({
        type: "info",
        title: "Foto eliminada",
        message: "Se restauró el ícono predeterminado.",
      });
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "Error",
        message: getApiErrorMessage(err, "No se pudo eliminar la foto."),
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleOpenReceipt = (job: RawRequestItem) => {
    const matchedReview =
      job.review ??
      reviews.find((rev) => rev.service_request?.id === job.id) ??
      null;

    setReceiptOrder({
      ...job,
      client: job.client,
      technician_profile: {
        headline,
        service_zone: serviceZone,
        user: {
          name: fullName || user?.name,
          phone: phone || user?.phone,
        },
      },
      review: matchedReview
        ? {
            rating: matchedReview.rating,
            comment: matchedReview.comment,
            technician_reply: matchedReview.technician_reply,
            created_at: matchedReview.created_at,
          }
        : null,
    });
  };

  const openNegotiationChat = async (req: RawRequestItem) => {
    setChatRequest(req);
    setChatInput("");
    setQuoteAmount("");
    setLoadingChat(true);
    try {
      const res = await getServiceRequestMessages(req.id);
      const list = res.data?.data ?? [];
      setChatMessages(Array.isArray(list) ? list : []);
    } catch {
      setChatMessages([]);
    } finally {
      setLoadingChat(false);
    }
  };

  const refreshChatMessages = async (requestId: number) => {
    setLoadingChat(true);
    try {
      const res = await getServiceRequestMessages(requestId);
      const list = res.data?.data ?? [];
      setChatMessages(Array.isArray(list) ? list : []);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSendNegotiationMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatRequest || !chatInput.trim()) return;

    setSendingChat(true);
    try {
      const res = await sendServiceRequestMessage(chatRequest.id, {
        message: chatInput.trim(),
        proposed_price:
          quoteAmount.trim() !== "" ? Number(quoteAmount) : null,
      });
      const created = res.data?.data;
      if (created) {
        setChatMessages((prev) => [...prev, created]);
      } else {
        await refreshChatMessages(chatRequest.id);
      }
      setChatInput("");
      setQuoteAmount("");
      await loadAll();
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "No se pudo enviar el mensaje",
        message: getApiErrorMessage(err, "Intenta de nuevo."),
      });
    } finally {
      setSendingChat(false);
    }
  };

  const pendingRequests = requests.filter(
    (r) => normalizeStatus(r.status) === "Pendiente"
  );
  const activeJobs = requests.filter((r) => {
    const st = normalizeStatus(r.status);
    return st === "Aceptada" || st === "En proceso";
  });
  const completedJobs = requests.filter(
    (r) => normalizeStatus(r.status) === "Finalizada"
  );

  const filteredRequests = requests.filter(
    (r) => normalizeStatus(r.status) === requestFilter
  );

  const filteredJobs = requests.filter((r) => {
    const st = normalizeStatus(r.status);
    if (jobsFilter === "Pendientes") return st === "Pendiente";
    if (jobsFilter === "Aceptados") return st === "Aceptada";
    if (jobsFilter === "En proceso") return st === "En proceso";
    if (jobsFilter === "Finalizados") return st === "Finalizada";
    return st === "Cancelada";
  });

  const handleAction = async (
    id: number,
    action: "accept" | "reject" | "start" | "complete"
  ) => {
    try {
      if (action === "accept") await acceptServiceRequest(id);
      if (action === "reject") await rejectServiceRequest(id);
      if (action === "start") await startServiceRequest(id);
      if (action === "complete") await completeServiceRequest(id);

      if (chatRequest?.id === id) {
        setChatRequest(null);
      }

      showToast({
        type: "success",
        title: "Orden actualizada",
        message: "El estado del servicio se actualizó correctamente.",
      });
      await loadAll();
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "No se pudo cambiar el estado de la solicitud.",
      });
    }
  };

  const resetServiceForm = () => {
    setEditingServiceId(null);
    setServiceTitle("");
    setServiceSpecialty("");
    setServicePrice("");
    setServiceDescription("");
  };

  const handleEditCatalogItem = (item: TechnicianCatalogItem) => {
    setEditingServiceId(item.id);
    setServiceTitle(item.title);
    setServiceSpecialty(item.specialty?.name ?? "");
    setServicePrice(
      item.reference_price !== null && item.reference_price !== undefined
        ? String(item.reference_price)
        : ""
    );
    setServiceDescription(item.description ?? "");
  };

  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceTitle.trim()) return;

    setSavingCatalogItem(true);
    try {
      const matchedSpec = catalogSpecialties.find(
        (s) => s.name.toLowerCase() === serviceSpecialty.trim().toLowerCase()
      );

      const payload = {
        title: serviceTitle.trim(),
        description: serviceDescription.trim() || undefined,
        reference_price:
          servicePrice.trim() !== "" ? Number(servicePrice) : null,
        ...(matchedSpec
          ? { specialty_id: matchedSpec.id }
          : serviceSpecialty.trim()
            ? { specialty_name: serviceSpecialty.trim() }
            : {}),
      };

      if (editingServiceId) {
        await updateTechnicianService(editingServiceId, payload);
        showToast({
          type: "success",
          title: "Servicio actualizado",
          message: "Los cambios en tu tarifario ya son visibles.",
        });
      } else {
        await createTechnicianService(payload);
        showToast({
          type: "success",
          title: "Servicio publicado",
          message: "El servicio se agregó a tu catálogo público.",
        });
      }

      resetServiceForm();
      await loadAll();
    } catch (err: unknown) {
      showToast({
        type: "error",
        title: "No se pudo guardar el servicio",
        message: getApiErrorMessage(err, "Verifica los datos del servicio."),
      });
    } finally {
      setSavingCatalogItem(false);
    }
  };

  const handleToggleCatalogItem = async (item: TechnicianCatalogItem) => {
    try {
      await updateTechnicianService(item.id, { is_active: !item.is_active });
      await loadAll();
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "No se pudo cambiar la visibilidad del servicio.",
      });
    }
  };

  const handleDeleteCatalogItem = async (id: number) => {
    try {
      await deleteTechnicianService(id);
      if (editingServiceId === id) resetServiceForm();
      showToast({
        type: "info",
        title: "Servicio eliminado",
        message: "El servicio fue retirado de tu tarifario.",
      });
      await loadAll();
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "No se pudo eliminar el servicio.",
      });
    }
  };

  const handleSendReply = async (reviewId: number) => {
    const text = (replyDrafts[reviewId] ?? "").trim();
    if (!text) return;

    setSendingReplyId(reviewId);
    try {
      await replyToReview(reviewId, text);
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: "" }));
      showToast({
        type: "success",
        title: "Respuesta publicada",
        message: "Tu respuesta ya es visible en tu perfil público.",
      });
      await loadAll();
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "No se pudo publicar tu respuesta.",
      });
    } finally {
      setSendingReplyId(null);
    }
  };

  const handleAddSpecialty = () => {
    const clean = specialtyInput.trim();
    if (!clean) return;
    if (!mySpecialties.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setMySpecialties((prev) => [...prev, clean]);
    }
    setSpecialtyInput("");
  };

  const handleRemoveSpecialty = (name: string) => {
    setMySpecialties((prev) => prev.filter((item) => item !== name));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      if (fullName.trim() || phone.trim()) {
        await updateAccount({
          name: fullName.trim(),
          phone: phone.trim(),
        });
        if (user) {
          setUser({ ...user, name: fullName.trim(), phone: phone.trim() });
        }
      }

      const pendingText = specialtyInput.trim();
      const finalSpecialties =
        pendingText &&
        !mySpecialties.some(
          (s) => s.toLowerCase() === pendingText.toLowerCase()
        )
          ? [...mySpecialties, pendingText]
          : mySpecialties;

      const profilePayload = {
        headline: headline.trim() || "Técnico especialista",
        bio: bio.trim(),
        service_zone: serviceZone.trim(),
        service_area: serviceZone.trim(),
        years_experience: Number(yearsExperience) || 0,
        experience_years: Number(yearsExperience) || 0,
        is_available: isVisible,
      };

      await updateTechnicianProfile(
        profilePayload as Parameters<typeof updateTechnicianProfile>[0]
      );

      await syncTechnicianSpecialties({
        specialties: finalSpecialties,
      });

      setMySpecialties(finalSpecialties);
      setSpecialtyInput("");

      showToast({
        type: "success",
        title: "Perfil actualizado",
        message: "Tus datos y especialidades ya están visibles en Fixora.",
      });
    } catch {
      showToast({
        type: "error",
        title: "Error al guardar",
        message: "No se pudieron guardar los cambios de tu perfil.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddSlot = () => {
    if (!newStartTime || !newEndTime || newStartTime >= newEndTime) {
      showToast({
        type: "error",
        title: "Horario inválido",
        message: "La hora de inicio debe ser anterior a la hora de fin.",
      });
      return;
    }

    setSlots((prev) => [
      ...prev,
      {
        weekday: newWeekday,
        start_time: newStartTime,
        end_time: newEndTime,
      },
    ]);
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await replaceTechnicianAvailability(slots);
      showToast({
        type: "success",
        title: "Horario guardado",
        message: "Tu disponibilidad semanal se actualizó correctamente.",
      });
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "No se pudo guardar tu disponibilidad.",
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast({
        type: "error",
        title: "Contraseñas distintas",
        message: "La nueva contraseña y su confirmación no coinciden.",
      });
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast({
        type: "success",
        title: "Contraseña actualizada",
        message: "Tu contraseña se cambió con éxito.",
      });
    } catch {
      showToast({
        type: "error",
        title: "Error",
        message: "Verifica tu contraseña actual e inténtalo de nuevo.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // Ignorar si la sesión ya expiró
    }
    localStorage.removeItem("fixora_token");
    localStorage.removeItem("fixora_user");
    setUser(null);
    showToast({ type: "info", title: "Sesión cerrada" });
    go("home");
  };

  const navItems: Array<{
    id: TechTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: "overview", label: "Inicio", icon: <Home className="w-4 h-4" /> },
    {
      id: "requests",
      label: "Solicitudes",
      icon: <Bell className="w-4 h-4" />,
      badge: pendingRequests.length,
    },
    {
      id: "calendar",
      label: "Calendario",
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: "jobs",
      label: "Trabajos",
      icon: <Briefcase className="w-4 h-4" />,
    },
    {
      id: "reviews",
      label: "Reseñas",
      icon: <Star className="w-4 h-4" />,
      badge: reviews.length > 0 ? reviews.length : undefined,
    },
    { id: "profile", label: "Mi Perfil", icon: <User className="w-4 h-4" /> },
    {
      id: "settings",
      label: "Configuración",
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const currentTabTitle =
    navItems.find((item) => item.id === activeTab)?.label ?? "Inicio";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0B1120] text-white flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              type="button"
              onClick={() => go("home")}
              className="text-2xl font-black tracking-tight text-white cursor-pointer"
            >
              Fixora
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="rounded-2xl bg-[#131C31] border border-slate-800 p-3.5 flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#1D63ED] flex items-center justify-center shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || "Técnico"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Wrench className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                Panel Técnico
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user?.email ?? "tecnico@fixora.mx"}
              </p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[#1D63ED] text-white font-semibold shadow-sm"
                      : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {item.icon}
                    {item.label}
                  </span>

                  {typeof item.badge === "number" && (
                    <span
                      className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-white text-[11px] font-bold flex items-center justify-center ${
                        item.id === "reviews" ? "bg-amber-500" : "bg-[#EF4444]"
                      }`}
                    >
                      {item.badge > 0 ? item.badge : "–"}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-[#0F172A]">
              {currentTabTitle}
            </span>
          </div>

          <NotificationsBell onNavigateTarget={handleNotificationNavigate} />
        </header>

        <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-[#0F172A]">
                  Panel del Técnico
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Resumen de tu actividad, solicitudes entrantes y agenda de
                  servicios.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1D63ED] flex items-center justify-center mb-4">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-extrabold text-[#0F172A]">
                    {loading ? "—" : pendingRequests.length || "0"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Solicitudes nuevas
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-extrabold text-[#0F172A]">
                    {loading ? "—" : activeJobs.length || "0"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Trabajos activos
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setJobsFilter("Finalizados");
                    setActiveTab("jobs");
                  }}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 text-left hover:border-emerald-300 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-extrabold text-[#0F172A]">
                    {loading ? "—" : completedJobs.length || "0"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Trabajos realizados
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("reviews")}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 text-left hover:border-amber-300 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                    <Star className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-extrabold text-[#0F172A]">
                    {loading
                      ? "—"
                      : Number(ratingAvg) > 0
                        ? ratingAvg
                        : "Nuevo"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Calificación ({reviews.length} reseñas)
                  </p>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col min-h-[280px]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-[#0F172A]">
                      Solicitudes recientes
                    </h2>
                    {pendingRequests.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("requests")}
                        className="text-xs font-semibold text-[#1D63ED] hover:underline"
                      >
                        Ver todas
                      </button>
                    )}
                  </div>

                  {pendingRequests.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D63ED] flex items-center justify-center mb-3">
                        <Bell className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-[#0F172A]">
                        Sin solicitudes nuevas
                      </p>
                      <p className="mt-1 text-xs text-slate-500 max-w-xs">
                        Las nuevas solicitudes de clientes aparecerán aquí.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingRequests.slice(0, 3).map((req) => (
                        <div
                          key={req.id}
                          className="rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#0F172A] truncate">
                              {req.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {req.specialty?.name ?? "Servicio"} •{" "}
                              {req.approx_zone ||
                                req.neighborhood ||
                                "Zona local"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("requests");
                              void openNegotiationChat(req);
                            }}
                            className="shrink-0 rounded-lg bg-[#1D63ED] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Cotizar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col min-h-[280px]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-[#0F172A]">
                      Próximos trabajos
                    </h2>
                    {activeJobs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setJobsFilter("Aceptados");
                          setActiveTab("jobs");
                        }}
                        className="text-xs font-semibold text-[#1D63ED] hover:underline"
                      >
                        Ver agenda
                      </button>
                    )}
                  </div>

                  {activeJobs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D63ED] flex items-center justify-center mb-3">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-[#0F172A]">
                        Agenda vacía
                      </p>
                      <p className="mt-1 text-xs text-slate-500 max-w-xs">
                        Tus trabajos programados aparecerán aquí.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeJobs.slice(0, 3).map((job) => (
                        <div
                          key={job.id}
                          className="rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#0F172A] truncate">
                              {job.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {job.preferred_date?.slice(0, 10)}{" "}
                              {job.preferred_start || job.preferred_time}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#1D63ED]">
                            {normalizeStatus(job.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "requests" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-extrabold text-[#0F172A]">
                    Solicitudes
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Dialoga con el cliente para acordar alcance y precio antes de
                    aceptar
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAll()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "Pendiente",
                    "Aceptada",
                    "En proceso",
                    "Finalizada",
                    "Cancelada",
                  ] as RequestFilterTab[]
                ).map((tab) => {
                  const active = requestFilter === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setRequestFilter(tab)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                        active
                          ? "bg-[#0B1120] text-white"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              {filteredRequests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D63ED] flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-[#0F172A]">
                    Sin solicitudes {requestFilter.toLowerCase()}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    No tienes solicitudes en estado "
                    {requestFilter.toLowerCase()}" en este momento.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRequests.map((req) => {
                    const messagesCount = Array.isArray(req.events)
                      ? req.events.filter(
                          (e) => e.reason && e.reason.trim() !== ""
                        ).length
                      : 0;

                    return (
                      <div
                        key={req.id}
                        className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1D63ED]">
                              {req.specialty?.name ?? "Servicio Técnico"}
                            </span>
                            <span className="font-mono text-xs text-slate-400">
                              FX-{String(req.id).padStart(4, "0")}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-[#0F172A]">
                              {req.title}
                            </h3>
                            <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {req.description}
                            </p>
                          </div>

                          {req.technician_service && (
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                              <Tag className="w-3 h-3" />
                              {req.technician_service.title}
                              {req.technician_service.reference_price !==
                                null &&
                                req.technician_service.reference_price !==
                                  undefined &&
                                ` ($${Number(req.technician_service.reference_price).toFixed(0)} MXN)`}
                            </div>
                          )}

                          <PhotoGallery
                            photos={req.photos}
                            title="Fotos adjuntas"
                          />

                          <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3 text-xs text-slate-500 space-y-1">
                            <p>
                              <strong className="text-slate-700">
                                Cliente:
                              </strong>{" "}
                              {req.client?.name ?? "Cliente Fixora"}
                            </p>
                            <p>
                              <strong className="text-slate-700">Fecha:</strong>{" "}
                              {req.preferred_date?.slice(0, 10)}{" "}
                              {req.preferred_start || req.preferred_time}
                            </p>
                            <p>
                              <strong className="text-slate-700">Zona:</strong>{" "}
                              {req.approx_zone ||
                                req.neighborhood ||
                                "No especificada"}
                            </p>
                            {normalizeStatus(req.status) !== "Pendiente" &&
                              (req.address_line || req.address) && (
                                <p>
                                  <strong className="text-slate-700">
                                    Dirección:
                                  </strong>{" "}
                                  {req.address_line || req.address}
                                </p>
                              )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <button
                            type="button"
                            onClick={() => void openNegotiationChat(req)}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#1D63ED] bg-blue-50/60 py-2 text-xs font-bold text-[#1D63ED] hover:bg-blue-100/70 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Dialogar y cotizar
                            {messagesCount > 0 && (
                              <span className="rounded-full bg-[#1D63ED] px-1.5 py-0.2 text-[10px] font-bold text-white">
                                {messagesCount}
                              </span>
                            )}
                          </button>

                          {normalizeStatus(req.status) === "Pendiente" && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAction(req.id, "accept")}
                                className="flex-1 rounded-xl bg-[#1D63ED] py-2 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                Aceptar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAction(req.id, "reject")}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                              >
                                Rechazar
                              </button>
                            </div>
                          )}

                          {normalizeStatus(req.status) === "Finalizada" && (
                            <button
                              type="button"
                              onClick={() => handleOpenReceipt(req)}
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#0B1120] bg-white py-2 text-xs font-bold text-[#0B1120] hover:bg-slate-50"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Comprobante / PDF
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-[#0F172A]">
                  Calendario y Disponibilidad
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Configura los días y horarios en los que recibes solicitudes
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
                  <h2 className="text-base font-bold text-[#0F172A]">
                    Horario semanal de atención
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select
                      value={newWeekday}
                      onChange={(e) => setNewWeekday(Number(e.target.value))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                    >
                      {WEEKDAYS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"
                    />

                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#1D63ED] px-4 py-2 text-xs font-semibold text-[#1D63ED] hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar bloque horario
                  </button>

                  {slots.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">
                      Aún no has agregado bloques de horario. Agrega al menos uno
                      para que los clientes conozcan tu disponibilidad.
                    </p>
                  ) : (
                    <div className="space-y-2 pt-2">
                      {slots.map((slot, idx) => {
                        const dayName =
                          WEEKDAYS.find((d) => d.value === slot.weekday)
                            ?.label ?? `Día ${slot.weekday}`;
                        return (
                          <div
                            key={`${slot.weekday}-${slot.start_time}-${idx}`}
                            className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
                          >
                            <span className="font-semibold text-slate-800">
                              {dayName}:{" "}
                              <span className="font-normal text-slate-600">
                                {slot.start_time.slice(0, 5)} –{" "}
                                {slot.end_time.slice(0, 5)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setSlots((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={savingSchedule}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#1D63ED] px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      <Save className="w-4 h-4" />
                      {savingSchedule
                        ? "Guardando..."
                        : "Guardar disponibilidad"}
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-6">
                  <h2 className="text-base font-bold text-[#0F172A] mb-4">
                    Servicios agendados
                  </h2>
                  {activeJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-12">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D63ED] flex items-center justify-center mb-3">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-[#0F172A]">
                        Sin citas agendadas
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Cuando aceptes una solicitud aparecerá en tu agenda.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeJobs.map((job) => (
                        <div
                          key={job.id}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#1D63ED]">
                              {job.preferred_date?.slice(0, 10)} •{" "}
                              {job.preferred_start || job.preferred_time}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                              {normalizeStatus(job.status)}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm font-bold text-[#0F172A]">
                            {job.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {job.address_line ||
                              job.address ||
                              job.approx_zone ||
                              job.neighborhood}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "jobs" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-[#0F172A]">
                  Mis Trabajos
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Consulta tus trabajos realizados y gestiona los servicios en
                  curso
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "Finalizados",
                    "En proceso",
                    "Aceptados",
                    "Pendientes",
                    "Cancelados",
                  ] as JobsFilterTab[]
                ).map((tab) => {
                  const active = jobsFilter === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setJobsFilter(tab)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                        active
                          ? "bg-[#0B1120] text-white"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>

              {filteredJobs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D63ED] flex items-center justify-center mb-3">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-[#0F172A]">
                    Sin trabajos {jobsFilter.toLowerCase()}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Aquí aparecerán tus servicios en estado "
                    {jobsFilter.toLowerCase()}".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredJobs.map((job) => {
                    const st = normalizeStatus(job.status);
                    const jobReview =
                      job.review ??
                      reviews.find((r) => r.service_request?.id === job.id) ??
                      null;

                    return (
                      <div
                        key={job.id}
                        className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                FX-{String(job.id).padStart(4, "0")}
                              </span>
                              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#1D63ED]">
                                {job.specialty?.name ?? "Servicio Técnico"}
                              </span>
                            </div>

                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                st === "Finalizada"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {st}
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-[#0F172A]">
                              {job.title}
                            </h3>
                            <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {job.description}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 rounded-xl bg-slate-50/80 border border-slate-100 p-3 text-xs text-slate-500">
                            <p className="flex items-center gap-1.5 truncate">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {job.client?.name ?? "Cliente Fixora"}
                              </span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {job.preferred_date?.slice(0, 10)}{" "}
                              {job.preferred_start || job.preferred_time}
                            </p>
                            <p className="flex items-center gap-1.5 sm:col-span-2 truncate">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {job.address_line ||
                                  job.address ||
                                  job.approx_zone ||
                                  job.neighborhood}
                              </span>
                            </p>
                          </div>

                          <PhotoGallery
                            photos={jobReview?.photos ?? job.photos}
                            title="Evidencia fotográfica"
                          />

                          {jobReview && (
                            <div className="flex items-center justify-between rounded-xl bg-amber-50/70 border border-amber-200/80 px-3 py-2 text-xs">
                              <span className="font-semibold text-amber-900">
                                Calificación del cliente
                              </span>
                              <span className="inline-flex items-center gap-1 font-extrabold text-amber-700">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                {jobReview.rating}.0 / 5
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex gap-2">
                          {st === "Aceptada" && (
                            <button
                              type="button"
                              onClick={() => handleAction(job.id, "start")}
                              className="w-full rounded-xl bg-[#1D63ED] py-2 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              Iniciar trabajo
                            </button>
                          )}
                          {st === "En proceso" && (
                            <button
                              type="button"
                              onClick={() => handleAction(job.id, "complete")}
                              className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              Marcar como finalizado
                            </button>
                          )}
                          {st === "Finalizada" && (
                            <button
                              type="button"
                              onClick={() => handleOpenReceipt(job)}
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#0B1120] bg-white py-2 text-xs font-bold text-[#0B1120] hover:bg-slate-50"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Ver comprobante / Guardar PDF
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold text-[#0F172A]">
                    Reseñas y Calificaciones
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Opiniones de los clientes sobre tus trabajos realizados y
                    respuestas públicas
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2.5">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  <div>
                    <span className="text-base font-extrabold text-[#0F172A]">
                      {Number(ratingAvg) > 0 ? ratingAvg : "Nuevo"}
                    </span>
                    <span className="ml-1.5 text-xs text-slate-600">
                      ({reviews.length}{" "}
                      {reviews.length === 1 ? "reseña" : "reseñas"})
                    </span>
                  </div>
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-3">
                    <Star className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-[#0F172A]">
                    Aún no has recibido calificaciones
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    Cuando finalices servicios, los clientes podrán calificarte y
                    dejar sus comentarios aquí para que puedas responderles.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-[#0F172A]">
                            {rev.client?.name ?? "Cliente Fixora"}
                          </p>
                          {rev.service_request?.title && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              Trabajo:{" "}
                              <strong className="text-slate-700">
                                {rev.service_request.title}
                              </strong>
                              {rev.service_request.specialty?.name &&
                                ` • ${rev.service_request.specialty.name}`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-4 h-4 ${
                                s <= rev.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {rev.comment && (
                        <p className="text-sm text-slate-700 leading-relaxed">
                          "{rev.comment}"
                        </p>
                      )}

                      <PhotoGallery
                        photos={rev.photos}
                        title="Fotos del trabajo terminado"
                      />

                      {rev.technician_reply ? (
                        <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3.5 text-xs text-slate-700">
                          <span className="font-bold text-[#1D63ED] inline-flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            Tu respuesta:
                          </span>{" "}
                          {rev.technician_reply}
                        </div>
                      ) : (
                        <div className="pt-2 flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={replyDrafts[rev.id] ?? ""}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({
                                ...prev,
                                [rev.id]: e.target.value,
                              }))
                            }
                            placeholder="Escribe una respuesta pública para el cliente..."
                            className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={
                              sendingReplyId === rev.id ||
                              !(replyDrafts[rev.id] ?? "").trim()
                            }
                            onClick={() => handleSendReply(rev.id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B1120] px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            {sendingReplyId === rev.id
                              ? "Enviando..."
                              : "Responder"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "profile" && (
            <div className="space-y-8 max-w-4xl">
              <div>
                <h1 className="text-2xl font-extrabold text-[#0F172A]">
                  Mi Perfil Técnico
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Administra tu información pública y tarifario de servicios
                </p>
              </div>

              <form
                onSubmit={handleSaveProfile}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-2xl bg-[#0B1120] text-white flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Foto de perfil del técnico"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Wrench className="w-7 h-7" />
                      )}

                      {uploadingAvatar && (
                        <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>

                    <div>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(e) => void handleAvatarChange(e)}
                        className="hidden"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={uploadingAvatar}
                          onClick={() => avatarInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#1D63ED] px-4 py-2 text-xs font-semibold text-[#1D63ED] hover:bg-blue-50 disabled:opacity-60 transition-colors cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          {uploadingAvatar ? "Subiendo..." : "Cambiar foto"}
                        </button>

                        {avatarUrl && !uploadingAvatar && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveAvatar()}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                          >
                            Quitar
                          </button>
                        )}
                      </div>

                      <p className="mt-1.5 text-[11px] text-slate-400">
                        PNG, JPG. Máx 2MB
                      </p>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                    <span className="text-sm font-bold text-[#0F172A]">
                      Disponible
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isVisible}
                      onClick={() => setIsVisible((v) => !v)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors cursor-pointer ${
                        isVisible ? "bg-[#00C853]" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          isVisible ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-2">
                      Nombre completo
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Tu nombre completo"
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-2">
                      Especialidad (elige o escribe cualquiera)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        list="profile-specialties-list"
                        value={specialtyInput}
                        onChange={(e) => setSpecialtyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddSpecialty();
                          }
                        }}
                        placeholder="Ej. Electricidad, Herrería, CCTV..."
                        className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddSpecialty}
                        className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        Añadir
                      </button>
                    </div>
                    <datalist id="profile-specialties-list">
                      {catalogSpecialties.map((s) => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>

                    {mySpecialties.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {mySpecialties.map((spec) => (
                          <span
                            key={spec}
                            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#1D63ED]"
                          >
                            {spec}
                            <button
                              type="button"
                              onClick={() => handleRemoveSpecialty(spec)}
                              className="text-blue-400 hover:text-red-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-2">
                      Años de experiencia
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={yearsExperience}
                      onChange={(e) =>
                        setYearsExperience(Number(e.target.value))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0F172A] mb-2">
                      Zona o ciudad de cobertura
                    </label>
                    <input
                      type="text"
                      value={serviceZone}
                      onChange={(e) => setServiceZone(e.target.value)}
                      placeholder="Ej. Ciudad del Carmen / Playa Norte"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-2">
                    Título profesional
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Ej. Técnico especialista en instalaciones eléctricas"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-2">
                    Descripción profesional
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Describe tu experiencia y habilidades..."
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1D63ED] px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    {savingProfile ? "Guardando cambios..." : "Guardar perfil"}
                  </button>
                </div>
              </form>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#0F172A]">
                      Catálogo de Servicios y Tarifario
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Publica tus paquetes y precios de referencia para que los
                      clientes puedan seleccionarlos al solicitar
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#1D63ED]">
                    <Tag className="w-3.5 h-3.5" />
                    {catalogItems.length} publicados
                  </span>
                </div>

                <form
                  onSubmit={handleSaveCatalogItem}
                  className="rounded-2xl bg-slate-50/80 border border-slate-200 p-4 sm:p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      {editingServiceId
                        ? "Editar servicio del tarifario"
                        : "Agregar nuevo servicio al tarifario"}
                    </h3>
                    {editingServiceId && (
                      <button
                        type="button"
                        onClick={resetServiceForm}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        Cancelar edición
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                        Nombre del servicio o paquete *
                      </label>
                      <input
                        type="text"
                        required
                        value={serviceTitle}
                        onChange={(e) => setServiceTitle(e.target.value)}
                        placeholder="Ej. Mantenimiento preventivo de minisplit (1 a 2 ton)"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                        Precio de referencia (MXN)
                      </label>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={servicePrice}
                          onChange={(e) => setServicePrice(e.target.value)}
                          placeholder="Ej. 650"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 py-2.5 text-sm text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                        Especialidad asociada
                      </label>
                      <input
                        type="text"
                        list="catalog-specialties-list"
                        value={serviceSpecialty}
                        onChange={(e) => setServiceSpecialty(e.target.value)}
                        placeholder={mySpecialties[0] ?? "Ej. Electricidad"}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                      />
                      <datalist id="catalog-specialties-list">
                        {catalogSpecialties.map((s) => (
                          <option key={s.id} value={s.name} />
                        ))}
                      </datalist>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                        ¿Qué incluye este servicio? (opcional)
                      </label>
                      <input
                        type="text"
                        value={serviceDescription}
                        onChange={(e) => setServiceDescription(e.target.value)}
                        placeholder="Ej. Limpieza de evaporador, condensador, revisión de gas y drenaje"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingCatalogItem}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#0B1120] px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      <Plus className="w-4 h-4" />
                      {savingCatalogItem
                        ? "Guardando..."
                        : editingServiceId
                          ? "Actualizar servicio"
                          : "Agregar al tarifario"}
                    </button>
                  </div>
                </form>

                {catalogItems.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Aún no has agregado servicios con tarifa. Publica al menos
                    uno para que aparezca en tu ficha pública.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {catalogItems.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                          item.is_active
                            ? "bg-white border-slate-200"
                            : "bg-slate-50 border-slate-200/70 opacity-70"
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#0F172A]">
                              {item.title}
                            </span>
                            {item.specialty?.name && (
                              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#1D63ED]">
                                {item.specialty.name}
                              </span>
                            )}
                            {!item.is_active && (
                              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                Pausado
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-slate-600">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono text-sm font-extrabold text-[#0F172A] bg-slate-100 px-3 py-1.5 rounded-xl">
                            {item.reference_price !== null &&
                            item.reference_price !== undefined
                              ? `$${Number(item.reference_price).toFixed(0)} MXN`
                              : "A cotizar"}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleCatalogItem(item)}
                            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            title={item.is_active ? "Pausar" : "Activar"}
                          >
                            {item.is_active ? "Activo" : "Activar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEditCatalogItem(item)}
                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-[#1D63ED]"
                            title="Editar"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCatalogItem(item.id)}
                            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-red-200/80 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    Sesión en este dispositivo
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cierra tu sesión de técnico de forma segura al terminar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h1 className="text-2xl font-extrabold text-[#0F172A]">
                  Configuración
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Seguridad y preferencias de tu cuenta técnica
                </p>
              </div>

              <form
                onSubmit={handleChangePassword}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4"
              >
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <Lock className="w-4 h-4 text-[#1D63ED]" />
                  <h2 className="text-base font-bold text-[#0F172A]">
                    Cambiar contraseña
                  </h2>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Contraseña actual
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Confirmar nueva contraseña
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="rounded-xl bg-[#0B1120] px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {savingPassword
                    ? "Actualizando..."
                    : "Actualizar contraseña"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      <ServiceReceiptModal
        order={receiptOrder}
        onClose={() => setReceiptOrder(null)}
      />

      {/* MODAL DE DIÁLOGO Y COTIZACIÓN PREVIA CON EL CLIENTE */}
      {chatRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4"
          onClick={() => setChatRequest(null)}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[88vh] max-h-[680px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 p-4 sm:p-5 bg-[#0B1120] text-white flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[11px] font-bold text-blue-300">
                  <MessageSquare className="w-3 h-3" />
                  Diálogo y Cotización Previa • FX-
                  {String(chatRequest.id).padStart(4, "0")}
                </span>
                <h3 className="mt-1 text-base sm:text-lg font-extrabold">
                  {chatRequest.title}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Cliente: {chatRequest.client?.name ?? "Cliente Fixora"} • Zona:{" "}
                  {chatRequest.approx_zone || "Local"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChatRequest(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                <strong className="text-slate-800">Detalle solicitado:</strong>{" "}
                {chatRequest.description}
                <PhotoGallery
                  photos={chatRequest.photos}
                  title="Evidencia enviada por el cliente"
                />
              </div>

              <div className="p-4 sm:p-5 space-y-3">
                {loadingChat ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    Cargando conversación...
                  </p>
                ) : chatMessages.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm font-bold text-slate-700">
                      Inicia el diálogo con el cliente
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Haz preguntas sobre materiales, fallas o envía tu propuesta
                      de cotización en MXN antes de aceptar la solicitud.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMe = msg.actor_role === "technician";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isMe ? "items-end" : "items-start"
                        }`}
                      >
                        <span className="text-[11px] font-semibold text-slate-400 mb-1 px-1">
                          {isMe ? "Tú (Técnico)" : msg.actor_name}
                        </span>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm ${
                            isMe
                              ? "bg-[#1D63ED] text-white"
                              : "bg-slate-100 text-slate-800 border border-slate-200"
                          }`}
                        >
                          {msg.proposed_price !== null &&
                            msg.proposed_price !== undefined && (
                              <div
                                className={`mb-1.5 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                                  isMe
                                    ? "bg-white/20 text-white"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Cotización propuesta: $
                                {Number(msg.proposed_price).toFixed(2)} MXN
                              </div>
                            )}
                          <p className="leading-relaxed">{msg.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <form
              onSubmit={handleSendNegotiationMessage}
              className="shrink-0 p-4 bg-slate-50 border-t border-slate-200 space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="sm:w-40">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Precio cotizado (MXN)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={quoteAmount}
                      onChange={(e) => setQuoteAmount(e.target.value)}
                      placeholder="Ej. 850"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Mensaje o aclaración para el cliente *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      autoFocus
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Escribe tu cotización o pregunta..."
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#1D63ED] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sendingChat || !chatInput.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B1120] px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar
                    </button>
                  </div>
                </div>
              </div>

              {normalizeStatus(chatRequest.status) === "Pendiente" && (
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    ¿Ya acordaron el precio y alcance?
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAction(chatRequest.id, "accept")}
                    className="rounded-xl bg-[#1D63ED] px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    Aceptar solicitud ahora
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TechDashboardPage;