import type { HeroSlideView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { Preload } from "../parts/Preload"
import { type Of, headingId } from "./plan"
import { SliderStage, type SliderWords } from "./SliderStage"

/** The stage fills the container: 1344 px at most (1440 less its gutters). */
const SIZES = "(min-width: 1440px) 1344px, 100vw"
/** A phone's own picture shows under 640 px. */
const PHONE = "(max-width: 39.99rem)"
const WIDE = "(min-width: 40rem)"

/** A slide's picture: a phone's own under 640 px when the shop gave one, else the wide one cropped. */
function Picture({ slide, eager }: { slide: HeroSlideView; eager: boolean }) {
  const { image, mobileImage: phone } = slide
  return (
    <picture>
      {phone?.sources.avif && (
        <source media={PHONE} type="image/avif" srcSet={phone.sources.avif} sizes="100vw" />
      )}
      {phone?.sources.webp && (
        <source media={PHONE} type="image/webp" srcSet={phone.sources.webp} sizes="100vw" />
      )}
      {phone && !phone.sources.avif && !phone.sources.webp && (
        <source media={PHONE} srcSet={phone.src} />
      )}
      {image.sources.avif && <source type="image/avif" srcSet={image.sources.avif} sizes={SIZES} />}
      {image.sources.webp && <source type="image/webp" srcSet={image.sources.webp} sizes={SIZES} />}
      <img
        src={image.src}
        alt={image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding={eager ? "sync" : "async"}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </picture>
  )
}

/** Where a slide's words stand from 640 px, and the veil that keeps them readable there. */
const PLACE = {
  left: "sm:items-start",
  center: "sm:items-center sm:text-center",
  right: "sm:items-end",
} as const
const VEIL = {
  light: {
    left: "sm:bg-linear-to-r sm:from-stage/90 sm:via-stage/75 sm:via-50% sm:to-stage/0",
    right: "sm:bg-linear-to-l sm:from-stage/90 sm:via-stage/75 sm:via-50% sm:to-stage/0",
    center: "sm:bg-stage/60",
  },
  dark: {
    left: "sm:bg-linear-to-r sm:from-paper/90 sm:via-paper/75 sm:via-50% sm:to-paper/0",
    right: "sm:bg-linear-to-l sm:from-paper/90 sm:via-paper/75 sm:via-50% sm:to-paper/0",
    center: "sm:bg-paper/70",
  },
} as const

/**
 * One slide: on a phone the picture over its words on the graphite (the
 * line waits for 640 px); from 640 px the picture fills the stage and the
 * words stand on it at the shop's side, light on a dark veil or dark on a
 * light one. The first slide's heading is the page's h1 when the slider
 * opens the page; every other an h2.
 */
function Slide({
  slide,
  compact,
  heading,
  eager,
  roomForArrows,
}: {
  slide: HeroSlideView
  compact: boolean
  heading: "h1" | "h2"
  eager: boolean
  roomForArrows: boolean
}) {
  const Heading = heading
  const dark = slide.tone === "dark"
  return (
    <div
      className={cn(
        "relative flex h-full flex-col sm:block",
        compact ? "sm:aspect-[2/1] lg:aspect-[3/1]" : "sm:aspect-[16/9] lg:aspect-[12/5]",
        dark && "gf-slide--dark"
      )}
    >
      <div
        className={cn(
          "relative shrink-0 after:absolute after:inset-0 after:bg-linear-to-t after:from-stage after:from-0% after:via-stage/0 after:via-30% after:to-transparent sm:absolute sm:inset-0 sm:after:hidden",
          compact ? "aspect-[2/1]" : "aspect-[16/10]",
          "sm:aspect-auto"
        )}
      >
        <Picture slide={slide} eager={eager} />
        <span
          aria-hidden="true"
          className={cn("absolute inset-0", VEIL[slide.tone][slide.position])}
        />
      </div>
      <div
        className={cn(
          "relative flex flex-1 flex-col gap-4 px-5 pt-3 pb-16 sm:absolute sm:inset-0 sm:justify-center sm:px-10 sm:py-16 lg:gap-6",
          roomForArrows ? "lg:px-24" : "lg:px-14",
          PLACE[slide.position]
        )}
      >
        <div
          className={cn(
            "flex max-w-[36rem] flex-col gap-4 sm:w-[min(36rem,60%)] lg:gap-5",
            slide.position === "center" && "sm:items-center"
          )}
        >
          {slide.heading && (
            <Heading
              // Not merged: tailwind-merge reads the size `text-hero` as a colour and drops it
              className={`max-w-[18ch] text-hero leading-[1.05] tracking-(--tracking-display) text-stage-text${dark ? " sm:text-text" : ""}`}
            >
              {slide.heading}
            </Heading>
          )}
          {slide.text && (
            <p
              className={`hidden max-w-[44ch] text-md text-stage-text-2 sm:block lg:text-lead${dark ? " sm:text-text-2" : ""}`}
            >
              {slide.text}
            </p>
          )}
          {slide.link && (
            <div className="pt-1">
              <a href={slide.link.path} className="gf-btn">
                {slide.link.label}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * The sliding opening (`hero_slider`, adr/0049 Ek 2026-11-06), an extra
 * to the still hero: the container's width on one rounded graphite stage,
 * a slide at a time. It never moves by itself unless the shop turned that
 * on, and then stops on hover, focus, the visitor's own step and reduced
 * motion (`SliderStage`). The stage's height is fixed per the shop's
 * choice (no shift between slides); a phone sees under half its screen.
 */
export function HeroSlider({
  section,
  first,
  t,
}: {
  section: Of<"hero_slider">
  /** The page's first section: its first slide's heading is the h1 and its picture the LCP. */
  first: boolean
  t: Translate
}) {
  const { slides } = section
  const [opening] = slides
  if (!opening) {
    return null
  }
  const total = slides.length
  const words: SliderWords = {
    label: t("home.slider"),
    previous: t("home.slider_previous"),
    next: t("home.slider_next"),
    play: t("home.slider_play"),
    pause: t("home.slider_pause"),
    slides: slides.map((_, index) => t("home.slider_slide", { n: index + 1, total })),
    goTo: slides.map((_, index) => t("home.slider_go", { n: index + 1 })),
  }
  const compact = section.height === "compact"
  // The kit's settings a slider has use for (bilesen-denetimi (b) 4)
  const { settings } = section
  const arrows = settings.arrows !== "hidden" && total > 1
  return (
    <section
      id={headingId(section.id)}
      aria-roledescription="carousel"
      aria-label={words.label}
      className="pt-3 lg:pt-6"
    >
      {first && opening.mobileImage && (
        <Preload image={opening.mobileImage} sizes={SIZES} media={PHONE} />
      )}
      {first && (
        <Preload
          image={opening.image}
          sizes={SIZES}
          {...(opening.mobileImage ? { media: WIDE } : {})}
        />
      )}
      <Container>
        <SliderStage
          words={words}
          autoplay={settings.autoplay === "on"}
          interval={section.interval}
          dots={settings.dots === "on"}
          arrows={arrows ? settings.arrows : "hidden"}
          arrowStyle={settings.arrow_style}
          loop={settings.loop === "on"}
          focusable={slides.some((slide) => !slide.link)}
        >
          {slides.map((slide, index) => (
            <Slide
              key={`${slide.image.src}-${String(index)}`}
              slide={slide}
              compact={compact}
              heading={first && index === 0 ? "h1" : "h2"}
              eager={first && index === 0}
              roomForArrows={arrows}
            />
          ))}
        </SliderStage>
      </Container>
    </section>
  )
}
