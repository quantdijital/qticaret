import { ResponsiveImage } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import type { Of } from "./plan"

/**
 * The shop's campaign or collection banner (`banner`), its slides side by
 * side, never sliding by themselves (WCAG 2.2.2): one slide fills the
 * container at 21:9 (4:5 on a phone) with its heading, line and link on
 * the photograph's dark foot; two or three share the row. Only the
 * shop's own words and picture.
 */
export function Campaign({ section, label }: { section: Of<"banner">; label: string }) {
  const slides = section.slides.slice(0, 3)
  if (slides.length === 0) {
    return null
  }
  return (
    <section aria-label={label} className="pt-(--section-gap)">
      <Container>
        <ul
          className={cn(
            "grid gap-(--gap-columns)",
            slides.length === 2 && "lg:grid-cols-[repeat(2,minmax(0,1fr))]",
            slides.length === 3 && "lg:grid-cols-[repeat(3,minmax(0,1fr))]"
          )}
        >
          {slides.map((slide) => (
            <li
              key={slide.image.src}
              className={cn(
                "gf-stage relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-tile after:absolute after:inset-0 after:-z-10 after:bg-linear-to-t after:from-stage after:from-10% after:via-stage/0 after:via-60% after:to-transparent",
                slides.length === 1 ? "sm:aspect-[21/9]" : "sm:aspect-[4/3]"
              )}
            >
              <ResponsiveImage
                image={slide.image}
                sizes={slides.length === 1 ? "100vw" : "(min-width: 1024px) 45vw, 100vw"}
                className="absolute inset-0 -z-10 h-full w-full object-cover"
              />
              <div className="flex max-w-xl flex-col gap-3 p-5 sm:p-8 lg:p-12">
                {slide.heading && <h2 className="text-section">{slide.heading}</h2>}
                {slide.text && <p className="text-stage-text-2">{slide.text}</p>}
                {slide.link && (
                  <div className="pt-1">
                    <a href={slide.link.path} className="gf-btn">
                      {slide.link.label}
                    </a>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
