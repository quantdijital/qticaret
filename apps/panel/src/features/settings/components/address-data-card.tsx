import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CircleCheck, Loader2, RefreshCw, TriangleAlert } from "lucide-react"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useCan } from "@/features/auth/api/staff"
import {
  addressDataQuery,
  isRunning,
  reportTotals,
  useSyncAddressData,
} from "@/features/settings/api/address-data"
import type { AddressDataJob, AddressDataReport } from "@/features/settings/api/address-data"
import { errorText } from "@/lib/errors"
import { formatCount, formatDate, formatDateTime } from "@/lib/format"

const A = "settings.addressData"

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border px-3 py-2.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{formatCount(value)}</span>
    </div>
  )
}

/** The newest job's outcome: running with its progress, its counts, or why it failed. */
function JobLine({ job }: { job: AddressDataJob }) {
  const { t } = useTranslation()
  if (isRunning(job)) {
    const step = job.progress_key?.endsWith("importing") ? "importing" : "downloading"
    const label = t(`${A}.${step}`, { percent: job.progress ?? 0 })
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        <p className="flex items-center gap-2 text-[13px]">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {label}
        </p>
        <Progress value={job.progress ?? 0} aria-label={label} />
      </div>
    )
  }
  if (job.status === "failed") {
    return (
      <p className="flex items-start gap-2 rounded-md bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive-text">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {job.error_message ?? t(`${A}.failed`)}
      </p>
    )
  }
  const report = job.result_summary as AddressDataReport | null
  if (job.status !== "succeeded" || !report) {
    return null
  }
  const totals = reportTotals(report)
  return (
    <p className="flex items-start gap-2 rounded-md bg-info-soft px-3 py-2.5 text-[13px] text-info-text">
      <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {report.skipped
        ? t(`${A}.current`)
        : t(`${A}.result`, {
            added: formatCount(totals.added),
            updated: formatCount(totals.updated),
            removed: formatCount(totals.removed),
          })}
    </p>
  )
}

/**
 * Settings > Shipping and delivery > Address data (adr/0008 Ek 2026-11-04):
 * how many provinces, districts, neighbourhoods and villages the address
 * forms offer and which TürkiyeAPI dataset they are; the owner brings them
 * up to date now (a job, its progress and its counts here). A weekly check
 * does the same on its own when TürkiyeAPI publishes.
 */
export function AddressDataCard() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const canSync = useCan("trAddressSync")
  const status = useQuery(addressDataQuery())
  const sync = useSyncAddressData()
  const job = status.data?.job ?? null
  const running = isRunning(job) || sync.isPending

  // A sync started here and finished: said once; the address forms read the new lists
  const started = useRef<string | null>(null)
  useEffect(() => {
    const done = job?.id === started.current && !isRunning(job) ? job : null
    if (!done) {
      return
    }
    started.current = null
    if (done.status === "succeeded") {
      toast.success(t(`${A}.done`))
      void client.invalidateQueries({ queryKey: ["tr-address"] })
    } else {
      toast.error(done.error_message ?? t(`${A}.failed`))
    }
  }, [job, client, t])

  const start = () => {
    sync.mutate(undefined, {
      onSuccess: ({ async_job }) => {
        started.current = async_job.id
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }

  const data = status.data
  return (
    <SectionCard title={t(`${A}.title`)} description={t(`${A}.description`)}>
      {status.isError ? (
        <ErrorState text={errorText(t, status.error)} onRetry={() => void status.refetch()} />
      ) : !data ? (
        <LoadingRows rows={2} />
      ) : (
        <div className="flex flex-col gap-4">
          {data.provinces === 0 ? (
            <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2.5 text-[13px] text-warning-text">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t(`${A}.empty`)}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label={t(`${A}.provinces`)} value={data.provinces} />
              <Stat label={t(`${A}.districts`)} value={data.districts} />
              <Stat label={t(`${A}.neighborhoods`)} value={data.neighborhoods} />
            </div>
          )}
          {data.last_sync_at ? (
            <dl className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">{t(`${A}.source`)}</dt>
              <dd>
                {data.source === "turkiyeapi"
                  ? t(`${A}.sourceTurkiyeApi`, {
                      version: data.dataset_version ?? "",
                      date: data.last_updated ? formatDate(data.last_updated) : "",
                    })
                  : t(`${A}.sourceFile`)}
              </dd>
              <dt className="text-muted-foreground">{t(`${A}.lastSync`)}</dt>
              <dd>{formatDateTime(data.last_sync_at)}</dd>
            </dl>
          ) : null}
          {job ? <JobLine job={job} /> : null}
          <p className="text-[13px] text-muted-foreground">{t(`${A}.attribution`)}</p>
          <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
            {canSync ? (
              <Button disabled={running} onClick={start}>
                {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {t(`${A}.sync`)}
              </Button>
            ) : (
              <p className="text-[13px] text-muted-foreground">{t(`${A}.ownerOnly`)}</p>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  )
}
