"use client";

import { useEffect, useState } from "react";

type Checkpoint = {
  id: string;
  name: string;
  position: number;
  total: number;
  provider: "linkvertise" | "lootlabs";
  url: string;
};

type StartResponse = {
  sessionId: string;
  checkpoint: Checkpoint;
};

type KeyResponse = {
  key: string;
  expiresAt?: string;
  existing?: boolean;
};

export default function KeyFlow() {
  const [state, setState] = useState<StartResponse | null>(null);
  const [key, setKey] = useState("");
  const [existingKey, setExistingKey] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  async function start() {
    setLoading(true);
    setError("");
    setState(null);
    setKey("");
    setExistingKey(false);
    setCopyMessage("");

    try {
      const res = await fetch("/api/checkpoints/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Unable to start.");
        return;
      }

      // Browser ini sudah memiliki key aktif.
      if (typeof data.key === "string" && data.key.length > 0) {
        setKey(data.key);
        setExistingKey(data.existing === true);
        return;
      }

      if (data.sessionId && data.checkpoint) {
        setState(data as StartResponse);
        return;
      }

      setError("Invalid response from server. Please try again.");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resume(sessionId: string) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/checkpoints/status?session=${encodeURIComponent(sessionId)}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "This session has expired. Start again.");
        return;
      }

      if (typeof data.key === "string" && data.key.length > 0) {
        setKey(data.key);
        setExistingKey(false);
        return;
      }

      if (data.checkpoint) {
        setState({ sessionId, checkpoint: data.checkpoint });
        return;
      }

      setError("Could not resume this checkpoint session. Please start again.");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(key);
      setCopyMessage("Key copied!");
    } catch {
      setCopyMessage("Could not copy automatically. Please select and copy the key.");
    }
  }

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session");

    if (sessionId) {
      void resume(sessionId);
    } else {
      void start();
    }
  }, []);

  if (key) {
    return (
      <section
        className="card center"
        style={{ maxWidth: 700, margin: "50px auto" }}
      >
        <p className="muted">Your RenzyHub key</p>
        <h1>{existingKey ? "Welcome back!" : "Key generated"}</h1>
        <p className="muted">
          {existingKey
            ? "Your existing key is still active. You do not need to repeat the checkpoints."
            : "Your key is ready to use."}
        </p>

        <div className="code">{key}</div>

        <div
          className="row"
          style={{ justifyContent: "center", marginTop: 18 }}
        >
          <button className="btn primary" onClick={() => void copyKey()}>
            Copy key
          </button>
          <a className="btn" href="/">
            Done
          </a>
        </div>

        {copyMessage && <p className="muted">{copyMessage}</p>}
      </section>
    );
  }

  if (loading && !state) {
    return (
      <section
        className="card center"
        style={{ maxWidth: 700, margin: "50px auto" }}
      >
        Starting checkpoint…
      </section>
    );
  }

  if (error && !state) {
    return (
      <section
        className="card center"
        style={{ maxWidth: 700, margin: "50px auto" }}
      >
        <h2>Something went wrong</h2>
        <p className="muted">{error}</p>
        <button className="btn primary" onClick={() => void start()}>
          Try again
        </button>
      </section>
    );
  }

  if (!state) return null;

  return (
    <CheckpointWatcher
      state={state}
      onComplete={(next) => {
        if ("key" in next) {
          setKey(next.key);
          setExistingKey(false);
        } else {
          setState(next);
        }
      }}
    />
  );
}

function CheckpointWatcher({
  state,
  onComplete,
}: {
  state: StartResponse;
  onComplete: (next: StartResponse | KeyResponse) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setChecking(true);
    setMessage("");

    try {
      const res = await fetch(
        `/api/checkpoints/status?session=${encodeURIComponent(state.sessionId)}`,
        { cache: "no-store" }
      );

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error ?? "Could not check status.");
        return;
      }

      if (typeof data.key === "string" && data.key.length > 0) {
        onComplete({ key: data.key });
        return;
      }

      if (data.checkpoint) {
        onComplete({
          sessionId: state.sessionId,
          checkpoint: data.checkpoint,
        });
        return;
      }

      setMessage(
        data.completed === false
          ? "Complete the checkpoint first."
          : "Waiting for verification…"
      );
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="card" style={{ maxWidth: 700, margin: "50px auto" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="muted">
            Checkpoint {state.checkpoint.position} of {state.checkpoint.total}
          </p>
          <h2>{state.checkpoint.name}</h2>
        </div>
        <span className="badge">
          {state.checkpoint.provider} · {state.checkpoint.position}/
          {state.checkpoint.total}
        </span>
      </div>

      <div className="progress" style={{ margin: "18px 0 26px" }}>
        <div
          style={{
            width: `${
              (state.checkpoint.position / state.checkpoint.total) * 100
            }%`,
          }}
        />
      </div>

      <p className="muted">
        {state.checkpoint.provider === "linkvertise"
          ? "Open the Linkvertise checkpoint, complete its flow, then return here."
          : "Open the LootLabs checkpoint. After the required task is completed, LootLabs will notify the server automatically."}
      </p>

      <div className="row">
        <a
          className="btn primary"
          href={state.checkpoint.url}
          target="_blank"
          rel="noreferrer"
        >
          Open {state.checkpoint.provider}
        </a>

        <button
          className="btn"
          disabled={checking}
          onClick={() => void refresh()}
        >
          {checking ? "Checking…" : "Check completion"}
        </button>
      </div>

      {message && (
        <p className="muted" style={{ marginTop: 18 }}>
          {message}
        </p>
      )}
    </section>
  );
}
