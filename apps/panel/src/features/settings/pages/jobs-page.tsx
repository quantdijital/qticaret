import { useQuery } from "@tanstack/react-query"
import { Download, FileClock, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DataTable } from "@/components/patterns/data-table"
import type { Column } from "@/components/patterns/data-table"
import { PageHeader } from "@/components/patterns/page-header"
import { Pagination } from "@/components/patterns/pagination"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { JOB_PAGE_SIZE, jobResultUrl, jobsQuery } from "@/features/settings/api/activity"
import type { AsyncJob } from "@/features/settings/api/activity"
import { errorText } from "@/lib/errors"
import { formatDateTime, formatPercent, formatRelative } from "@/lib/format"

const TONE: Record<AsyncJob["status"], StatusTone> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
}

function DownloadButton({ job }: { job: AsyncJob }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  if (!job.has_result) {
    return null
  }
  const open = async () => {
    setBusy(true)
    try {
      // The link lives a few minutes: fetched on demand, never kept; only web links are followed
      const url = new URL(await jobResultUrl(job.id), window.location.origin)
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("unexpected link")
      }
      window.location.assign(url.href)
    } catch (failure) {
      toast.error(errorText(t, failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={() => void open()}>
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      {t("settings.jobs.download")}
    </Button>
  )
}

function useColumns(): Column<AsyncJob>[] {
  const { t } = useTranslation()
  return [
    {
      key: "type",
      header: t("settings.jobs.columns.type"),
      cell: (job) => (
        <span className="font-medium">
          {t(`settings.jobs.types.${job.type}`, { defaultValue: job.type })}
        </span>
      ),
    },
    {
      key: "status",
      header: t("settings.jobs.columns.status"),
      cell: (job) => (
        <StatusBadge tone={TONE[job.status]}>
          {t(`settings.jobs.status.${job.status}`)}
          {job.status === "running" && job.progress !== null
            ? ` · ${formatPercent(job.progress)}`
            : ""}
        </StatusBadge>
      ),
    },
    {
      key: "created",
      header: t("settings.jobs.columns.created"),
      className: "hidden md:table-cell",
      cell: (job) => (
        <time
          dateTime={job.created_at}
          title={formatDateTime(job.created_at)}
          className="text-muted-foreground"
        >
          {formatRelative(job.created_at)}
        </time>
      ),
    },
    {
      key: "expires",
      header: t("settings.jobs.columns.expires"),
      className: "hidden lg:table-cell",
      cell: (job) => (
        <span className="text-muted-foreground">
          {job.expires_at ? formatDateTime(job.expires_at) : "—"}
        </span>
      ),
    },
    { key: "result", header: "", align: "right", cell: (job) => <DownloadButton job={job} /> },
  ]
}

/** Settings > Jobs (adr/0014): exports and other long tasks, with their files for a week. */
export function JobsPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const jobs = useQuery(jobsQuery(page))
  const columns = useColumns()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("settings.jobs.title")} description={t("settings.jobs.subtitle")} />
      <section className="overflow-hidden rounded-lg border bg-card shadow-card">
        {jobs.isError ? (
          <div className="p-5">
            <ErrorState text={errorText(t, jobs.error)} onRetry={() => void jobs.refetch()} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={jobs.data?.async_jobs}
              rowKey={(job) => job.id}
              loading={jobs.isPending}
              stale={jobs.isPlaceholderData}
              empty={
                <div className="flex flex-col items-center gap-3 text-center">
                  <FileClock className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{t("settings.jobs.empty")}</p>
                </div>
              }
            />
            {jobs.data && jobs.data.count > 0 ? (
              <Pagination
                page={page}
                pageSize={JOB_PAGE_SIZE}
                count={jobs.data.count}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
