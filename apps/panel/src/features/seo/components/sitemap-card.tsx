import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { FileCode2, Loader2, RefreshCw, TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Button } from "@qticaret/admin-ui/ui/button"
import { SITEMAP_JOB, sitemapStatusQuery } from "@/features/seo/api/sitemap"
import { useStartJob } from "@/features/settings/api/activity"
import { errorText } from "@/lib/errors"
import { formatCount, formatRelative } from "@qticaret/admin-ui/lib/format"
import { useJobsMessage } from "@/features/settings/use-jobs-message"

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2.5 text-[13px] text-warning-text">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/**
 * The sitemap (docs/13 §6): the files search engines read, how many pages
 * they list, when they came out and whether changes wait for the next
 * refresh; one click queues a rebuild.
 */
export function SitemapCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const jobs = useJobsMessage()
  const client = useQueryClient()
  const status = useQuery(sitemapStatusQuery())
  const start = useStartJob()
  const data = status.data
  const pages = (data?.files ?? [])
    .filter((file) => file.name !== "sitemap.xml")
    .reduce((total, file) => total + file.urls, 0)

  const refresh = () => {
    start.mutate(
      { type: SITEMAP_JOB, input: {} },
      {
        onSuccess: () => {
          toast.success(t(jobs("seo.sitemap.queued")))
          void client.invalidateQueries({ queryKey: ["seo", "sitemap"] })
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }

  return (
    <SectionCard
      title={t("seo.sitemap.title")}
      description={t("seo.sitemap.hint")}
      className={className}
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={start.isPending || !data || data.host_missing}
          onClick={refresh}
        >
          {start.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {t("seo.sitemap.refresh")}
        </Button>
      }
    >
      {!data ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="flex flex-col gap-3">
          {data.host_missing ? (
            <Notice>
              {t("seo.sitemap.hostMissing")}{" "}
              <Link to="/settings/seo" className="font-medium underline underline-offset-2">
                {t("seo.editSettings")}
              </Link>
            </Notice>
          ) : null}
          {data.indexing ? null : <Notice>{t("seo.sitemap.noIndexing")}</Notice>}
          {data.files.length > 0 ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-2xl font-semibold tabular-nums">{formatCount(pages)}</span>
                <span className="text-xs text-muted-foreground">
                  {data.generated_at
                    ? t("seo.sitemap.generated", { when: formatRelative(data.generated_at) })
                    : null}
                </span>
              </div>
              <ul className="flex flex-col divide-y rounded-md border text-[13px]">
                {data.files.map((file) => (
                  <li key={file.name} className="flex items-center gap-2.5 px-3 py-2">
                    <FileCode2
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate font-mono">/{file.name}</span>
                    {file.name === "sitemap.xml" ? (
                      <span className="text-xs text-muted-foreground">
                        {t("seo.sitemap.index")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground tabular-nums">
                        {t("seo.sitemap.urls", { count: file.urls, urls: formatCount(file.urls) })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : data.host_missing ? null : (
            <p className="text-[13px] text-muted-foreground">{t("seo.sitemap.none")}</p>
          )}
          {data.dirty_since && data.files.length > 0 ? (
            <p className="text-xs text-muted-foreground">{t("seo.sitemap.pending")}</p>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}
