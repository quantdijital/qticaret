import { useQuery } from "@tanstack/react-query"
import { RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  accountingStatusQuery,
  usePickAccountingAdapter,
  useRetryAccountingSync,
} from "@/features/settings/api/accounting"
import type { AccountingAdapterId } from "@/features/settings/api/accounting"
import { errorText } from "@/lib/errors"
import { formatCount, formatRelative } from "@/lib/format"

const A = "settings.accounting.program"
// Programs a shop will pick from once their adapters are written (adr/0039 §5)
const UPCOMING = ["parasut", "logo", "mikro"] as const

/**
 * The shop's accounting program (F11.5, adr/0039 §5): sales, collections
 * and refunds go to it every five minutes; a record it refuses is tried
 * again later and later, and one that stopped can be started again here.
 */
export function AccountingProgramCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const status = useQuery(accountingStatusQuery())
  const pick = usePickAccountingAdapter()
  const retry = useRetryAccountingSync()
  const data = status.data
  const choose = (adapter: string) => {
    pick.mutate(adapter as AccountingAdapterId, {
      onSuccess: () => toast.success(t(`${A}.saved`)),
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return (
    <SectionCard
      title={t(`${A}.title`)}
      description={t(`${A}.hint`)}
      {...(className ? { className } : {})}
    >
      {!data ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="flex h-full flex-col gap-4">
          <Select value={data.adapter} onValueChange={choose} disabled={pick.isPending}>
            <SelectTrigger className="w-full sm:w-72" aria-label={t(`${A}.label`)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.adapters
                .filter((option) => option.available)
                .map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {t(`${A}.adapters.${option.id}`)}
                  </SelectItem>
                ))}
              {UPCOMING.map((id) => (
                <SelectItem key={id} value={id} disabled>
                  {t(`${A}.upcoming.${id}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-muted-foreground">
            {(["sale", "payment", "refund", "cancel", "once"] as const).map((key) => (
              <li key={key}>{t(`${A}.sends.${key}`)}</li>
            ))}
          </ul>
          {data.active ? (
            <div className="mt-auto flex flex-wrap gap-2">
              <StatusBadge tone="info">
                {t(`${A}.counts.pending`, { count: data.counts.pending })}
              </StatusBadge>
              <StatusBadge tone="success">
                {t(`${A}.counts.synced`, { count: data.counts.synced })}
              </StatusBadge>
              <StatusBadge tone={data.counts.stopped > 0 ? "danger" : "neutral"}>
                {t(`${A}.counts.stopped`, { count: data.counts.stopped })}
              </StatusBadge>
              {data.counts.skipped > 0 ? (
                <StatusBadge tone="neutral">
                  {t(`${A}.counts.skipped`, { count: data.counts.skipped })}
                </StatusBadge>
              ) : null}
            </div>
          ) : (
            <p className="mt-auto text-[13px] text-muted-foreground">{t(`${A}.none`)}</p>
          )}
          {data.stopped.length > 0 ? (
            <ul className="flex flex-col divide-y rounded-md border">
              {data.stopped.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <span className="text-sm font-medium">
                    {t(`${A}.sources.${row.source_type}`)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{row.source_id}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`${A}.lastError`, {
                      code: row.last_error ?? "—",
                      when: formatRelative(row.updated_at),
                      attempts: formatCount(row.attempts),
                    })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    disabled={retry.isPending}
                    onClick={() => {
                      retry.mutate(row.id, {
                        onSuccess: () => toast.success(t(`${A}.retried`)),
                        onError: (failure) => toast.error(errorText(t, failure)),
                      })
                    }}
                  >
                    <RotateCcw />
                    {t(`${A}.retry`)}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}
