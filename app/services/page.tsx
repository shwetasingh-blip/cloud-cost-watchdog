"use client";

import PageShell from "@/components/dashboard/PageShell";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { useResources } from "@/contexts/ResourcesContext";
import { CATEGORY_LABELS, type Category } from "@/lib/mockData";

export default function ServicesPage() {
  const { resources } = useResources();
  const order: Category[] = ["ai", "cloud", "other"];
  const groups = order
    .map((cat) => ({ category: cat, items: resources.filter((r) => r.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <PageShell title="Connected Services" subtitle="Every account this dashboard is watching">
      {groups.map((group) => (
        <section className="panel" key={group.category}>
          <div className="panel__head">
            <h2 className="panel__title">{CATEGORY_LABELS[group.category]}</h2>
            <span className="panel__meta">{group.items.length} service{group.items.length === 1 ? "" : "s"}</span>
          </div>
          <ServiceTable resources={group.items} />
        </section>
      ))}
    </PageShell>
  );
}
