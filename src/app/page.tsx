import Link from "next/link";

export default function Home() {
  return <main className="container">
    <nav className="nav"><div className="brand">Renzy<span>Hub</span></div><Link className="btn" href="/admin">Admin</Link></nav>
    <section className="hero"><h1>Get your<br/>RenzyHub key.</h1>
      <p>Complete the configured checkpoints to receive a temporary RenzyHub access key. Each provider is verified server-side.</p>
      <Link className="btn primary" href="/get-key">Get Key</Link>
    </section>
    <section className="grid grid2">
      <div className="card"><h3>Multi-provider checkpoints</h3><p className="muted">Mix Linkvertise and LootLabs checkpoints and control their order from the admin panel.</p></div>
      <div className="card"><h3>Duration</h3><p className="muted">Keys expire automatically according to the duration configured by the admin.</p></div>
      <div className="card"><h3>API validation</h3><p className="muted">RenzyHub can validate a key directly against your backend.</p></div>
    </section>
    <div className="footer">RenzyHub Key System</div>
  </main>;
}
