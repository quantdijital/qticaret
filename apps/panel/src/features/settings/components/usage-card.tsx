import { Boxes, Globe, HardDrive, InfinityIcon, ShoppingBag, Sparkles, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import type { LimitKey } from "@qticaret/types/control-plane"
import { InfoTip } from "@qticaret/admin-ui/patterns/info-tip"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Progress } from "@qticaret/admin-ui/ui/progress"
import { formatCount, formatPercent } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { LimitStanding, PlanSummary } from "@/features/settings/api/plan"
import { ratioOf, toneOf } from "@/features/settings/plan-rules"
import type { UseTone } from "@/features/settings/plan-rules"
import {
  limitGroups,
  periodLabel,
  storageText,
  tileColumns,
} from "@/features/settings/subscription-rules"

const ICONS: Record<LimitKey, LucideIcon> = {
  products: Boxes,
  orders_per_month: ShoppingBag,
  staff: Users,
  storage_mb: HardDrive,
  llm_credits_per_month: Sparkles,
  custom_domains: Globe,
}

const TONES: Record<UseTone, StatusTone> = {
  ok: "neutral",
  warn: "warning",
  full: "danger",
  over: "warning",
}

// The bar's colour follows its tone; the badge under it says the same in words
const BAR: Record<UseTone, string> = {
  ok: "",
  warn: "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning",
  full: "bg-destructive/20 [&>[data-slot=progress-indicator]]:bg-destructive",
  over: "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning",
}

// Static class names (Tailwind reads them from the source): a group's columns from a tablet up
const COLUMNS = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const

/** A count as the page writes it: storage in MB or GB, the rest as numbers. */
const amountOf = (standing: LimitStanding, value: number): string =>
  standing.unit === "mb" ? storageText(value) : formatCount(value)

/** The short word under a tile: how much is left, by how much it is over, open invitations. */
function noteOf(t: TFunction, standing: LimitStanding, tone: UseTone): string | null {
  const { used, max } = standing
  if (standing.pending) {
    return t("plan.usage.pending", { count: standing.pending })
  }
  if (used === null || max === null || tone === "full") {
    return null
  }
  return tone === "over"
    ? t("plan.usage.over", { value: amountOf(standing, used - max) })
    : t("plan.usage.left", { value: amountOf(standing, max - used) })
}

function Tile({ standing }: { standing: LimitStanding }) {
  const { t } = useTranslation()
  const Icon = ICONS[standing.key]
  const name = t(`plan.keys.${standing.key}`)
  const tone = toneOf(standing)
  const ratio = ratioOf(standing)
  const note = noteOf(t, standing, tone)
  return (
    <li
      aria-label={name}
      className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-card"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        {/* Wraps rather than cut: the name is the tile's title (its group says "Bu ay") */}
        <span className="min-w-0 text-[13px] leading-5 font-medium break-words text-muted-foreground">
          {name}
        </span>
        {standing.kind === "warn" ? (
          <InfoTip name={name} hint={t("plan.usage.ordersNote")} />
        ) : null}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-[24px] leading-8 font-semibold tracking-[-0.02em] tabular-nums">
          {amountOf(standing, standing.used ?? 0)}
        </span>
        {standing.max === null ? null : (
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            / {amountOf(standing, standing.max)}
          </span>
        )}
      </div>
      {ratio === null ? (
        <span className="inline-flex h-6 w-fit items-center gap-1 rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
          <InfinityIcon className="size-3.5" aria-hidden="true" />
          {t("plan.usage.unlimited")}
        </span>
      ) : (
        <Progress
          value={Math.round(ratio * 100)}
          aria-label={t("plan.usage.barLabel", { name, value: formatPercent(ratio) })}
          className={cn("h-1.5", BAR[tone])}
        />
      )}
      {tone !== "ok" || note ? (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          {tone === "ok" ? null : (
            <StatusBadge tone={TONES[tone]}>{t(`plan.usage.tone.${tone}`)}</StatusBadge>
          )}
          {note ? (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{note}</span>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/** One group of tiles under its own heading, every row full. */
function Group({ title, limits }: { title: string; limits: LimitStanding[] }) {
  const titleId = useId()
  if (limits.length === 0) {
    return null
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 id={titleId} className="text-[13px] leading-5 font-medium text-muted-foreground">
        {title}
      </h3>
      <ul
        aria-labelledby={titleId}
        className={cn(
          "grid grid-cols-1 gap-[var(--grid-gap)]",
          COLUMNS[tileColumns(limits.length)]
        )}
      >
        {limits.map((standing) => (
          <Tile key={standing.key} standing={standing} />
        ))}
      </ul>
    </div>
  )
}

/**
 * Each limit with its use (adr/0061 §5.3, §5.6) as a tile: icon, the use
 * over the limit large, a thin bar amber from 80 % and red at a limit that
 * stops new records (the month's orders only warn), "Sınırsız" without a
 * limit. Two groups, each under its heading: the shop's totals, then the
 * ones counted this month. A group never puts more than three tiles in a
 * row, so a tile's name always has room (it was cut on a laptop when all
 * five shared one row).
 */
export function UsageCard({ plan }: { plan: PlanSummary }) {
  const { t } = useTranslation()
  const { totals, monthly } = limitGroups(plan.limits)
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={titleId} className="text-[15px] leading-6 font-semibold">
          {t("plan.usage.title")}
        </h2>
        <InfoTip name={t("plan.usage.title")} hint={t("plan.usage.hint")} />
        {plan.managed ? null : (
          <span className="ml-auto inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
            <InfinityIcon className="size-3.5" aria-hidden="true" />
            {t("plan.unmanaged")}
          </span>
        )}
      </div>
      <Group title={t("plan.details.groups.totals")} limits={totals} />
      <Group
        title={t("plan.details.groups.monthly", { month: periodLabel(plan.period) })}
        limits={monthly}
      />
    </section>
  )
}
