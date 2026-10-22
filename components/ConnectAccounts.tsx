"use client";

import { useState } from "react";

interface AccountDef {
  id: string;
  name: string;
  detail: string;
}

const ACCOUNTS: AccountDef[] = [
  { id: "aws", name: "AWS", detail: "Billing + Cost Explorer" },
  { id: "openai", name: "OpenAI", detail: "Usage & billing API" },
  { id: "anthropic", name: "Anthropic", detail: "Usage & billing API" },
  { id: "vercel", name: "Vercel", detail: "Project usage" },
];

interface ConnectAccountsProps {
  onDone: () => void;
}

export default function ConnectAccounts({ onDone }: ConnectAccountsProps) {
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [connecting, setConnecting] = useState<string | null>(null);

  const allConnected = ACCOUNTS.every((a) => connected[a.id]);

  const handleConnect = (id: string) => {
    if (connected[id] || connecting) return;
    setConnecting(id);
    setTimeout(() => {
      setConnected((prev) => ({ ...prev, [id]: true }));
      setConnecting(null);
    }, 550);
  };

  return (
    <div className="connect">
      <div className="connect__card">
        <h1 className="connect__title">Connect your accounts</h1>
        <p className="connect__subtitle">
          We'll start watching your spend the moment you connect. Read-only access — nothing is changed
          without you tapping Pause yourself.
        </p>
        <div className="connect__list">
          {ACCOUNTS.map((a) => {
            const isConnected = connected[a.id];
            const isConnecting = connecting === a.id;
            return (
              <div className="connect__row" key={a.id}>
                <div className="connect__row-icon">{a.name.charAt(0)}</div>
                <div className="connect__row-body">
                  <div className="connect__row-name">{a.name}</div>
                  <div className="connect__row-detail">{a.detail}</div>
                </div>
                <button
                  className={isConnected ? "btn btn--connected" : "btn btn--connect"}
                  onClick={() => handleConnect(a.id)}
                  disabled={isConnected || isConnecting}
                >
                  {isConnected ? "Connected" : isConnecting ? "Connecting…" : "Connect"}
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn btn--continue" onClick={onDone} disabled={!allConnected}>
          Continue to dashboard
        </button>
      </div>
    </div>
  );
}
