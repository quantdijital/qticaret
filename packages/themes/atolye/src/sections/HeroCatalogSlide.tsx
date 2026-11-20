import { ResponsiveImage, fieldKey, fieldMark } from "@qticaret/ui"
import type { HeroCatalogSlideView, HeroCatalogView, ImageView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

// The photo as drawn: about a third of the width from 1280 px (495 px at 1440), half a tablet, a phone across (K-28)
export const PHOTO_SIZES =
  "(min-width: 1440px) 500px, (min-width: 1280px) 35vw, (min-width: 768px) 50vw, 92vw"
// A slide that is its picture alone: the opening's whole tile (about 1000 px at 1440), a tablet's width under it
export const WHOLE_SIZES = "(min-width: 1440px) 1000px, (min-width: 1280px) 70vw, 92vw"

const WORDS = "flex flex-col items-start justify-center gap-4 p-5 sm:p-8 lg:gap-5 lg:p-10"

/** A slide's field mark by its part (`heading`, `links.0`): the attribute to spread. */
export type Mark = (key: string) => { "data-qf"?: string }
const unmarked: Mark = () => ({})

/** Whether the slide is its picture alone: no heading, line or button. */
export const pictureOnly = (slide: HeroCatalogSlideView): boolean =>
  slide.heading === null && slide.intro === null && slide.actions.length === 0

/** Where a slide stands: alone (today's opening), or one of a turning few with its controls. */
export interface SlidePlace {
  /** The heading's level: the page's h1 for the first slide of the page's first section. */
  level: "h1" | "h2"
  /** The section's heading id: the first slide's only. */
  id?: string | undefined
  /** The opening's name for a first slide with no heading of its own (a hidden heading). */
  name: string
  /** The page's LCP: eager and first in line. */
  eager: boolean
  /** One of two or more: room under the words for the dots, beside them for the arrows. */
  stage: { arrows: boolean } | null
}

/** What only the first slide shows: the line above, "from" and the products small. */
export interface SlideExtras {
  eyebrow: string | null
  /** The editor's live preview: the line above carries its field mark (adr/0065 Faz 2b). */
  marks?: boolean | undefined
  catalog: Pick<HeroCatalogView, "from" | "picks">
  t: Translate
}

/** The products shown small under the buttons, with the shop's short labels. */
function Picks({ catalog, t }: { catalog: SlideExtras["catalog"]; t: Translate }) {
  return (
    <ul aria-label={t("home.hero_picks")} className="gf-mosaic-picks flex flex-wrap gap-2 pt-1">
      {catalog.picks.map((pick) => (
        <li key={pick.path}>
          <a
            href={pick.path}
            className="gf-mosaic-swatch grid w-16 justify-items-center gap-1 text-center text-2xs font-semibold text-text-2 no-underline"
          >
            <span className="gf-mosaic-swatch-image block size-14 overflow-hidden rounded-inner">
              {pick.image && (
                <ResponsiveImage
                  image={pick.image}
                  sizes="56px"
                  className="h-full w-full rounded-inner object-cover"
                />
              )}
            </span>
            <span className="line-clamp-2">{pick.label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * One slide of the catalogue opening (adr/0049 Ek 2026-11-15) as a tile:
 * its words (the first slide's line above, "from" and products small too)
 * beside its picture, the picture leading where the slide does; or, with
 * no words, its picture alone across the tile, the whole of it the link.
 * A first slide without a heading keeps one for the page and its readers,
 * hidden. Drawn on the server; one slide is today's opening as it was.
 */
export function CatalogSlide({
  slide,
  image,
  place,
  extras,
  mark = unmarked,
}: {
  slide: HeroCatalogSlideView
  /** The picture drawn: the slide's, else (the first) the shop's newest pictured product. */
  image: ImageView | null
  place: SlidePlace
  /** The first slide's own parts; null on the others. */
  extras: SlideExtras | null
  /** The slide's field marks in the editor's preview (adr/0065 Faz 2b); none elsewhere. */
  mark?: Mark | undefined
}) {
  const Heading = place.level
  const hidden =
    place.id && !slide.heading ? (
      <Heading id={place.id} className="sr-only">
        {place.name}
      </Heading>
    ) : null
  if (pictureOnly(slide)) {
    const picture = image && (
      <ResponsiveImage
        image={image}
        sizes={WHOLE_SIZES}
        priority={place.eager}
        className="absolute inset-0 h-full w-full object-cover"
      />
    )
    return (
      <article
        className={cn("gf-mosaic-feature gf-mosaic-feature--whole", place.stage && "h-full")}
      >
        {hidden}
        <div className="gf-mosaic-photo" {...mark("image")}>
          {slide.link ? (
            <a
              href={slide.link.path}
              aria-label={!image || image.alt === "" ? slide.link.label : image.alt}
              className="absolute inset-0"
            >
              {picture}
            </a>
          ) : (
            picture
          )}
        </div>
      </article>
    )
  }
  const [action, second] = slide.actions
  const { stage } = place
  const picture = image && (
    <ResponsiveImage
      image={image}
      sizes={PHOTO_SIZES}
      priority={place.eager}
      className="absolute inset-0 h-full w-full object-cover"
    />
  )
  return (
    <article className={stage ? "gf-mosaic-feature h-full" : "gf-mosaic-feature"}>
      <div
        className={stage ? cn(WORDS, "pb-16 sm:pb-16 lg:pb-16", stage.arrows && "lg:pl-20") : WORDS}
      >
        {extras?.eyebrow && (
          <p className="text-sm font-semibold text-text-2" {...fieldMark(extras.marks, "eyebrow")}>
            {extras.eyebrow}
          </p>
        )}
        {hidden}
        {slide.heading && (
          <Heading
            id={place.id}
            {...mark("heading")}
            className="max-w-[18ch] text-hero leading-[1.08] tracking-(--tracking-display)"
          >
            {slide.heading}
          </Heading>
        )}
        {slide.intro && (
          <p className="max-w-[44ch] text-lead text-text-2" {...mark("text")}>
            {slide.intro}
          </p>
        )}
        {extras?.catalog.from && (
          <p className="gf-mosaic-from flex items-baseline gap-2">
            <b className="text-price font-extrabold tabular-nums">{extras.catalog.from}</b>
            <span className="text-sm text-text-3">{extras.t("home.hero_from")}</span>
          </p>
        )}
        {action && (
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={action.path}
              className="gf-btn"
              {...mark(fieldKey("links", slide.actionsAt?.[0] ?? 0))}
            >
              {action.label}
            </a>
            {second && (
              <a
                href={second.path}
                className="gf-btn gf-btn--quiet"
                {...mark(fieldKey("links", slide.actionsAt?.[1] ?? 1))}
              >
                {second.label}
              </a>
            )}
          </div>
        )}
        {extras && extras.catalog.picks.length > 0 && (
          <Picks catalog={extras.catalog} t={extras.t} />
        )}
      </div>
      {image && (
        <div className="gf-mosaic-photo" {...mark("image")}>
          {slide.link ? (
            // With buttons the picture is one more target, kept from readers and the tab order
            <a
              href={slide.link.path}
              className="absolute inset-0"
              {...(action
                ? { tabIndex: -1, "aria-hidden": true }
                : { "aria-label": slide.heading ?? slide.link.label })}
            >
              {picture}
            </a>
          ) : (
            picture
          )}
        </div>
      )}
    </article>
  )
}
