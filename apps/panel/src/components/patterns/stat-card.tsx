interface StatCardProps {
  label: string
  value: string
  /** One sentence of context under the number. */
  hint?: string
}

/** A number the owner glances at (docs/18 §7): label, tabular value, context. */
export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className="tabular text-2xl font-semibold leading-8 tracking-[-0.01em]">{value}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  )
}
