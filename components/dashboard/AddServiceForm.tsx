"use client";

import { useState } from "react";
import type { Category, CustomServiceInput } from "@/lib/mockData";
import { CATEGORY_LABELS } from "@/lib/mockData";
import { PlusIcon } from "@/components/icons";

interface QuickPick {
  name: string;
  provider: string;
  category: Category;
}

const QUICK_PICKS: QuickPick[] = [
  { name: "Stripe", provider: "Stripe", category: "other" },
  { name: "Datadog", provider: "Datadog", category: "other" },
  { name: "Cloudflare", provider: "Cloudflare", category: "cloud" },
  { name: "MongoDB Atlas", provider: "MongoDB", category: "cloud" },
  { name: "Google Cloud", provider: "Google Cloud", category: "cloud" },
  { name: "Supabase", provider: "Supabase", category: "cloud" },
  { name: "Twilio", provider: "Twilio", category: "other" },
  { name: "Sentry", provider: "Sentry", category: "other" },
];

interface AddServiceFormProps {
  onAdd: (input: CustomServiceInput) => void;
}

export default function AddServiceForm({ onAdd }: AddServiceFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [dailySpend, setDailySpend] = useState("");
  const [billedInTokens, setBilledInTokens] = useState(false);
  const [costPerMillionTokens, setCostPerMillionTokens] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setProvider("");
    setCategory("other");
    setDailySpend("");
    setBilledInTokens(false);
    setCostPerMillionTokens("");
    setFormError(null);
  };

  const applyQuickPick = (pick: QuickPick) => {
    setName(pick.name);
    setProvider(pick.provider);
    setCategory(pick.category);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const spend = Number(dailySpend);

    if (!trimmedName) {
      setFormError("Give the platform a name.");
      return;
    }
    if (!Number.isFinite(spend) || spend <= 0) {
      setFormError("Enter a typical daily spend greater than $0.");
      return;
    }
    const tokenRate = Number(costPerMillionTokens);
    if (billedInTokens && (!Number.isFinite(tokenRate) || tokenRate <= 0)) {
      setFormError("Enter a $ per 1M tokens rate, or turn off token billing.");
      return;
    }

    onAdd({
      name: trimmedName,
      provider: provider.trim() || trimmedName,
      category,
      estimatedDailySpend: spend,
      billedInTokens,
      costPerMillionTokens: billedInTokens ? tokenRate : undefined,
    });

    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <PlusIcon size={14} />
        Add a platform
      </button>
    );
  }

  return (
    <form className="add-service" onSubmit={handleSubmit}>
      <div className="add-service__quickpicks">
        {QUICK_PICKS.map((pick) => (
          <button
            type="button"
            key={pick.name}
            className="add-service__chip"
            onClick={() => applyQuickPick(pick)}
          >
            {pick.name}
          </button>
        ))}
      </div>

      <div className="add-service__row">
        <label className="add-service__field">
          <span>Platform name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Snowflake"
            maxLength={60}
          />
        </label>
        <label className="add-service__field">
          <span>Provider (optional)</span>
          <input
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="Defaults to platform name"
            maxLength={40}
          />
        </label>
      </div>

      <div className="add-service__row">
        <label className="add-service__field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="add-service__field">
          <span>Typical daily spend ($)</span>
          <input
            type="number"
            min="1"
            step="1"
            value={dailySpend}
            onChange={(e) => setDailySpend(e.target.value)}
            placeholder="e.g. 60"
          />
        </label>
      </div>

      <label className="add-service__checkbox">
        <input type="checkbox" checked={billedInTokens} onChange={(e) => setBilledInTokens(e.target.checked)} />
        <span>Billed by token usage (shows a Usage column, like an AI API)</span>
      </label>

      {billedInTokens && (
        <label className="add-service__field">
          <span>$ per 1M tokens</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={costPerMillionTokens}
            onChange={(e) => setCostPerMillionTokens(e.target.value)}
            placeholder="e.g. 5"
          />
        </label>
      )}

      {formError && <p className="add-service__error">{formError}</p>}

      <div className="add-service__actions">
        <button type="submit" className="btn-simulate">
          Add platform
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
