"use client";

import { useEffect, useState } from "react";

type KeyRow = { id:string; key_prefix:string; created_at:string; expires_at:string; revoked_at:string|null };
type SystemRow = { id:string; name:string };
type Checkpoint = { id:string; system_id:string; position:number; name:string; provider:"linkvertise"|"lootlabs"; url:string; enabled:boolean };

export default function AdminPanel() {
  const [logged, setLogged] = useState<boolean|null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [duration, setDuration] = useState("86400");
  const [systemId, setSystemId] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Checkpoint|null>(null);
  const [form, setForm] = useState({name:"Checkpoint", provider:"linkvertise" as "linkvertise"|"lootlabs", url:"", position:"", enabled:true});

  async function load() {
    const [kres, cres] = await Promise.all([
      fetch("/api/admin/keys",{cache:"no-store"}),
      fetch("/api/admin/checkpoints",{cache:"no-store"})
    ]);
    if (kres.status === 401 || cres.status === 401) return setLogged(false);
    const kd = await kres.json(), cd = await cres.json();
    setLogged(true); setKeys(kd.keys ?? []); setSystemId(kd.systemId ?? cd.systems?.[0]?.id ?? "");
    setSystems(cd.systems ?? []); setCheckpoints(cd.checkpoints ?? []);
  }
  useEffect(()=>{load()},[]);

  async function login(e:React.FormEvent) {
    e.preventDefault();
    const res=await fetch("/api/admin/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({username,password})});
    const data=await res.json(); if(!res.ok) return setMessage(data.error??"Login failed");
    setPassword(""); setMessage("Logged in"); load();
  }

  async function generate() {
    const res=await fetch("/api/admin/keys",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({systemId,durationSeconds:Number(duration)})});
    const data=await res.json(); setMessage(res.ok?`Generated: ${data.key}`:(data.error??"Generation failed")); load();
  }

  async function revoke(id:string) {
    const res=await fetch("/api/admin/keys/revoke",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id})});
    const data=await res.json(); if(!res.ok) setMessage(data.error??"Revoke failed"); load();
  }

  function resetForm() {
    setEditing(null);
    setForm({name:`Checkpoint ${checkpoints.length+1}`,provider:"linkvertise",url:"",position:String(checkpoints.length+1),enabled:true});
  }

  async function saveCheckpoint(e:React.FormEvent) {
    e.preventDefault(); setMessage("");
    const body={name:form.name,provider:form.provider,url:form.url,position:form.position?Number(form.position):undefined,enabled:form.enabled};
    const endpoint=editing?`/api/admin/checkpoints/${editing.id}`:"/api/admin/checkpoints";
    const res=await fetch(endpoint,{method:editing?"PATCH":"POST",headers:{"content-type":"application/json"},body:JSON.stringify(editing?body:{systemId,...body})});
    const data=await res.json();
    if(!res.ok) return setMessage(data.error??"Could not save checkpoint");
    setMessage(editing?"Checkpoint updated":"Checkpoint created"); resetForm(); load();
  }

  async function deleteCheckpoint(id:string) {
    if(!confirm("Delete this checkpoint?")) return;
    const res=await fetch(`/api/admin/checkpoints/${id}`,{method:"DELETE"});
    const data=await res.json(); if(!res.ok) setMessage(data.error??"Delete failed"); else setMessage("Checkpoint deleted");
    load();
  }

  if(logged===null) return <div className="card" style={{marginTop:50}}>Loading…</div>;
  if(!logged) return <section className="card" style={{maxWidth:420,margin:"80px auto"}}>
    <h1>Admin</h1><form className="stack" onSubmit={login}>
      <label className="label">Username<input className="input" value={username} onChange={e=>setUsername(e.target.value)}/></label>
      <label className="label">Password<input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="btn primary">Login</button>
    </form>{message&&<p className="muted">{message}</p>}
  </section>;

  return <main className="container">
    <nav className="nav"><div className="brand">Renzy<span>Hub</span> Admin</div></nav>

    <section className="grid grid2">
      <div className="card"><h2>Generate key</h2>
        <label className="label">System<select className="input" value={systemId} onChange={e=>setSystemId(e.target.value)}>{systems.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="label">Duration (seconds)<input className="input" value={duration} onChange={e=>setDuration(e.target.value)}/></label>
        <button className="btn primary" onClick={generate}>Generate</button>
        {message&&<p className="muted">{message}</p>}
      </div>
      <div className="card"><h2>Provider setup</h2><p className="muted">Linkvertise checkpoints are verified by the server. LootLabs checkpoints use the LootLabs server-to-server postback.</p></div>
    </section>

    <section className="card" style={{marginTop:20}}>
      <div className="row" style={{justifyContent:"space-between"}}><h2>Checkpoints</h2><button className="btn primary" onClick={resetForm}>+ Add checkpoint</button></div>
      <p className="muted">Order is controlled by Position. You can mix providers.</p>
      <div style={{overflowX:"auto"}}><table className="table"><thead><tr><th>#</th><th>Name</th><th>Provider</th><th>URL</th><th>Status</th><th/></tr></thead>
      <tbody>{checkpoints.filter(c=>c.system_id===systemId).map(c=><tr key={c.id}><td>{c.position}</td><td>{c.name}</td><td><span className="badge">{c.provider}</span></td><td style={{maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.url}</td><td>{c.enabled?<span className="badge success">Enabled</span>:<span className="badge danger">Disabled</span>}</td>
      <td><div className="row"><button className="btn" onClick={()=>{setEditing(c);setForm({name:c.name,provider:c.provider,url:c.url,position:String(c.position),enabled:c.enabled})}}>Edit</button><button className="btn danger" onClick={()=>deleteCheckpoint(c.id)}>Delete</button></div></td></tr>)}</tbody></table></div>

      <form className="card" style={{marginTop:18}} onSubmit={saveCheckpoint}>
        <h3>{editing?"Edit checkpoint":"Checkpoint editor"}</h3>
        <div className="grid grid2">
          <label className="label">Name<input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label className="label">Provider<select className="input" value={form.provider} onChange={e=>setForm({...form,provider:e.target.value as "linkvertise"|"lootlabs"})}><option value="linkvertise">Linkvertise</option><option value="lootlabs">LootLabs</option></select></label>
          <label className="label" style={{gridColumn:"1/-1"}}>Destination / monetized URL<input className="input" required value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://..."/></label>
          <label className="label">Position<input className="input" type="number" min="1" value={form.position} onChange={e=>setForm({...form,position:e.target.value})}/></label>
          <label className="label">Enabled<select className="input" value={form.enabled?"true":"false"} onChange={e=>setForm({...form,enabled:e.target.value==="true"})}><option value="true">Yes</option><option value="false">No</option></select></label>
        </div>
        <div className="row" style={{marginTop:12}}><button className="btn primary">{editing?"Save changes":"Create checkpoint"}</button>{editing&&<button type="button" className="btn" onClick={resetForm}>Cancel</button>}</div>
      </form>
    </section>

    <section className="card" style={{marginTop:20}}><h2>Keys</h2><div style={{overflowX:"auto"}}><table className="table"><thead><tr><th>Prefix</th><th>Created</th><th>Expires</th><th>Status</th><th/></tr></thead><tbody>
      {keys.map(k=><tr key={k.id}><td>{k.key_prefix}…</td><td>{new Date(k.created_at).toLocaleString()}</td><td>{new Date(k.expires_at).toLocaleString()}</td><td>{k.revoked_at?<span className="badge danger">Revoked</span>:new Date(k.expires_at)<=new Date()?<span className="badge danger">Expired</span>:<span className="badge success">Active</span>}</td><td>{!k.revoked_at&&<button className="btn danger" onClick={()=>revoke(k.id)}>Revoke</button>}</td></tr>)}
    </tbody></table></div></section>
  </main>;
}
