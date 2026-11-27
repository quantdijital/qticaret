import { Link } from "@tanstack/react-router"
import { AlertTriangle, ArrowRight, CircleCheck, Minus, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import type { MigrationOverview } from "@/features/settings/api/migration-overview"
import { sourceKindOf } from "@/features/settings/components/migration/source-kind"
import { formatCount, formatDateTime } from "@qticaret/admin-ui/lib/format"
import { cn } from "@qticaret/admin-ui/lib/utils"

const O = "settings.migration.overview"
// The tiles, in the order a shop looks for them; one with nothing moved shows only if it matters
const TILES = [
  "product",
  "image",
  "category",
  "brand",
  "post",
  "page",
  "customer",
  "order",
  "review",
] as const
type Tile = (typeof TILES)[number]
const ALWAYS: ReadonlySet<Tile> = new Set(["product", "customer"])

/** A tile's state line: what is missing, else done, else not moved. */
function stateOf(tile: Tile, overview: MigrationOverview) {
  const own = overview.kinds[tile]
  if (!own || own.moved + own.problems === 0) {
    return { tone: "none", key: `${O}.states.notMoved`, count: 0 } as const
  }
  if (tile === "post" && overview.missing.post_images > 0) {
    return {
      tone: "warn",
      key: `${O}.states.postImages`,
      count: overview.missing.post_images,
    } as const
  }
  if (own.problems > 0) {
    const key = tile === "image" ? `${O}.states.images` : `${O}.states.problems`
    return { tone: "warn", key, count: own.problems } as const
  }
  return { tone: "ok", key: `${O}.states.ok`, count: 0 } as const
}

const ICON = { ok: CircleCheck, warn: AlertTriangle, none: Minus } as const

/**
 * "Taşınanlar" (adr/0042 Ek 2026-11-27): one equal tile per kind with how
 * many moved and what is missing, from what the runs kept (no file read);
 * the last transfer and the one rule every completion keeps.
 */
export function OverviewTiles({ overview }: { overview: MigrationOverview | undefined }) {
  const { t } = useTranslation()
  const last = overview?.last_run ?? null
  const tiles = overview
    ? TILES.filter((tile) => {
        const own = overview.kinds[tile]
        return ALWAYS.has(tile) || (own !== undefined && own.moved + own.problems > 0)
      })
    : []
  return (
    <SectionCard
      title={t(`${O}.title`)}
      flush
      {...(last
        ? {
            description: t(`${O}.lastRun`, {
              date: formatDateTime(last.finished_at ?? last.created_at),
              source: t(`settings.migration.run.sources.${sourceKindOf(last.source)}`),
            }),
          }
        : {})}
      action={
        <Button asChild>
          <Link to="/settings/migration/new">
            <Plus />
            {t(`${O}.newRun`)}
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-4 px-5 pb-5">
        {!overview ? (
          <Skeleton className="h-24 rounded-md" />
        ) : last === null && Object.keys(overview.kinds).length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-5 text-sm text-muted-foreground">
            {t(`${O}.empty`)}
          </p>
        ) : (
          <ul
            className={cn(
              "grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 xl:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]",
              // A last tile alone on its row takes the row: no gap beside it
              "[&>li:last-child:nth-child(odd)]:col-span-2 md:[&>li:last-child:nth-child(odd)]:col-span-1"
            )}
          >
            {tiles.map((tile) => {
              const state = stateOf(tile, overview)
              const Icon = ICON[state.tone]
              return (
                <li
                  key={tile}
                  className="flex h-full flex-col gap-1 rounded-md border px-3 py-2.5"
                  data-testid={`migration-tile-${tile}`}
                >
                  <span className="text-[13px] text-muted-foreground">
                    {t(`${O}.kinds.${tile}`)}
                  </span>
                  <span className="text-xl font-semibold tabular-nums">
                    {state.tone === "none" ? "—" : formatCount(overview.kinds[tile]?.moved ?? 0)}
                  </span>
                  <span
                    className={cn(
                      "mt-auto flex items-center gap-1.5 text-[13px]",
                      state.tone === "ok" && "text-success-text",
                      state.tone === "warn" && "text-warning-text",
                      state.tone === "none" && "text-muted-foreground"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {t(state.key, { count: state.count })}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="min-w-0 flex-[1_1_20rem] text-[13px] text-muted-foreground">
            {t(`${O}.rule`)}
          </p>
          {last?.job_id ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/settings/migration/new" search={{ is: last.job_id }}>
                {t(`${O}.openResult`)}
                <ArrowRight />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </SectionCard>
  )
}
