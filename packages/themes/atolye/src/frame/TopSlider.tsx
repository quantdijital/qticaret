"use client"

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import type { TopSliderSettings } from "@qticaret/types"
import { sectionMark } from "@qticaret/ui"
import type { TopSlideView, TopSliderView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { ANNOUNCEMENT_INTERVAL } from "./AnnouncementTurns"
import { useTurns } from "./use-turns"

/** The band's height by the shop's step: 48, 80, 120 px wide, less on a phone (room held from the first paint). */
export const TOP_SLIDER_HEIGHT: Readonly<Record<TopSliderSettings["height"], string>> = {
  thin: "h-10 lg:h-12",
  medium: "h-14 sm:h-16 lg:h-20",
  tall: "h-20 sm:h-24 lg:h-30",
}

/** A phone's own picture shows under 640 px; the band is the window's width. */
const PHONE = "(max-width: 39.99rem)"

export interface TopSliderWords {
  label: string
  previous: string
  next: string
  pause: string
  play: string
  /** Each slide's place ("2 / 3"). */
  slides: readonly string[]
  /** Each dot's "Go to the 2nd". */
  goTo: readonly string[]
}

/** A slide's picture: a phone's own under 640 px when the shop gave one, else the wide one cropped. */
function Picture({ slide, eager }: { slide: TopSlideView; eager: boolean }) {
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
      {image.sources.avif && <source type="image/avif" srcSet={image.sources.avif} sizes="100vw" />}
      {image.sources.webp && <source type="image/webp" srcSet={image.sources.webp} sizes="100vw" />}
      <img
        src={image.src}
        alt={image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </picture>
  )
}

const CONTROL =
  "inline-flex size-8 items-center justify-center rounded-full bg-stage/55 text-stage-text backdrop-blur-sm hover:bg-stage/75 pointer-coarse:size-10"

/**
 * The top image slider (owner 2026-11-27): the shop's pictures across the
 * whole window above everything, one at a time, each a link when the shop
 * gave one. The band's height is the shop's step from the first paint (the
 * pictures cover it), so nothing below moves. It turns by itself every
 * `interval`, sliding or fading (`.gf-turns` in `announcement.css`), never
 * under reduced motion; hover, focus and its pause button stop it (WCAG
 * 2.2.2). Arrows and dots as the shop wants; a labelled carousel whose
 * slides are read one at a time, politely only while it stands still.
 */
export function TopSlider({
  view,
  words,
  mark,
}: {
  view: TopSliderView
  words: TopSliderWords
  /** The section's id in the theme editor's live preview (adr/0065 Faz 2b); absent live. */
  mark?: string | undefined
}) {
  const { slides, settings } = view
  const turns = useTurns(slides.length, ANNOUNCEMENT_INTERVAL[settings.interval])
  const { active, left } = turns
  const slide = settings.transition === "slide"
  const several = slides.length > 1
  const Icon = turns.paused ? Play : Pause
  return (
    <section
      {...sectionMark(mark)}
      aria-roledescription="carousel"
      aria-label={words.label}
      data-top-slider=""
      className={cn("relative w-full overflow-hidden bg-stage", TOP_SLIDER_HEIGHT[settings.height])}
      {...turns.hold}
    >
      <ul
        aria-live={turns.turning ? "off" : "polite"}
        className="gf-turns relative h-full"
        {...(slide ? { "data-transition": "slide" } : {})}
        {...(slide && left?.back ? { "data-back": "" } : {})}
      >
        {slides.map((each, index) => (
          <li
            key={index}
            role="group"
            aria-roledescription="slide"
            aria-label={words.slides[index]}
            aria-hidden={index === active ? undefined : true}
            inert={index !== active}
            data-active={index === active ? "" : undefined}
            className="invisible absolute inset-0 opacity-0 transition-opacity duration-500 motion-reduce:transition-none data-active:visible data-active:opacity-100"
            {...(slide && left !== null && index === active ? { "data-move": "in" } : {})}
            {...(slide && left !== null && index === left.at && index !== active
              ? { "data-move": "out" }
              : {})}
          >
            {each.link ? (
              <a href={each.link.path} className="absolute inset-0 block">
                <Picture slide={each} eager={index === 0} />
              </a>
            ) : (
              <Picture slide={each} eager={index === 0} />
            )}
          </li>
        ))}
      </ul>
      {several && settings.arrows === "on" && (
        <>
          <button
            type="button"
            aria-label={words.previous}
            className={cn(CONTROL, "absolute top-1/2 left-2 -translate-y-1/2")}
            onClick={() => {
              turns.step(-1)
            }}
          >
            <ChevronLeft className="size-4" aria-hidden="true" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label={words.next}
            className={cn(CONTROL, "absolute top-1/2 right-2 -translate-y-1/2")}
            onClick={() => {
              turns.step(1)
            }}
          >
            <ChevronRight className="size-4" aria-hidden="true" strokeWidth={2} />
          </button>
        </>
      )}
      {several && settings.dots === "on" && (
        <div className="absolute inset-x-0 bottom-1 flex justify-center gap-1.5">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={words.goTo[index]}
              aria-current={index === active ? "true" : undefined}
              className="size-2 rounded-full bg-stage-text/50 aria-current:bg-stage-text"
              onClick={() => {
                turns.go(index, index < active)
              }}
            />
          ))}
        </div>
      )}
      {several && (
        <button
          type="button"
          data-part="button"
          aria-label={turns.paused ? words.play : words.pause}
          className={cn(
            CONTROL,
            "absolute top-1/2 right-2 -translate-y-1/2 motion-reduce:hidden",
            settings.arrows === "on" && "right-11 pointer-coarse:right-13"
          )}
          onClick={() => {
            turns.setPaused(!turns.paused)
          }}
        >
          <Icon className="size-3" aria-hidden="true" strokeWidth={2} fill="currentColor" />
        </button>
      )}
    </section>
  )
}
