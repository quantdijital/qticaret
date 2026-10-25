import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ChevronRight, FileText, FolderX, ImageOff, Ruler } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { SectionCard } from "@/components/patterns/section-card"
import { Skeleton } from "@/components/ui/skeleton"
import { catalogHealthQuery } from "@/features/dashboard/api/catalog-health"
import type { CatalogHealth } from "@/features/dashboard/api/catalog-health"
import { formatCount, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Issue {
  key: "withoutImage" | "withoutCategory" | "shortDescription" | "missingDimensions"
  icon: LucideIcon
  count: number
}

// The meter's fill carries how healthy the catalog is (dataviz meter)
const fillFor = (ratio: number) =>
  ratio >= 0.8 ? "bg-success" : ratio >= 0.5 ? "bg-warning" : "bg-destructive"

function Health({ health }: { health: CatalogHealth }) {
  const { t } = useTranslation()
  if (health.products === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{t("dashboard.health.empty")}</p>
  }
  const ratio = health.complete / health.products
  const issues: Issue[] = [
    { key: "withoutImage", icon: ImageOff, count: health.without_image },
    { key: "withoutCategory", icon: FolderX, count: health.without_category },
    { key: "shortDescription", icon: FileText, count: health.short_description },
    { key: "missingDimensions", icon: Ruler, count: health.missing_dimensions },
  ]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-2xl leading-8 font-semibold tracking-[-0.015em]">
            {formatPercent(ratio)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("dashboard.health.score", {
              complete: formatCount(health.complete),
              total: formatCount(health.products),
            })}
          </span>
        </div>
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={health.products}
          aria-valuenow={health.complete}
          aria-label={t("dashboard.health.title")}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full", fillFor(ratio))}
            style={{ width: `${String(ratio * 100)}%` }}
          />
        </div>
      </div>
      <ul className="-mx-2 flex flex-col">
        {issues.map((issue) => (
          <li key={issue.key}>
            <Link
              to="/products"
              className="group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60"
            >
              <issue.icon
                className={cn(
                  "size-4",
                  issue.count > 0 ? "text-warning-text" : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
              <span className="flex-1">
                {t(`dashboard.health.${issue.key}`, { words: health.min_description_words })}
              </span>
              <span
                className={cn("tabular font-medium", issue.count === 0 && "text-muted-foreground")}
              >
                {formatCount(issue.count)}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** How complete the catalog is: the share of complete products and what is missing where. */
export function CatalogHealthCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const query = useQuery(catalogHealthQuery())
  return (
    <SectionCard
      title={t("dashboard.health.title")}
      description={t("dashboard.health.description")}
      className={className}
    >
      <AsyncBody
        query={query}
        skeleton={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        }
      >
        {(health) => <Health health={health} />}
      </AsyncBody>
    </SectionCard>
  )
}
