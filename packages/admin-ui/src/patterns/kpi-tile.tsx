import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Sparkline } from "../charts/sparkline"
import { cn } from "../lib/utils"

interface KpiTileProps {
  icon: LucideIcon
  label: string
  value: string
  /** Change against the previous period (DeltaBadge). */
  delta?: ReactNode
  /** One short line: what the period is compared with. */
  hint?: string
  trend?: number[]
  className?: string
}

/**
 * A headline number (dataviz stat tile): label, value in proportional
 * figures, signed delta against a named period, a sparkline of its trend.
 */
export function KpiTile({ icon: Icon, label, value, delta, hint, trend, className }: KpiTileProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 p-5", className)}>
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {label}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="truncate text-[28px] leading-9 font-semibold tracking-[-0.02em]">
          {value}
        </span>
        {delta}
      </div>
      {hint ? <span className="-mt-2 text-xs text-muted-foreground">{hint}</span> : null}
      {trend && trend.length > 1 ? <Sparkline values={trend} className="mt-auto" /> : null}
    </div>
  )
}
