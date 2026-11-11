import type { ReactNode } from "react"

/** Short facts as label and value rows (the shop page's summary style). */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 whitespace-pre-line tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
