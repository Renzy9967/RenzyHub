export default async function Success({
  searchParams,
}: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  return (
    <main className="container">
      <section className="card center" style={{ maxWidth: 700, margin: "80px auto" }}>
        <p className="muted">RenzyHub</p>
        <h1>Key generated</h1>
        <p className="muted">Copy your key and use it with the RenzyHub library.</p>
        <div className="code">{key ?? "Unavailable"}</div>
      </section>
    </main>
  );
}