import React, { useState } from "react";
import { Menu, User, Wrench, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NotificationsBell } from "@/components/common/NotificationsBell";
import { useNav } from "@/context/NavigationContext";
import logoFixora from "@/imports/Logo_fixora.png";

export interface DashboardNavItem<T extends string = string> {
  id: T;
  label: string;
  icon: LucideIcon;
  badgeCount?: number;
}

interface DashboardShellProps<T extends string = string> {
  role: "client" | "technician";
  navItems: DashboardNavItem<T>[];
  activeTab: T;
  onSelectTab: (tab: T) => void;
  onLogout?: () => void;
  accountTitle: string;
  accountSubtitle?: string;
  children: React.ReactNode;
}

export function DashboardShell<T extends string = string>({
  role,
  navItems,
  activeTab,
  onSelectTab,
  accountTitle,
  accountSubtitle,
  children,
}: DashboardShellProps<T>) {
  const { go } = useNav();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentLabel =
    navItems.find((item) => item.id === activeTab)?.label ?? "Panel";

  const handleSelect = (id: T) => {
    onSelectTab(id);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Barra lateral limpia (Cerrar sesión ahora vive dentro de Mi Perfil) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-[#E2E8F0] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              type="button"
              onClick={() => go("home")}
              aria-label="Ir al inicio de Fixora"
              className="flex items-center focus:outline-none cursor-pointer"
            >
              <img
                src={logoFixora}
                alt="Fixora"
                className="h-9 w-auto object-contain"
              />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tarjeta de cuenta */}
          <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
              {role === "technician" ? <Wrench size={18} /> : <User size={18} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0F172A] truncate">
                {accountTitle}
              </p>
              {accountSubtitle && (
                <p className="text-xs text-[#64748B] truncate">
                  {accountSubtitle}
                </p>
              )}
            </div>
          </div>

          {/* Navegación */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[#2563EB] text-white shadow-xs"
                      : "text-[#475569] hover:bg-slate-100 hover:text-[#0F172A]"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} />
                    {item.label}
                  </span>

                  {typeof item.badgeCount === "number" && item.badgeCount > 0 && (
                    <span
                      className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-[#EFF6FF] text-[#2563EB]"
                      }`}
                    >
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
              aria-label="Abrir menú"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-base font-extrabold text-[#0F172A]">
              {currentLabel}
            </h1>
          </div>

          <NotificationsBell
            onNavigateTarget={(target) => onSelectTab(target as T)}
          />
        </header>

        <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}