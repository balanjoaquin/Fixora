import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  ActiveModal,
  AuthUser,
  PageRoute,
  ServiceRequestItem,
  ServiceStatus,
  ToastNotice,
} from "@/types";
import { getCurrentUser } from "@/services/api";

const TOKEN_KEY = "fixora_token";

interface NavigationContextValue {
  page: PageRoute;
  go: (target: PageRoute) => void;
  user: AuthUser | null;
  setUser: Dispatch<SetStateAction<AuthUser | null>>;
  refreshUser: () => Promise<AuthUser | null>;
  isRestoringSession: boolean;
  logoutLocal: (redirectTo?: PageRoute) => void;
  selectedSpecialty: string;
  setSelectedSpecialty: (specialty: string) => void;
  modal: ActiveModal;
  openModal: (modal: ActiveModal) => void;
  closeModal: () => void;
  toasts: ToastNotice[];
  showToast: (toast: Omit<ToastNotice, "id">) => void;
  dismissToast: (id: string) => void;
  requests: ServiceRequestItem[];
  addRequest: (
    item: Omit<ServiceRequestItem, "id" | "folio" | "status" | "createdAt">
  ) => ServiceRequestItem;
  updateRequestStatus: (id: string, status: ServiceStatus) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

function resolveInitialPage(): PageRoute {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/email-verified") {
    return "email-verified";
  }

  if (pathname === "/reset-password") {
    return "reset-password";
  }

  return "home";
}

function extractAuthUser(payload: unknown): AuthUser | null {
  if (!payload || typeof payload !== "object") return null;

  const root = payload as Record<string, unknown>;
  const level1 =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const candidate =
    level1.user && typeof level1.user === "object"
      ? (level1.user as Record<string, unknown>)
      : level1;

  if (typeof candidate.id === "number" && typeof candidate.role === "string") {
    return candidate as unknown as AuthUser;
  }

  return null;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const initialPage = resolveInitialPage();
  const isSpecialAuthLink =
    initialPage === "email-verified" || initialPage === "reset-password";

  const [page, setPage] = useState<PageRoute>(initialPage);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => {
    if (isSpecialAuthLink) return false;
    return Boolean(localStorage.getItem(TOKEN_KEY));
  });

  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("");
  const [modal, setModal] = useState<ActiveModal>({ type: "none" });
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [requests, setRequests] = useState<ServiceRequestItem[]>([]);

  const pageRef = useRef<PageRoute>(page);
  const userRef = useRef<AuthUser | null>(user);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    try {
      const response = await getCurrentUser();
      const currentUser = extractAuthUser(response.data);
      if (currentUser && currentUser.role !== "admin") {
        setUser(currentUser);
        return currentUser;
      }
    } catch {
      // Mantiene estado actual si falla temporalmente la red
    }
    return userRef.current;
  }, []);

  const go = useCallback((target: PageRoute) => {
    if (
      target !== "email-verified" &&
      target !== "reset-password" &&
      (window.location.pathname === "/email-verified" ||
        window.location.pathname === "/reset-password")
    ) {
      window.history.replaceState({}, "", "/");
    }

    setPage(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const logoutLocal = useCallback(
    (redirectTo?: PageRoute) => {
      localStorage.removeItem(TOKEN_KEY);
      const isTechContext =
        userRef.current?.role === "technician" ||
        pageRef.current.startsWith("tech-");

      setUser(null);
      go(redirectTo ?? (isTechContext ? "tech-login" : "client-login"));
    },
    [go]
  );

  // 1) Restaurar sesión al recargar (F5) si existe fixora_token
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setIsRestoringSession(false);
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        const response = await getCurrentUser();
        const currentUser = extractAuthUser(response.data);

        if (!isMounted) return;

        if (!currentUser || currentUser.role === "admin") {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
          if (!isSpecialAuthLink) {
            go("client-login");
          }
          return;
        }

        setUser(currentUser);

        if (!isSpecialAuthLink) {
          go(
            currentUser.role === "technician"
              ? "tech-dashboard"
              : "client-dashboard"
          );
        }
      } catch {
        if (!isMounted) return;
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        if (!isSpecialAuthLink) {
          go("home");
        }
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isSpecialAuthLink, go]);

  // 2) Sincronizar usuario automáticamente al volver a la pestaña (ej. tras verificar correo)
  useEffect(() => {
    const syncOnFocus = () => {
      if (localStorage.getItem(TOKEN_KEY) && userRef.current && !userRef.current.email_verified_at) {
        void refreshUser();
      }
    };

    window.addEventListener("focus", syncOnFocus);
    return () => {
      window.removeEventListener("focus", syncOnFocus);
    };
  }, [refreshUser]);

  // 3) Escuchar evento global "fixora:unauthorized" del interceptor 401 de api.ts
  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(TOKEN_KEY);

      const isTechContext =
        userRef.current?.role === "technician" ||
        pageRef.current.startsWith("tech-");

      setUser(null);
      setIsRestoringSession(false);
      go(isTechContext ? "tech-login" : "client-login");
    };

    window.addEventListener("fixora:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("fixora:unauthorized", handleUnauthorized);
    };
  }, [go]);

  const openModal = useCallback((next: ActiveModal) => {
    setModal(next);
  }, []);

  const closeModal = useCallback(() => {
    setModal({ type: "none" });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastNotice, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast]
  );

  const addRequest = useCallback(
    (
      item: Omit<ServiceRequestItem, "id" | "folio" | "status" | "createdAt">
    ): ServiceRequestItem => {
      let createdItem!: ServiceRequestItem;
      setRequests((prev) => {
        const seq = String(prev.length + 1).padStart(4, "0");
        createdItem = {
          ...item,
          id: `req-${Date.now()}`,
          folio: `FX-${seq}`,
          status: "Pendiente",
          createdAt: new Date().toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        };
        return [createdItem, ...prev];
      });
      return createdItem;
    },
    []
  );

  const updateRequestStatus = useCallback((id: string, status: ServiceStatus) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status } : req))
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modal.type !== "none") {
        closeModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal.type, closeModal]);

  return (
    <NavigationContext.Provider
      value={{
        page,
        go,
        user,
        setUser,
        refreshUser,
        isRestoringSession,
        logoutLocal,
        selectedSpecialty,
        setSelectedSpecialty,
        modal,
        openModal,
        closeModal,
        toasts,
        showToast,
        dismissToast,
        requests,
        addRequest,
        updateRequestStatus,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNav(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNav debe usarse dentro de NavigationProvider");
  }
  return ctx;
}