"use client";

import { useEffect } from "react";
import { useResources } from "@/contexts/ResourcesContext";

const ICON_NORMAL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%232563EB'/%3E%3Cpath d='M20 60 L38 42 L52 54 L80 26' stroke='white' stroke-width='8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

const ICON_ALERT =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%232563EB'/%3E%3Cpath d='M20 60 L38 42 L52 54 L80 26' stroke='white' stroke-width='8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='82' cy='18' r='17' fill='%23DC2626' stroke='white' stroke-width='4'/%3E%3C/svg%3E";

// No visual output of its own — just keeps the browser tab (title +
// favicon) reflecting live anomaly state, so BurnWatch is still
// legible as "something's wrong" even when the tab isn't focused.
export default function TabStatus() {
  const { flagged } = useResources();

  useEffect(() => {
    const count = flagged.length;
    document.title = count > 0 ? `(${count}) Anomaly detected · BurnWatch` : "BurnWatch";

    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = count > 0 ? ICON_ALERT : ICON_NORMAL;
  }, [flagged.length]);

  return null;
}
