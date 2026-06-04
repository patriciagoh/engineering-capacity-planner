export function EmptyState() {
  return (
    <div data-testid="app-empty" className="mx-auto max-w-[1180px] px-6 py-16">
      <div className="font-serif text-2xl text-ink">No teams yet</div>
      <p className="mt-2 text-muted">Your account is ready. Creating your first team arrives in the next release.</p>
    </div>
  );
}
