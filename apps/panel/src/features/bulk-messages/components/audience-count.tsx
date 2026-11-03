import { Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { SKIP_REASONS } from "@/features/bulk-messages/api/types"
import type { AudiencePreview, SkipCounts } from "@/features/bulk-messages/api/types"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

const A = "bulkMessages.audience.count"

/** The reasons with anyone behind them, in the backend's order. */
const skipRows = (counts: SkipCounts) =>
  SKIP_REASONS.filter((reason) => counts[reason] > 0).map((reason) => ({
    reason,
    count: counts[reason],
  }))

/** Who is left out and why, each reason in words with its number. */
export function SkipList({ counts, label }: { counts: SkipCounts; label: string }) {
  const { t } = useTranslation()
  const rows = skipRows(counts)
  if (rows.length === 0) {
    return <p className="text-[13px] text-muted-foreground">{t(`${A}.noneExcluded`)}</p>
  }
  return (
    <dl aria-label={label} className="flex flex-col divide-y text-[13px]">
      {rows.map(({ reason, count }) => (
        <div key={reason} className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-muted-foreground">{t(`bulkMessages.skip.${reason}`)}</dt>
          <dd className="font-medium tabular-nums">{formatCount(count)}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The live count (adr/0050 §3): who it would reach now, who the sources
 * name, and why the rest would get nothing; with what today's quota sends
 * today. Numbers only: no one is named.
 */
export function AudienceCount({
  preview,
  stale = false,
}: {
  preview: AudiencePreview | undefined
  stale?: boolean
}) {
  const { t } = useTranslation()
  if (!preview) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  const excluded = preview.audience - preview.eligible
  return (
    <div
      aria-live="polite"
      className={cn("flex flex-col gap-4 transition-opacity", stale && "opacity-60")}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Users className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <span className="text-2xl leading-8 font-semibold tabular-nums">
            {t(`${A}.eligible`, { count: preview.eligible, people: formatCount(preview.eligible) })}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {t(`${A}.of`, {
              audience: formatCount(preview.audience),
              excluded: formatCount(excluded),
            })}
          </span>
        </div>
      </div>
      <SkipList counts={preview.excluded} label={t(`${A}.excluded`)} />
      {preview.quota.later > 0 ? (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
          {t(`${A}.quotaLater`, {
            today: formatCount(preview.quota.today),
            later: formatCount(preview.quota.later),
          })}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">{t(`${A}.estimate`)}</p>
    </div>
  )
}
