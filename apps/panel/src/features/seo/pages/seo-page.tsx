import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowRight, CircleCheck, Globe, TriangleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageColumn, PageGrid } from "@/components/patterns/page-grid"
import { PageHeader } from "@/components/patterns/page-header"
import { spanOf } from "@/components/patterns/page-spans"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CatalogHealthCard } from "@/features/dashboard/components/catalog-health-card"
import { insightsQuery } from "@/features/seo/api/insights"
import { redirectCountsQuery } from "@/features/seo/api/redirects"
import { AdvisorSummaryCard } from "@/features/seo/advisor/summary-card"
import { AuditCard } from "@/features/seo/audit/audit-card"
import { SearchConsoleCard } from "@/features/seo/components/search-console-card"
import { SetupChecklistCard } from "@/features/seo/components/setup-checklist-card"
import { SiteSearchCard } from "@/features/seo/components/site-search-card"
import { SitemapCard } from "@/features/seo/components/sitemap-card"
import { WebVitalsCard } from "@/features/seo/components/web-vitals-card"
import { sectionQuery } from "@/features/settings/api/sections"
import type { SeoSettings } from "@/features/settings/api/sections"
import { useStoreName } from "@/features/settings/api/store"
import { renderSample } from "@/features/settings/seo-sample"
import { formatCount } from "@/lib/format"
import { errorText } from "@/lib/errors"

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  const Icon = ok ? CircleCheck : TriangleAlert
  return (
    <li className="flex items-start gap-2.5 py-2.5 text-sm">
      <Icon
        className={
          ok
            ? "mt-0.5 size-4 shrink-0 text-success-text"
            : "mt-0.5 size-4 shrink-0 text-warning-text"
        }
        aria-hidden="true"
      />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

/** How a product page shows in search results, from the shop's own templates. */
function SearchPreview({ seo, storeName }: { seo: SeoSettings; storeName: string }) {
  const { t } = useTranslation()
  const host = seo.canonical_host ?? t("seo.sampleHost")
  const samples = t("settings.seo.samples", { returnObjects: true }) as Record<string, string>
  const path = seo.url_style.product === "flat" ? "/keten-gomlek" : "/urun/keten-gomlek"
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-background p-4">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted">
          <Globe className="size-3" aria-hidden="true" />
        </span>
        <span className="truncate">
          {host}
          {path}
        </span>
      </span>
      <span className="truncate text-lg text-info-text">
        {renderSample(seo.title_templates.product, storeName, samples)}
      </span>
      <span className="line-clamp-2 text-sm text-muted-foreground">
        {renderSample(seo.description_templates.product, storeName, samples)}
      </span>
      <span className="mt-2 text-[11px] text-muted-foreground">{t("seo.previewNote")}</span>
    </div>
  )
}

/** Rules, old addresses and open 404s, with the way to the redirects screen. */
function RedirectsCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const counts = useQuery(redirectCountsQuery())
  const items = [
    { key: "rules", tab: undefined },
    { key: "old", tab: "old" },
    { key: "missing", tab: "missing" },
  ] as const
  return (
    <SectionCard
      title={t("seo.redirectsCard.title")}
      description={t("seo.redirectsCard.hint")}
      className={className}
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/seo/redirects">
            {t("seo.redirectsCard.open")}
            <ArrowRight />
          </Link>
        </Button>
      }
    >
      <ul className="grid grid-cols-3 divide-x rounded-md border">
        {items.map(({ key, tab }) => (
          <li key={key}>
            <Link
              to="/seo/redirects"
              search={tab ? { tab } : {}}
              className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <span
                className={
                  key === "missing" && (counts.data?.missing ?? 0) > 0
                    ? "text-2xl font-semibold text-warning-text tabular-nums"
                    : "text-2xl font-semibold tabular-nums"
                }
              >
                {counts.data ? formatCount(counts.data[key]) : "–"}
              </span>
              <span className="text-xs text-muted-foreground">{t(`seo.redirectsCard.${key}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

/**
 * SEO (docs/13, docs/14): what setup still lacks, how the shop looks in
 * search today, what its catalog still lacks, its redirects, site search's
 * synonyms and sitemap, the advisor's score and the store-wide audit.
 */
export function SeoOverviewPage() {
  const { t } = useTranslation()
  const seo = useQuery(sectionQuery<SeoSettings>("seo"))
  const insights = useQuery(insightsQuery())
  // No Search Console part until the platform opens Google (docs/06 principle 10)
  const searchConsole = insights.data?.insights.search_console !== false
  const storeName = useStoreName() ?? t("app.name")
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t("nav.seo")}
        description={t("seo.description")}
        action={
          <Button asChild variant="outline">
            <Link to="/settings/seo">{t("seo.editSettings")}</Link>
          </Button>
        }
      />
      <PageGrid>
        <SetupChecklistCard className={spanOf(12)} />
        <SectionCard
          title={t("seo.search")}
          description={t("seo.searchHint")}
          className={spanOf(7)}
        >
          {seo.data ? (
            <div className="flex flex-col gap-4">
              <SearchPreview seo={seo.data.values} storeName={storeName} />
              <ul className="flex flex-col divide-y">
                <Check ok={seo.data.values.canonical_host !== null}>
                  {seo.data.values.canonical_host
                    ? t("seo.checks.host", { host: seo.data.values.canonical_host })
                    : t("seo.checks.noHost")}
                </Check>
                <Check ok>{t(`seo.checks.urls.${seo.data.values.url_style.product}`)}</Check>
                <Check ok={seo.data.values.ai_crawler_preset !== "none"}>
                  {t(`settings.seo.presets.${seo.data.values.ai_crawler_preset}.title`)}
                </Check>
              </ul>
            </div>
          ) : seo.isError ? (
            <ErrorState text={errorText(t, seo.error)} onRetry={() => void seo.refetch()} />
          ) : (
            <Skeleton className="h-56" />
          )}
        </SectionCard>
        <CatalogHealthCard className={spanOf(5)} />
        {/* Site search's synonyms under the redirects: the two short cards stand level with the sitemap */}
        <PageColumn span={6}>
          <RedirectsCard />
          <SiteSearchCard />
        </PageColumn>
        <SitemapCard className={spanOf(6)} />
        {searchConsole ? <SearchConsoleCard className={spanOf(7)} /> : null}
        <WebVitalsCard className={spanOf(searchConsole ? 5 : 12)} />
        <AdvisorSummaryCard className={spanOf(12)} />
        <AuditCard className={spanOf(12)} />
      </PageGrid>
    </div>
  )
}
