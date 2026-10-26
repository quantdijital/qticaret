import type { LucideIcon } from "lucide-react"
import { KpiTile } from "@/components/patterns/kpi-tile"
import { Skeleton } from "@/components/ui/skeleton"

export interface ReportTile {
  key: string
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}

const ROW =
  "grid gap-px overflow-hidden rounded-lg border bg-border shadow-card sm:grid-cols-2 xl:grid-cols-4"

/** A report's four headline numbers in one row of tiles, as the summary's KPIs are drawn. */
export function ReportTiles({ label, tiles }: { label: string; tiles: ReportTile[] | null }) {
  return (
    <section aria-label={label} className={ROW}>
      {tiles
        ? tiles.map((tile) => (
            <KpiTile
              key={tile.key}
              icon={tile.icon}
              label={tile.label}
              value={tile.value}
              {...(tile.hint ? { hint: tile.hint } : {})}
              className="bg-card"
            />
          ))
        : [0, 1, 2, 3].map((index) => (
            <div key={index} className="flex flex-col gap-3 bg-card p-5">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-9 w-40" />
            </div>
          ))}
    </section>
  )
}
