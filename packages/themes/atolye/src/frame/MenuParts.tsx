import { ResponsiveImage } from "@qticaret/ui"
import type { CategoryCardView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import type { CountWords } from "./menu-words"

/** A row's product count: "58" in a pill, "58 ürün" for a screen reader; none, nothing. */
export function MenuCount({
  count,
  dark = false,
}: {
  count?: CountWords | undefined
  dark?: boolean
}) {
  return count ? (
    <span className={cn("gf-menu-count", dark && "gf-menu-count--dark")}>
      <span aria-hidden="true">{count.shown}</span>
      <span className="sr-only">{count.said}</span>
    </span>
  ) : null
}

/** A row's picture as a small rounded square (the name beside it says what it is). */
export function MenuThumb({
  category,
  size,
}: {
  category: CategoryCardView
  /** The square's side: 36, 40 px. */
  size: 36 | 40
}) {
  return (
    <span
      className={cn(
        "block shrink-0 overflow-hidden rounded-inner bg-paper-3",
        size === 36 ? "size-9" : "size-10"
      )}
    >
      {category.image && (
        <ResponsiveImage
          image={{ ...category.image, alt: "" }}
          sizes={`${String(size)}px`}
          className="h-full w-full object-cover"
        />
      )}
    </span>
  )
}
