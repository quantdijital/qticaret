import { ArrowRight } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { LinkView, PhotoCollageItemView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

interface Mark {
  "data-qf"?: string
}

/**
 * The collage's white card (`card: below`, Wanderly's "Places That
 * Inspire"): the photograph on top, under it the place's name in bold and
 * its small line, a round outlined arrow on the right; a soft shadow and
 * the theme's corners. The whole card is the link (the arrow only shows
 * it); a card without one has no arrow. In the mosaic the photograph fills
 * what its cell leaves over.
 */
export function CollageCard({
  item,
  sizes,
  priority,
  mosaic,
  marks,
}: {
  item: PhotoCollageItemView
  sizes: string
  priority: boolean
  mosaic: boolean
  marks: { caption: Mark; subtitle: Mark }
}) {
  const body = (
    <>
      <span
        className={cn(
          "relative block overflow-hidden rounded-inner bg-media",
          mosaic ? "aspect-[4/3] lg:aspect-auto lg:min-h-0 lg:flex-1" : "aspect-[4/3]"
        )}
      >
        <ResponsiveImage
          image={item.image}
          sizes={sizes}
          priority={priority}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
      <span className="flex items-center justify-between gap-3 px-1.5 pt-3 pb-1">
        <span className="flex min-w-0 flex-col gap-0.5">
          {item.caption && (
            <span className="truncate font-semibold text-text" {...marks.caption}>
              {item.caption}
            </span>
          )}
          {item.subtitle && (
            <span className="truncate text-xs text-text-2" {...marks.subtitle}>
              {item.subtitle}
            </span>
          )}
        </span>
        {item.href && (
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-rule text-text"
          >
            <ArrowRight className="size-4" strokeWidth={2} />
          </span>
        )}
      </span>
    </>
  )
  const card = "flex h-full flex-col rounded-media bg-paper p-2 shadow-float"
  return item.href ? (
    <a
      href={item.href}
      className={cn(
        card,
        "text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
      )}
    >
      {body}
    </a>
  ) : (
    <div className={card}>{body}</div>
  )
}

/** The link to the whole list beside the heading, an arrow after its words. */
export function MoreLink({ more, mark }: { more: LinkView; mark?: Mark }) {
  return (
    <a
      href={more.path}
      {...mark}
      className="gf-link inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold"
    >
      {more.label}
      <ArrowRight className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
    </a>
  )
}
