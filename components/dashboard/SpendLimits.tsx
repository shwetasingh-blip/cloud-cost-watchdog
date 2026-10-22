"use client";

import { useState } from "react";
import { useResources } from "@/contexts/ResourcesContext";
import { formatCurrency } from "@/lib/format";
import type { Guardrail } from "@/lib/guardrails";

function LimitRow({ resourceId, name, provider, isCustom }: { resourceId: string; name: string; provider: string; isCustom: boolean }) {
  const { guardrails, handleSetGuardrail, handleClearGuardrail } = useResources();
  const existing = guardrails[resourceId];
  const [draft, setDraft] = useState(existing ? String(existing.thresholdDollars) : "");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const value = Number(draft);
    if (!draft.trim() || !Number.isFinite(value) || value <= 0) {
      setError("Enter a limit greater than $0.");
      return;
    }
    setError(null);
    const guardrail: Guardrail = {
      resourceId,
      thresholdDollars: value,
      enabled: true,
      hardStopEnabled: existing?.hardStopEnabled && isCustom ? true : false,
    };
    handleSetGuardrail(guardrail);
  };

  const clear = () => {
    setDraft("");
    setError(null);
    handleClearGuardrail(resourceId);
  };

  const toggleHardStop = () => {
    if (!isCustom) return;
    const value = Number(draft || existing?.thresholdDollars || 0);
    if (!existing && (!draft.trim() || value <= 0)) {
      setError("Set a limit first, then turn on auto-stop.");
      return;
    }
    const guardrail: Guardrail = {
      resourceId,
      thresholdDollars: existing ? existing.thresholdDollars : value,
      enabled: true,
      hardStopEnabled: !(existing?.hardStopEnabled ?? false),
    };
    handleSetGuardrail(guardrail);
  };

  return (
    <div className="limit-row">
      <div className="limit-row__name">
        <span className="settings-row__name">{name}</span>
        <span className="settings-row__detail">{provider}</span>
      </div>

      <div className="limit-row__input">
        <span className="limit-row__dollar">$</span>
        <input
          type="number"
          min="1"
          step="1"
          placeholder="No limit"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
        />
        <span className="limit-row__perday">/day</span>
      </div>

      <div className="limit-row__actions">
        <button className="btn-secondary" onClick={save}>
          {existing ? "Update" : "Set"}
        </button>
        {existing && (
          <button className="btn-table-remove" onClick={clear}>
            Clear
          </button>
        )}
      </div>

      <div className="limit-row__autostop">
        {isCustom ? (
          <label className="limit-row__toggle">
            <input type="checkbox" checked={existing?.hardStopEnabled ?? false} onChange={toggleHardStop} />
            <span>Auto-stop on breach</span>
          </label>
        ) : (
          <span className="limit-row__autostop-na">Auto-stop not available for built-in services</span>
        )}
      </div>

      {error && <p className="add-service__error">{error}</p>}
      {existing && (
        <p className="limit-row__status">
          Limit set: {formatCurrency(existing.thresholdDollars)}/day
          {existing.hardStopEnabled ? " · auto-stop ON" : " · alert only"}
        </p>
      )}
    </div>
  );
}

export default function SpendLimits() {
  const { resources } = useResources();

  if (resources.length === 0) {
    return <div className="table-empty">No connected services yet.</div>;
  }

  return (
    <div className="limit-list">
      {resources.map((r) => (
        <LimitRow key={r.id} resourceId={r.id} name={r.name} provider={r.provider} isCustom={Boolean(r.isCustom)} />
      ))}
    </div>
  );
}
