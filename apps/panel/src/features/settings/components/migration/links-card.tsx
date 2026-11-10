import { useQuery } from "@tanstack/react-query"
import { Download, Link2, Loader2, SearchCheck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { jobResultUrl } from "@/features/settings/api/activity"
import {
  isRunning,
  lastLinkJobQuery,
  linkSummaryOf,
  useStartLinkRewrite,
} from "@/features/settings/api/content-links"
import type { LinkJob } from "@/features/settings/api/content-links"
import { errorText } from "@/lib/errors"
import { formatCount, formatDate } from "@qticaret/admin-ui/lib/format"

const L = "settings.migration.links"

/** Where the last run stands, in a sentence; its report when it has one. */
function LastRun({ job }: { job: LinkJob | null }) {
  const { t } = useTranslation()
  const summary = linkSummaryOf(job)
  if (!job) {
    return <p className="text-sm text-muted-foreground">{t(`${L}.none`)}</p>
  }
  if (isRunning(job)) {
    return (
      <p className="flex items-center gap-2 text-sm" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t(`${L}.running`)}
      </p>
    )
  }
  if (job.status !== "succeeded" || !summary) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {job.error_message ?? t(`${L}.failed`)}
      </p>
    )
  }
  const values = {
    date: formatDate(job.finished_at ?? job.created_at),
    changed: formatCount(summary.changed),
    unresolved: formatCount(summary.unresolved),
    documents: formatCount(summary.rewritten),
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-sm">{t(summary.dry_run ? `${L}.checked` : `${L}.applied`, values)}</p>
      {job.has_result ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void jobResultUrl(job.id).then(
              (url) => {
                window.location.assign(new URL(url, window.location.origin).href)
              },
              () => {
                toast.error(t(`${L}.downloadFailed`))
              }
            )
          }}
        >
          <Download />
          {t(`${L}.report`)}
        </Button>
      ) : null}
    </div>
  )
}

/**
 * The migrated texts' links to the old site (adr/0042 Ek 2026-11-05):
 * posts, pages and product descriptions pointed at the pages that answer
 * those addresses here, through the old addresses' 301s; links to other
 * sites untouched; what answers nothing is listed in the report for the
 * shop to fix. A check first counts; the fix asks once.
 */
export function LinksCard() {
  const { t } = useTranslation()
  const last = useQuery(lastLinkJobQuery())
  const start = useStartLinkRewrite()
  const [confirming, setConfirming] = useState(false)
  const busy = start.isPending || isRunning(last.data)
  const run = (dryRun: boolean) => {
    start.mutate(dryRun, { onError: (failure) => toast.error(errorText(t, failure)) })
  }
  return (
    <SectionCard
      title={t(`${L}.title`)}
      description={t(`${L}.description`)}
      action={
        <>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              run(true)
            }}
          >
            <SearchCheck />
            {t(`${L}.check`)}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setConfirming(true)
            }}
          >
            {start.isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
            {t(`${L}.apply`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 px-5 pb-5">
        {last.isPending ? (
          <Skeleton className="h-9 rounded-md" />
        ) : (
          <LastRun job={last.data ?? null} />
        )}
        <p className="text-[13px] text-muted-foreground">{t(`${L}.hint`)}</p>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`${L}.confirmTitle`)}
        description={t(`${L}.confirmText`)}
        confirmLabel={t(`${L}.apply`)}
        onConfirm={() => {
          setConfirming(false)
          run(false)
        }}
      />
    </SectionCard>
  )
}
