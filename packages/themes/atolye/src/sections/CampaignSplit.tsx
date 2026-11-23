import { fieldKey, fieldMark } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { BandPicture } from "./BandPicture"
import { buttonClass } from "./campaign-steps"
import type { Of } from "./plan"

/** The band's variants this theme draws beside today's slides (`drawnVariant`). */
export const BANNER_VARIANTS = ["split"] as const

/** The picture's height: a phone's proportion, then from 1024 px the band's least. */
const HEIGHT = {
  low: "aspect-[16/9] lg:aspect-auto lg:min-h-72",
  medium: "aspect-[4/3] lg:aspect-auto lg:min-h-96",
  high: "aspect-[4/5] lg:aspect-auto lg:min-h-[32rem]",
} as const

/**
 * The split band (`banner`, adr/0077 Ek, "Bölünmüş bant"): the first
 * slide's picture on the left, its words on the right on the section's
 * ground (`ground`, the shop's look; the dark stage unless it set one,
 * `Blocks` keeps it off the box): an upper line, the heading, the line and
 * one or two buttons in the shop's style. The picture's inner edge meets
 * the ground straight or in a soft bow (`edge`, `split.css`); on a phone
 * the picture is on top, the bow at its foot. In the container with
 * rounded corners or edge to edge, as the band's width says.
 */
export function CampaignSplit({
  section,
  ground,
  label,
  first = false,
}: {
  section: Of<"banner">
  ground: "page" | "well" | "stage" | "primary"
  label: string
  first?: boolean
}) {
  const slide = section.slides[0]
  if (!slide) {
    return null
  }
  const links = [slide.link, slide.secondLink].filter((link) => link !== null)
  const qf = (part: string) => fieldMark(section.editor, fieldKey("slides", 0, part))
  const full = section.width === "full"
  const box = (
    <div
      data-ground={ground}
      data-edge={section.edge ?? "straight"}
      className={cn(
        "gf-ground gf-split grid overflow-clip lg:grid-cols-2",
        ground === "stage" && "gf-stage",
        !full && "rounded-tile"
      )}
    >
      <div className={cn("gf-split-picture relative isolate", HEIGHT[section.height])}>
        <BandPicture
          image={slide.image}
          phone={slide.mobileImage}
          sizes="(min-width: 1024px) 50vw, 100vw"
          eager={first}
          mark={qf("image")}
        />
      </div>
      <div className="flex flex-col items-start justify-center gap-3 p-6 sm:p-8 lg:p-12">
        {section.eyebrow && (
          <p
            className="text-sm font-semibold tracking-wide text-text-2 uppercase"
            {...fieldMark(section.editor, "eyebrow")}
          >
            {section.eyebrow}
          </p>
        )}
        {slide.heading && (
          <h2 className="text-display" {...qf("heading")}>
            {slide.heading}
          </h2>
        )}
        {slide.text && (
          <p className="text-text-2" {...qf("text")}>
            {slide.text}
          </p>
        )}
        {links.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
            {links.map((link, drawn) => (
              <a
                key={`${link.path}-${String(drawn)}`}
                href={link.path}
                className={buttonClass(section.button_style, drawn === 1)}
                {...qf(drawn === 0 && !slide.secondFirst ? "link" : "second_link")}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
  // Opening the page it sits under the header as the hero does; edge to edge, right against it
  const top = !first ? "gf-section" : full ? undefined : "pt-3 lg:pt-6"
  return (
    <section aria-label={label} className={top}>
      {full ? box : <Container>{box}</Container>}
    </section>
  )
}
