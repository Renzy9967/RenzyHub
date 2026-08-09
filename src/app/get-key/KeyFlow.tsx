"use client";

import { useEffect, useState } from "react";

type StartResponse = {
  sessionId: string;
  checkpoint: { id: string; name: string; position: number; total: number; url: string };
};

export default function KeyFlow() {
  const [state, setState] = useState<StartResponse | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/checkpoints/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Unable to start.");
    setState(data);
  }

  useEffect(() => { start(); }, []);

  if (key) {
    return (
      <section className="card center" style={{ maxWidth: 700, margin: "50px auto" }}>
        <p className="muted">Your RenzyHub key</p>
        <h1>Key generated</h1>
        <div className="code">{key}</div>
        <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
          <button className="btn primary" onClick={() => navigator.clipboard.writeText(key)}>Copy key</button>
          <a className="btn" href="/">Done</a>
        </div>
      </section>
    );
  }

  if (loading && !state) {
    return <section className="card center" style={{ maxWidth: 700, margin: "50px auto" }}>Starting checkpoint…</section>;
  }

  if (error) {
    return <section className="card center" style={{ maxWidth: 700, margin: "50px auto" }}>
      <h2>Something went wrong</h2><p className="muted">{error}</p>
      <button className="btn primary" onClick={start}>Try again</button>
    </section>;
  }

  if (!state) return null;

  return (
    <CheckpointWatcher
      state={state}
      onComplete={(next) => {
        if ("key" in next) setKey(next.key);
        else setState(next);
      }}
    />
  );
}

function CheckpointWatcher({
  state,
  onComplete,
}: {
  state: StartResponse;
  onComplete: (next: StartResponse | { key: string }) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    setChecking(true);
    const res = await fetch(`/api/checkpoints/status?session=${encodeURIComponent(state.sessionId)}`, { cache: "no-store" });
    const data = await res.json();
    setChecking(false);

    if (!res.ok) return setMessage(data.error ?? "Could not check status.");
    if (data.key) return onComplete({ key: data.key });
    if (data.checkpoint) {
      return onComplete({
        sessionId: state.sessionId,
        checkpoint: data.checkpoint,
      });
    }
    setMessage("Complete the checkpoint first.");
  };

  return (
    <section className="card" style={{ maxWidth: 700, margin: "50px auto" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="muted">Checkpoint {state.checkpoint.position} of {state.checkpoint.total}</p>
          <h2>{state.checkpoint.name}</h2>
        </div>
        <span className="badge">{state.checkpoint.position}/{state.checkpoint.total}</span>
      </div>

      <div className="progress" style={{ margin: "18px 0 26px" }}>
        <div style={{ width: `${(state.checkpoint.position / state.checkpoint.total) * 100}%` }} />
      </div>

      <p className="muted">
        Open the Linkvertise checkpoint, complete its required flow, then return here.
      </p>

      <div className="row">
        <a className="btn primary" href={state.checkpoint.url}>Open checkpoint</a>
        <button className="btn" disabled={checking} onClick={refresh}>
          {checking ? "Checking…" : "I've completed it"}
        </button>
      </div>

      {message && <p className="muted" style={{ marginTop: 18 }}>{message}</p>}
    </section>
  );
}