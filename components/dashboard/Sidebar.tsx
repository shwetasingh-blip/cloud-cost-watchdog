"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, ChartIcon, AlertIcon, PlugIcon, GearIcon, XIcon } from "@/components/icons";
import { useResources } from "@/contexts/ResourcesContext";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: GridIcon },
  { href: "/cost-explorer", label: "Cost Explorer", icon: ChartIcon },
  { href: "/anomalies", label: "Anomalies", icon: AlertIcon },
  { href: "/services", label: "Connected Services", icon: PlugIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { flagged } = useResources();

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={open ? "sidebar sidebar--open" : "sidebar"}>
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <span className="sidebar__mark" aria-hidden="true">
              CW
            </span>
            <span className="sidebar__name">Cloud Cost Watchdog</span>
          </div>
          <button className="sidebar__close" onClick={onClose} aria-label="Close navigation">
            <XIcon size={18} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "sidebar__link sidebar__link--active" : "sidebar__link"}
                onClick={onClose}
              >
                <Icon size={16} className="sidebar__link-icon" />
                <span>{item.label}</span>
                {item.href === "/anomalies" && flagged.length > 0 && (
                  <span className="sidebar__badge">{flagged.length}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__foot">
          <span className="sidebar__foot-dot" aria-hidden="true" />
          <span>5 services monitored</span>
        </div>
      </aside>
    </>
  );
}
