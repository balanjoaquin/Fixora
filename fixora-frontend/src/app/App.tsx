import { ToastBanner } from "@/components/common/ToastBanner";
import { ForgotPasswordModal } from "@/components/modals/ForgotPasswordModal";
import { RequestServiceModal } from "@/components/modals/RequestServiceModal";
import { SupportAndLegalModal } from "@/components/modals/SupportAndLegalModal";
import { TechnicianDetailModal } from "@/components/modals/TechnicianDetailModal";
import { NavigationProvider, useNav } from "@/context/NavigationContext";
import { EmailVerifiedPage } from "@/pages/auth/EmailVerifiedPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { ClientDashboardPage } from "@/pages/client/ClientDashboardPage";
import { ClientLandingPage } from "@/pages/client/ClientLandingPage";
import { ClientLoginPage } from "@/pages/client/ClientLoginPage";
import { ClientRegisterPage } from "@/pages/client/ClientRegisterPage";
import { TechDashboardPage } from "@/pages/technician/TechDashboardPage";
import { TechLandingPage } from "@/pages/technician/TechLandingPage";
import { TechLoginPage } from "@/pages/technician/TechLoginPage";
import { TechRegisterPage } from "@/pages/technician/TechRegisterPage";

function FixoraRouter() {
  const { page, modal, isRestoringSession } = useNav();

  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-[#0B1120]">
        <div className="bg-white border-2 border-[#0B1120] shadow-[4px_4px_0px_#0B1120] px-6 py-4 font-mono text-xs font-bold uppercase tracking-wider">
          Verificando sesión...
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case "email-verified":
        return <EmailVerifiedPage />;
      case "reset-password":
        return <ResetPasswordPage />;
      case "client-login":
        return <ClientLoginPage />;
      case "client-register":
        return <ClientRegisterPage />;
      case "client-dashboard":
        return <ClientDashboardPage />;
      case "tech-landing":
        return <TechLandingPage />;
      case "tech-login":
        return <TechLoginPage />;
      case "tech-register":
        return <TechRegisterPage />;
      case "tech-dashboard":
        return <TechDashboardPage />;
      case "home":
      default:
        return <ClientLandingPage />;
    }
  };

  return (
    <>
      {renderPage()}

      {modal.type === "request-service" && (
        <RequestServiceModal
          key={`req-${modal.technician?.id ?? "none"}-${modal.defaultSpecialty ?? ""}`}
          defaultSpecialty={modal.defaultSpecialty}
          technician={modal.technician}
        />
      )}

      {modal.type === "technician-detail" && (
        <TechnicianDetailModal
          key={`detail-${modal.technician.id}`}
          technician={modal.technician}
        />
      )}

      {modal.type === "forgot-password" && (
        <ForgotPasswordModal role={modal.role} />
      )}

      {modal.type === "info-doc" && (
        <SupportAndLegalModal doc={modal.doc} />
      )}

      <ToastBanner />
    </>
  );
}

export default function App() {
  return (
    <NavigationProvider>
      <FixoraRouter />
    </NavigationProvider>
  );
}