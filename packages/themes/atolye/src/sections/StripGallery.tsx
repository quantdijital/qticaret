import { fieldKey, fieldMark } from "@qticaret/ui"
import type { StripGallerySectionView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { Strips } from "../parts/Strips"
import type { StripItem, StripsLook } from "../parts/Strips"
import { SectionHead } from "./SectionHead"
import { type Of, headingId } from "./plan"

/**
 * The strips' height as Atölye draws it (bilesen-standardi §3): a phone's,
 * a tablet's and a wide screen's proportion, a wide screen's held under
 * the viewport's height; each class list written whole so Tailwind finds it.
 */
const HEIGHT: Record<StripGallerySectionView["height"], string> = {
  low: "aspect-[4/3] sm:aspect-[2/1] lg:aspect-[3/1] max-h-[60svh]",
  medium: "aspect-square sm:aspect-[16/9] lg:aspect-[12/5] max-h-[78svh]",
  high: "aspect-[4/5] sm:aspect-[4/3] lg:aspect-[16/9] max-h-[88svh]",
}

/** The strips' share of the screen from 1024 px (vw): the whole width, or the container's. */
const SPAN = { full: 100, boxed: 92 } as const

/** The section's steps as the shared strips read them. */
export const stripsLookOf = (section: StripGallerySectionView): StripsLook => ({
  slant: section.strips_slant,
  line: section.strips_line,
  overlap: section.strips_overlap === "on",
  dim: section.strips_dim === "on",
})

/**
 * The strip gallery (`strip_gallery`, adr/0049 Ek 2026-11-16): two to
 * eight of the shop's photographs as upright strips with slanted seams
 * (`Strips`), the one under the pointer widening, each the whole of it a
 * link to its product, category, collection, brand or the shop's own
 * address, its name and line over its foot. Edge to edge with square
 * corners (`width: full`, the default) or in the container, rounded. A
 * phone or tablet with more strips than it shows scrolls them sideways
 * (`phone="scroll"`), so no strip is lost. The heading (an h2) and its
 * line are the shop's, both optional; without a heading the list is named
 * for a screen reader. Opening the page, its first photograph is the LCP.
 */
export function StripGallery({
  section,
  t,
  first = false,
}: {
  section: Of<"strip_gallery">
  t: Translate
  first?: boolean
}) {
  const id = headingId(section.id)
  const full = section.width === "full"
  const qf = (at: number, part: string) => fieldMark(section.editor, fieldKey("items", at, part))
  const items: StripItem[] = section.items.map((item) => ({
    key: `${String(item.at)}-${item.image.src}`,
    image: item.image,
    href: item.href,
    title: item.title,
    note: item.note,
    titleMark: qf(item.at, "title"),
    noteMark: qf(item.at, "note"),
  }))
  const head =
    section.title || section.text ? (
      <div className="mb-5 flex flex-col gap-2 lg:mb-8">
        {section.title && <SectionHead id={id} title={section.title} marks={section.editor} />}
        {section.text && (
          <p
            className="max-w-2xl text-text-2 group-data-[align=center]/look:mx-auto group-data-[align=center]/look:text-center"
            {...fieldMark(section.editor, "text")}
          >
            {section.text}
          </p>
        )}
      </div>
    ) : null
  const strips = (
    <Strips
      items={items}
      look={stripsLookOf(section)}
      max={8}
      span={SPAN[section.width]}
      phone="scroll"
      priority={first}
      className={HEIGHT[section.height]}
    />
  )
  // Opening the page it sits under the header as the picture band does; edge to edge, right against it
  const top = !first ? "gf-section" : full ? undefined : "pt-3 lg:pt-6"
  return (
    <section
      className={top ? `gf-strip-gallery ${top}` : "gf-strip-gallery"}
      data-width={section.width}
      {...(section.title ? { "aria-labelledby": id } : { "aria-label": t("home.strip_gallery") })}
    >
      {head && <Container>{head}</Container>}
      {full ? strips : <Container>{strips}</Container>}
    </section>
  )
}
