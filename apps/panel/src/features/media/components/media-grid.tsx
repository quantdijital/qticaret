import { Check } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { AiEditedBadge } from "@/features/ai/components/ai-edited-badge"
import { mediaFacts } from "@/features/media/api/media"
import type { MediaAsset } from "@/features/media/api/media"
import { cn } from "@qticaret/admin-ui/lib/utils"

interface MediaGridProps {
  items: MediaAsset[] | undefined
  loading: boolean
  /** Dimmed while the next page loads over the last one. */
  stale?: boolean
  /** Ids chosen in a picker; absent on the library page, where a click opens the detail. */
  selected?: ReadonlySet<string>
  onItemClick: (asset: MediaAsset) => void
  /** The picker's narrower dialog takes fewer columns than the page. */
  dense?: boolean
  empty: ReactNode
}

const COLUMNS = {
  page: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6",
  dense: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
}

/**
 * The library's files as thumbnails (docs/06 Ortam kütüphanesi): pictures
 * are told apart by sight, so this one list is a grid, each with its name
 * and its type, size and bytes beneath. A picker marks the chosen ones.
 */
export function MediaGrid({
  items,
  loading,
  stale = false,
  selected,
  onItemClick,
  dense = false,
  empty,
}: MediaGridProps) {
  const { t } = useTranslation()
  const columns = dense ? COLUMNS.dense : COLUMNS.page
  if (loading && !items) {
    return (
      <ul aria-busy="true" aria-label={t("common.loading")} className={cn("grid gap-3", columns)}>
        {Array.from({ length: dense ? 8 : 12 }, (_, index) => (
          <li key={index} className="flex flex-col gap-2">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-4 w-3/4" />
          </li>
        ))}
      </ul>
    )
  }
  if (!items || items.length === 0) {
    return <div className="flex min-h-40 items-center justify-center py-8">{empty}</div>
  }
  return (
    <ul className={cn("grid gap-3 transition-opacity", columns, stale && "opacity-60")}>
      {items.map((asset) => {
        const chosen = selected?.has(asset.id) ?? false
        return (
          <li key={asset.id} className="min-w-0">
            <button
              type="button"
              aria-pressed={selected ? chosen : undefined}
              aria-label={asset.filename}
              onClick={() => {
                onItemClick(asset)
              }}
              className={cn(
                "group flex w-full min-w-0 flex-col gap-2 rounded-lg p-1 text-left outline-hidden transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring",
                chosen && "bg-accent"
              )}
            >
              <span
                className={cn(
                  "relative block overflow-hidden rounded-md border bg-muted",
                  chosen && "border-primary ring-2 ring-primary"
                )}
              >
                <img
                  src={asset.url}
                  alt={asset.alt ?? ""}
                  loading="lazy"
                  className="aspect-square w-full object-contain"
                />
                {asset.ai_source ? (
                  <AiEditedBadge look="icon" className="absolute top-2 left-2" />
                ) : null}
                {chosen ? (
                  <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                ) : null}
              </span>
              <span className="flex min-w-0 flex-col px-1 pb-1">
                <span className="truncate text-[13px] font-medium">{asset.filename}</span>
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {mediaFacts(asset)}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
