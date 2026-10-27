export function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="label">Evidence {current} / {total}</span>
      <div className="flex gap-1.5 flex-1">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`h-[3px] flex-1 transition-colors duration-500 ${i < current ? 'bg-sand' : 'bg-paper/15'}`} />
        ))}
      </div>
    </div>
  )
}
