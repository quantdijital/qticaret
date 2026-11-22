import { ResponsiveImage, fieldKey, fieldMark } from "@qticaret/ui"
import type { PhotoCollageItemView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { type Of, headingId } from "./plan"

type Collage = Of<"photo_collage">

/**
 * `asymmetric` from 1024 px, four columns of even rows: the first
 * photograph two by two, the rest filling beside and under it so no row is
 * left short (three: two wide beside it; four: one wide, two small; five:
 * four small; six and seven: small ones beside it, a row of wide ones under).
 */
const MOSAIC: Readonly<Record<number, readonly string[]>> = {
  3: ["lg:col-span-2 lg:row-span-2", "lg:col-span-2", "lg:col-span-2"],
  4: ["lg:col-span-2 lg:row-span-2", "lg:col-span-2", "", ""],
  5: ["lg:col-span-2 lg:row-span-2", "", "", "", ""],
  6: ["lg:col-span-2 lg:row-span-2", "lg:col-span-2", "", "", "lg:col-span-2", "lg:col-span-2"],
  7: ["lg:col-span-2 lg:row-span-2", "", "", "", "", "lg:col-span-2", "lg:col-span-2"],
}

/** `even` from 1024 px: one tile size, as many a row as split the count best. */
const EVEN_COLUMNS: Readonly<Record<number, number>> = { 3: 3, 4: 4, 5: 5, 6: 3, 7: 4 }
const EVEN_CLASS: Readonly<Record<number, string>> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
}

/** How wide each photograph shows below 1024 px (the page's width less its gutters). */
const PHONE_SIZES = {
  scroll: "(min-width: 640px) 44vw, 78vw",
  stack: "(min-width: 640px) 46vw, 92vw",
} as const

/** How wide a photograph shows from 1024 px: its share of the 1344 px container. */
function wideSize(section: Collage, at: number): string {
  if (section.layout === "even") {
    const columns = EVEN_COLUMNS[section.items.length] ?? 3
    const vw = Math.round(92 / columns)
    return `(min-width: 1440px) ${String(Math.round(1344 / columns))}px, (min-width: 1024px) ${String(vw)}vw`
  }
  const wide = (MOSAIC[section.items.length]?.[at] ?? "").includes("col-span-2")
  return wide
    ? "(min-width: 1440px) 672px, (min-width: 1024px) 46vw"
    : "(min-width: 1440px) 336px, (min-width: 1024px) 23vw"
}

function Photo({
  item,
  sizes,
  priority,
  caption,
}: {
  item: PhotoCollageItemView
  sizes: string
  priority: boolean
  caption: { "data-qf"?: string }
}) {
  const picture = (
    <ResponsiveImage
      image={item.image}
      sizes={sizes}
      priority={priority}
      className="absolute inset-0 h-full w-full object-cover"
    />
  )
  const words = item.caption && (
    // A plate on the photograph, not a veil over it: the picture keeps its own light
    <figcaption
      className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-inner bg-paper px-2.5 py-1 text-sm font-semibold text-text"
      {...caption}
    >
      {item.caption}
    </figcaption>
  )
  return (
    <figure className="relative h-full overflow-hidden rounded-media bg-media">
      {item.href ? (
        <a
          href={item.href}
          className="absolute inset-0 block rounded-media focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        >
          {picture}
        </a>
      ) : (
        picture
      )}
      {words}
    </figure>
  )
}

/**
 * The photo collage (`photo_collage`, adr/0077 §10): an optional heading
 * and intro over the shop's three to seven photographs. From 1024 px
 * `asymmetric` sets the first one large, two by two, the others in uneven
 * tiles round it, `even` one tile size; below it `scroll` swipes one row
 * sideways with the next photograph peeking, `stack` sets them one under
 * another (two a row from 640 px, the first across). Corners and gaps are
 * the theme's (`rounded-media`, `--gap-columns`); a caption sits on a small
 * paper plate, not a veil; a linked photograph is one link named by its
 * own words. Opening the page, its first photograph loads first; every
 * other lazily.
 */
export function PhotoCollage({ section, first = false }: { section: Collage; first?: boolean }) {
  const id = headingId(section.id)
  const count = section.items.length
  const scroll = section.phone === "scroll"
  const mosaic = section.layout === "asymmetric"
  const phoneSizes = PHONE_SIZES[section.phone]
  return (
    <section
      {...(section.title ? { "aria-labelledby": id } : { "aria-label": section.label })}
      className="gf-section"
    >
      <Container className="flex flex-col gap-(--head-gap)">
        {(section.title ?? section.intro) && (
          <div className="flex max-w-2xl flex-col gap-2 group-data-[align=center]/look:mx-auto group-data-[align=center]/look:items-center group-data-[align=center]/look:text-center">
            {section.title && (
              <h2 id={id} {...fieldMark(section.editor, "title")}>
                {section.title}
              </h2>
            )}
            {section.intro && (
              <p className="text-text-2" {...fieldMark(section.editor, "intro")}>
                {section.intro}
              </p>
            )}
          </div>
        )}
        <ul
          role="list"
          className={cn(
            "gap-(--gap-columns)",
            scroll
              ? "gf-rail -mx-(--gutter) flex scroll-px-(--gutter) overflow-x-auto px-(--gutter) lg:mx-0 lg:overflow-visible lg:px-0"
              : "grid grid-cols-1 sm:grid-cols-2",
            mosaic
              ? "lg:grid lg:auto-rows-[clamp(11rem,15vw,15rem)] lg:grid-cols-4 lg:grid-flow-dense"
              : cn("lg:grid", EVEN_CLASS[EVEN_COLUMNS[count] ?? 3] ?? "lg:grid-cols-3")
          )}
        >
          {section.items.map((item, at) => (
            <li
              key={`${String(at)}-${item.image.src}`}
              className={cn(
                scroll
                  ? "aspect-[4/5] w-[78%] shrink-0 sm:w-[44%]"
                  : cn("aspect-[4/3]", at === 0 && "sm:col-span-2"),
                mosaic ? "lg:aspect-auto lg:w-auto" : "lg:col-span-1 lg:aspect-[4/3] lg:w-auto",
                mosaic && MOSAIC[count]?.[at]
              )}
            >
              <Photo
                item={item}
                sizes={`${wideSize(section, at)}, ${at === 0 && !scroll ? "92vw" : phoneSizes}`}
                priority={first && at === 0}
                caption={fieldMark(section.editor, fieldKey("items", at, "caption"))}
              />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
