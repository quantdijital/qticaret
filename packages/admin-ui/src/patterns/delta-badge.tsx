import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { formatPercent } from "../lib/format"
import { cn } from "../lib/utils"

interface DeltaBadgeProps {
  current: number
  previous: number
  /** For costs and returns, down is the good direction. */
  upIsGood?: boolean
  className?: string
}

/**
 * Change against the previous period (dataviz stat tile): signed, with an
 * arrow and a word for screen readers, so colour never carries it alone.
 */
export function DeltaBadge({ current, previous, upIsGood = true, className }: DeltaBadgeProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
  if (previous === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        {current === 0 ? t("delta.none") : t("delta.new")}
      </span>
    )
  }
  const change = (current - previous) / previous
  const flat = Math.abs(change) < 0.0005
  const good = flat ? null : change > 0 === upIsGood
  const Icon = flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular",
        good === null && "bg-muted text-muted-foreground",
        good === true && "bg-success-soft text-success-text",
        good === false && "bg-destructive-soft text-destructive-text",
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{t(change > 0 ? "delta.up" : "delta.down")}</span>
      {formatPercent(Math.abs(change))}
    </span>
  )
}
