"use client";

import { useState } from "react";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileSidebar from "./MobileSidebar";
import AuthGuard from "../auth/AuthGuard";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AuthGuard>
      <div
        className={`min-h-screen overflow-x-hidden bg-[#F4EBDD] ${
          mobileMenuOpen ? "overflow-hidden lg:overflow-auto" : ""
        }`}
      >
        <Sidebar />

        <MobileSidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        <div className="min-w-0 lg:pl-64">
          <Topbar
            onMenuClick={() => setMobileMenuOpen(true)}
          />

          <main>{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}