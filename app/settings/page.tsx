"use client";

import PageShell from "@/components/dashboard/PageShell";
import SpendLimits from "@/components/dashboard/SpendLimits";
import { useResources } from "@/contexts/ResourcesContext";
import { COMPANY_MONTHLY_BURN } from "@/lib/mockData";
import { formatCurrency } from "@/lib/format";

const ACCOUNTS = [
  { id: "aws", name: "AWS", detail: "Billing + Cost Explorer" },
  { id: "openai", name: "OpenAI", detail: "Usage & billing API" },
  { id: "anthropic", name: "Anthropic", detail: "Usage & billing API" },
  { id: "vercel", name: "Vercel", detail: "Project usage" },
];

export default function SettingsPage() {
  const { handleDisconnect } = useResources();

  return (
    <PageShell title="Settings" subtitle="Connected accounts and configuration">
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Connected accounts</h2>
        </div>
        <div className="settings-list">
          {ACCOUNTS.map((a) => (
            <div className="settings-row" key={a.id}>
              <span className="provider-chip">{a.name.slice(0, 1)}</span>
              <div className="settings-row__body">
                <span className="settings-row__name">{a.name}</span>
                <span className="settings-row__detail">{a.detail}</span>
              </div>
              <span className="status-badge status-badge--good">Connected</span>
            </div>
          ))}
        </div>
        <div className="settings-footer">
          <button className="btn-secondary" onClick={handleDisconnect}>
            Disconnect all &amp; restart onboarding
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Configuration</h2>
        </div>
        <div className="settings-list">
          <div className="settings-row">
            <div className="settings-row__body">
              <span className="settings-row__name">Monthly burn rate</span>
              <span className="settings-row__detail">Used to translate overspend into days of runway</span>
            </div>
            <span className="settings-row__value tabular">{formatCurrency(COMPANY_MONTHLY_BURN)}/mo</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Spend limits</h2>
          <span className="panel__meta">Alerts only, unless you turn on auto-stop</span>
        </div>
        <p className="settings-section-note">
          Breaching a limit always alerts you first, the same way an anomaly does. Auto-stop — pausing a service
          with no tap from you — is only ever available on platforms you've added yourself, and only once you
          turn it on here.
        </p>
        <SpendLimits />
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Alert channels</h2>
          <span className="panel__meta">Where BurnWatch notifies you</span>
        </div>
        <div className="settings-list">
          <div className="settings-row">
            <div className="settings-row__body">
              <span className="settings-row__name">In-app</span>
              <span className="settings-row__detail">
                Anomalies and spend-limit breaches show up here, on the Overview and Anomalies pages, the moment
                they&apos;re detected.
              </span>
            </div>
            <span className="status-badge status-badge--good">Always on</span>
          </div>
          <div className="settings-row settings-row--disabled">
            <div className="settings-row__body">
              <span className="settings-row__name">Slack</span>
              <span className="settings-row__detail">
                Not connected yet — breaches and anomalies don&apos;t post to Slack today. Tell us if you want this
                wired up and we&apos;ll build it.
              </span>
            </div>
            <label className="limit-row__toggle limit-row__toggle--disabled">
              <input type="checkbox" checked={false} disabled readOnly />
              <span>Coming soon</span>
            </label>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
