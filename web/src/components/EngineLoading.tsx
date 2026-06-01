export function EngineLoading() {
  return (
    <div className="card" style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
      <div style={{
        width: 28, height: 28, margin: "0 auto 0.8rem", borderRadius: "50%",
        border: "3px solid var(--border)", borderTopColor: "var(--accent)",
        animation: "spin 0.8s linear infinite",
      }} />
      <div className="muted">Warming up the engine…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
