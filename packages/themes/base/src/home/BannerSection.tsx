import { ResponsiveImage } from "@qticaret/ui"
import type { HomeSectionView } from "@qticaret/ui"

type Banner = Extract<HomeSectionView, { type: "banner" }>

/**
 * Pictures with a line and a link, side by side; on a phone they scroll
 * sideways (no script: a row that snaps). A slide's link wraps it whole.
 */
export function BannerSection({ section, label }: { section: Banner; label: string }) {
  return (
    <section aria-label={label}>
      <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 lg:grid lg:grid-flow-col lg:auto-cols-fr lg:overflow-visible">
        {section.slides.map((slide, index) => {
          const body = (
            <figure className="relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card">
              <ResponsiveImage
                image={slide.image}
                sizes="(min-width: 1024px) 33vw, 85vw"
                className="aspect-[4/3] w-full object-cover"
              />
              {(slide.heading ?? slide.text) && (
                <figcaption className="flex flex-col gap-1 p-5">
                  {slide.heading && <span className="font-heading text-xl">{slide.heading}</span>}
                  {slide.text && (
                    <span className="text-sm text-muted-foreground">{slide.text}</span>
                  )}
                </figcaption>
              )}
            </figure>
          )
          return (
            <li
              key={`${slide.image.src}-${String(index)}`}
              className="w-[85%] shrink-0 snap-start lg:w-auto"
            >
              {slide.link ? (
                <a
                  href={slide.link.path}
                  aria-label={slide.heading ?? slide.link.label}
                  className="block h-full"
                >
                  {body}
                </a>
              ) : (
                body
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
