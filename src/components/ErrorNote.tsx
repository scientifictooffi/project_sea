export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border border-rust/60 bg-rust/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1">
        <div className="label text-rust-soft mb-1">Transmission problem</div>
        <p className="text-paper/90">{message}</p>
      </div>
      {onRetry && <button className="btn btn-ghost py-2 px-4 text-xs" onClick={onRetry}>Retry</button>}
    </div>
  )
}
