"use client";

import { useEffect, useState } from "react";

type KeyRow = {
  id: string; key_prefix: string; created_at: string; expires_at: string; revoked_at: string | null;
};

export default function AdminPanel() {
  const [logged, setLogged] = useState<boolean | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [duration, setDuration] = useState("86400");
  const [systemId, setSystemId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/admin/keys", { cache: "no-store" });
    if (res.status === 401) return setLogged(false);
    const data = await res.json();
    setLogged(true);
    setKeys(data.keys);
    if (data.systemId) setSystemId(data.systemId);
  }

  useEffect(() => { load(); }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/login", {
      method: "POST", headers: {"content-type":"application/json"},
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "Login failed");
    setPassword(""); setMessage("Logged in"); load();
  }

  async function generate() {
    setMessage("");
    const res = await fetch("/api/admin/keys", {
      method: "POST", headers: {"content-type":"application/json"},
      body: JSON.stringify({ systemId, durationSeconds: Number(duration) })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "Generation failed");
    setMessage(`Generated: ${data.key}`);
    load();
  }

  async function revoke(id: string) {
    const res = await fetch("/api/admin/keys/revoke", {
      method: "POST", headers: {"content-type":"application/json"},
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error ?? "Revoke failed");
    load();
  }

  if (logged === null) return <div className="card" style={{marginTop:50}}>Loading…</div>;

  if (!logged) {
    return (
      <section className="card" style={{maxWidth:420, margin:"80px auto"}}>
        <h1>Admin</h1>
        <form className="stack" onSubmit={login}>
          <label className="label">Username<input className="input" value={username} onChange={e=>setUsername(e.target.value)} /></label>
          <label className="label">Password<input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
          <button className="btn primary">Login</button>
        </form>
        {message && <p className="muted">{message}</p>}
      </section>
    );
  }

  return (
    <>
      <nav className="nav"><div className="brand">Renzy<span>Hub</span> Admin</div></nav>
      <section className="grid grid2">
        <div className="card">
          <h2>Generate key</h2>
          <label className="label">System ID<input className="input" value={systemId} onChange={e=>setSystemId(e.target.value)} /></label>
          <label className="label">Duration (seconds)<input className="input" value={duration} onChange={e=>setDuration(e.target.value)} /></label>
          <button className="btn primary" style={{marginTop:8}} onClick={generate}>Generate</button>
          {message && <p className="muted">{message}</p>}
        </div>
        <div className="card">
          <h2>API</h2>
          <p className="muted">Validate keys from your RenzyHub library using <code>/api/keys/validate</code>.</p>
        </div>
      </section>

      <section className="card" style={{marginTop:20}}>
        <h2>Keys</h2>
        <div style={{overflowX:"auto"}}>
          <table className="table">
            <thead><tr><th>Prefix</th><th>Created</th><th>Expires</th><th>Status</th><th /></tr></thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id}>
                  <td>{k.key_prefix}…</td>
                  <td>{new Date(k.created_at).toLocaleString()}</td>
                  <td>{new Date(k.expires_at).toLocaleString()}</td>
                  <td>{k.revoked_at ? <span className="badge danger">Revoked</span> : new Date(k.expires_at) <= new Date() ? <span className="badge danger">Expired</span> : <span className="badge success">Active</span>}</td>
                  <td>{!k.revoked_at && <button className="btn danger" onClick={()=>revoke(k.id)}>Revoke</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}