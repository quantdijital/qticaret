import { fieldKey, fieldMark } from "@qticaret/ui"
import type { BannerSlideView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { BandPicture } from "./BandPicture"
import { COLUMN, HEIGHT, ROW, WORDS, buttonClass, placeOf, sizesOf } from "./campaign-steps"
import type { Of } from "./plan"

/**
 * One slide: the picture fills it, the words stand where the shop put
 * them, light on the graphite's veil or dark on the counter's (`banner.css`
 * keeps them readable at every step), with one or two buttons.
 */
function Slide({
  slide,
  section,
  count,
  eager,
  at,
}: {
  slide: BannerSlideView
  section: Of<"banner">
  count: number
  eager: boolean
  /** Its place among the design's slides, for the editor's field marks. */
  at: number
}) {
  const { row, column } = placeOf(section.text_position)
  const height = HEIGHT[section.height]
  const dark = slide.tone === "dark"
  const links = [slide.link, slide.secondLink].filter((link) => link !== null)
  // The editor's field marks (adr/0065 Faz 2b): in its live preview only
  const qf = (part: string) => fieldMark(section.editor, fieldKey("slides", at, part))
  return (
    <li
      data-tone={slide.tone}
      data-overlay={section.overlay}
      data-row={row}
      data-column={column}
      className={cn(
        // Clipped, not hidden: a slide whose words outgrow its proportion grows to fit them
        "gf-band relative isolate flex flex-col overflow-clip",
        dark ? "bg-paper-2" : "gf-stage",
        section.width === "boxed" && "rounded-tile",
        height.phone,
        count === 1 ? height.one : height.many,
        ROW[row],
        COLUMN[column]
      )}
    >
      <BandPicture
        image={slide.image}
        phone={slide.mobileImage}
        sizes={sizesOf(count)}
        eager={eager}
        mark={qf("image")}
      />
      <span aria-hidden="true" className="gf-band-veil" />
      <div className={cn("flex max-w-xl flex-col p-5 sm:p-8 lg:p-12", COLUMN[column])}>
        <div className={cn("gf-band-words flex flex-col gap-3", WORDS[column])}>
          {slide.heading && (
            <h2 className="text-display" {...qf("heading")}>
              {slide.heading}
            </h2>
          )}
          {slide.text && (
            <p className={dark ? "text-text" : "text-stage-text"} {...qf("text")}>
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
    </li>
  )
}

/**
 * The shop's campaign or collection band (`banner`, adr/0049 Ek 2026-11-14
 * §3.3 E2), its slides side by side, never sliding by themselves (WCAG
 * 2.2.2): one fills the row, two or three share it from 1024 px. In the
 * container with rounded corners, or edge to edge; low, medium or high;
 * the words in one of nine places. Only the shop's own words and
 * pictures; the first slide's picture is asked for at once when the band
 * opens the page (it is the LCP then).
 */
export function Campaign({
  section,
  label,
  first = false,
}: {
  section: Of<"banner">
  label: string
  first?: boolean
}) {
  const slides = section.slides.slice(0, 3)
  if (slides.length === 0) {
    return null
  }
  const list = (
    <ul
      className={cn(
        "grid items-stretch justify-items-stretch gap-(--gap-columns)",
        slides.length === 2 && "lg:grid-cols-[repeat(2,minmax(0,1fr))]",
        slides.length === 3 && "lg:grid-cols-[repeat(3,minmax(0,1fr))]"
      )}
    >
      {slides.map((slide, at) => (
        <Slide
          key={`${slide.image.src}-${String(at)}`}
          slide={slide}
          section={section}
          count={slides.length}
          eager={first && at === 0}
          at={at}
        />
      ))}
    </ul>
  )
  const full = section.width === "full"
  // Opening the page it sits under the header as the hero does; edge to edge, right against it
  const top = !first ? "gf-section" : full ? undefined : "pt-3 lg:pt-6"
  return (
    <section aria-label={label} className={top}>
      {full ? list : <Container>{list}</Container>}
    </section>
  )
}
