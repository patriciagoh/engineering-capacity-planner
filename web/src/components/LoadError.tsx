export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div data-testid="app-error" className="mx-auto max-w-[1180px] px-6 py-16" role="alert">
      <div className="font-serif text-2xl text-ink">Couldn’t load your plan</div>
      <p className="mt-2 text-muted">Your saved data could not be read. Your data has not been changed.</p>
      <button onClick={onRetry} className="mt-4 rounded-pill border border-line px-3 py-1 text-sm text-ink">
        Try again
      </button>
    </div>
  );
}
