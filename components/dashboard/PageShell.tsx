"use client";

import { useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ConnectAccounts from "@/components/ConnectAccounts";
import { useResources } from "@/contexts/ResourcesContext";

interface PageShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function PageShell({ title, subtitle, children }: PageShellProps) {
  const { connected, handleConnectDone } = useResources();
  const [navOpen, setNavOpen] = useState(false);

  if (connected === null) return null;

  if (!connected) {
    return <ConnectAccounts onDone={handleConnectDone} />;
  }

  return (
    <div className="shell">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="shell__main">
        <Header title={title} subtitle={subtitle} onMenuClick={() => setNavOpen(true)} />
        <div className="shell__content">{children}</div>
      </div>
    </div>
  );
}
