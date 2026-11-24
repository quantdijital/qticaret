import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Loader2, MousePointerClick, Eye } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DeltaBadge } from "@qticaret/admin-ui/patterns/delta-badge"
import { KpiTile } from "@qticaret/admin-ui/patterns/kpi-tile"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { insightsQuery, useRefreshInsights } from "@/features/seo/api/insights"
import { errorText } from "@/lib/errors"
import { formatCount, formatPercent } from "@qticaret/admin-ui/lib/format"

const S = "seo.searchConsole"

/**
 * The SEO page: the shop's last 28 days in Google Search beside the 28
 * before, the pages that lost the most clicks, and how many inspected
 * pages Google has in its index (F10.11).
 */
export function SearchConsoleCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const query = useQuery(insightsQuery())
  const refresh = useRefreshInsights()
  const insights = query.data?.insights
  const search = insights?.search
  return (
    <SectionCard
      title={t(`${S}.title`)}
      description={
        search?.period_end ? t(`${S}.period`, { end: search.period_end }) : t(`${S}.hint`)
      }
      className={className}
      action={
        <Button
          size="sm"
          variant="outline"
          disabled={refresh.isPending}
          onClick={() => {
            refresh.mutate(undefined, {
              onSuccess: () => toast.success(t(`${S}.refreshed`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        >
          {refresh.isPending ? <Loader2 className="animate-spin" /> : null}
          {t(`${S}.refresh`)}
        </Button>
      }
    >
      {!insights ? (
        <Skeleton className="h-40" />
      ) : !search ? (
        <p className="text-[13px] text-muted-foreground">
          {t(`${S}.empty`)}{" "}
          <Link
            to="/settings/seo"
            search={{ part: "search" }}
            className="underline underline-offset-2"
          >
            {t(`${S}.setUp`)}
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiTile
              icon={MousePointerClick}
              label={t(`${S}.clicks`)}
              value={formatCount(search.clicks)}
              delta={<DeltaBadge current={search.clicks} previous={search.prev_clicks} />}
              className="justify-between px-0 py-0"
            />
            <KpiTile
              icon={Eye}
              label={t(`${S}.impressions`)}
              value={formatCount(search.impressions)}
              delta={<DeltaBadge current={search.impressions} previous={search.prev_impressions} />}
              className="justify-between px-0 py-0"
            />
          </div>
          <p className="text-[13px] text-muted-foreground">
            {t(`${S}.summary`, {
              ctr: formatPercent(search.ctr),
              position: search.position.toFixed(1),
              indexed: formatCount(insights.index.indexed),
              inspected: formatCount(insights.index.inspected),
            })}
          </p>
          {search.dropped.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium">{t(`${S}.dropped`)}</h3>
              <ul className="flex flex-col divide-y">
                {search.dropped.map((page) => (
                  <li key={page.path} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate font-mono text-[13px]" title={page.path}>
                      {page.path}
                    </span>
                    <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                      {formatCount(page.prev_clicks)} → {formatCount(page.clicks)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}
