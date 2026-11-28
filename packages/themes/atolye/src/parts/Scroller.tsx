"use client"

import { Children, useCallback, useEffect, useId, useRef, useState } from "react"
import type { ReactNode } from "react"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import type { ScrollerSettings } from "@qticaret/types"
import { cn } from "@qticaret/ui/lib/utils"
import { useScrollerDrag } from "./scroller-drag"
import { plainTitle } from "./TitleText"
import { SCROLLER_INTERVAL, cardStride, pageTarget, placeOf, stepTarget } from "./scroller-motion"
import type { ScrollerPlace } from "./scroller-motion"

/** The row's words, in the shopper's language (the server's `t`). */
export interface ScrollerWords {
  /** The row's name for a screen reader (its region). */
  label: string
  previous: string
  next: string
  play: string
  pause: string
  /** A dot's name with `{n}` for its number ("{n}. sayfaya geç"). */
  page: string
  /** The dots' group. */
  pages: string
}

const AT_START: ScrollerPlace = { start: true, end: false, page: 0, pages: 1 }

/**
 * The scroller kit (adr/0049 Ek 2026-11-15): one row of cards that the
 * browser scrolls and snaps (CSS scroll-snap: touch, a trackpad and the
 * keyboard's Tab move it with no script), and this one island for what a
 * script adds: the arrows (disabled at either end unless the row loops),
 * the dots, turning by itself and dragging with a mouse. Every count and
 * style is a data attribute `scroller.css` reads (no inline style): the
 * cards in view, the arrows' visibility, shape and place. Turning by
 * itself stops under the pointer and while focus is in the row, has a
 * pause button always in view (WCAG 2.2.2), and never runs for a visitor
 * asking for reduced motion. The dots' row keeps its height before the
 * script measures the pages (no layout shift).
 */
export function Scroller({
  settings,
  words,
  head,
  children,
}: {
  settings: ScrollerSettings
  words: ScrollerWords
  /** The section's head, when the arrows stand beside it. */
  head?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  const track = useRef<HTMLUListElement>(null)
  const [place, setPlace] = useState(AT_START)
  const [hydrated, setHydrated] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [held, setHeld] = useState(false)
  const loop = settings.loop === "on"
  const autoplay = settings.autoplay === "on"
  // `play_button: off` (owner 2026-11-28): no pause on screen, the pointer and focus hold the
  // row; the button stays for the keyboard, shown once it is reached (WCAG 2.2.2)
  const playShown = settings.play_button !== "off"

  useEffect(() => {
    const element = track.current
    if (!element) {
      return
    }
    setHydrated(true)
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setPlace(placeOf(element))
      })
    }
    // A hidden tab's row measures nothing until it shows: its size changes then
    const resized = new ResizeObserver(measure)
    resized.observe(element)
    element.addEventListener("scroll", measure, { passive: true })
    measure()
    return () => {
      cancelAnimationFrame(frame)
      resized.disconnect()
      element.removeEventListener("scroll", measure)
    }
  }, [])

  const scrollTo = useCallback(
    (left: number) => {
      track.current?.scrollTo({ left, behavior: reduced ? "auto" : "smooth" })
    },
    [reduced]
  )
  const step = (by: -1 | 1) => {
    if (track.current) {
      scrollTo(stepTarget(track.current, by, loop))
    }
  }

  const playing = autoplay && hydrated && !reduced && !stopped && !held && place.pages > 1
  const byCard = settings.autoplay_step === "card"
  useEffect(() => {
    if (!playing) {
      return
    }
    const timer = window.setInterval(() => {
      // Turning by itself always comes back to the start at the end; a page
      // on, or one card when the shop asked for that (the arrows step a page)
      const element = track.current
      if (element) {
        scrollTo(stepTarget(element, 1, true, byCard ? cardStride(element) : element.clientWidth))
      }
    }, SCROLLER_INTERVAL[settings.speed])
    return () => {
      window.clearInterval(timer)
    }
  }, [playing, scrollTo, settings.speed, byCard])

  useScrollerDrag(track, settings.drag === "on")

  // Every card in view (measured, so never before the script runs): no
  // arrows, dots nor pause, as there is nothing to move; a resize that
  // makes the row overflow measures again and brings them back (V-04)
  const fits = hydrated && place.pages <= 1
  const arrows =
    settings.arrows === "hidden" || fits ? null : (
      <div className="gf-scroller-arrows" data-position={settings.arrow_position}>
        <button
          type="button"
          className="gf-scroller-arrow"
          aria-label={words.previous}
          aria-controls={id}
          disabled={!loop && place.start}
          onClick={() => {
            step(-1)
          }}
        >
          <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="gf-scroller-arrow"
          aria-label={words.next}
          aria-controls={id}
          disabled={!loop && place.end}
          onClick={() => {
            step(1)
          }}
        >
          <ChevronRight aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </button>
      </div>
    )
  const besideHead = settings.arrow_position === "head"
  const dots = settings.dots === "on"
  return (
    <div
      role="region"
      aria-label={plainTitle(words.label)}
      className="gf-scroller flex flex-col gap-(--head-gap-s)"
      data-desktop={settings.desktop}
      data-mobile={settings.mobile}
      data-arrows={settings.arrows}
      data-arrow-style={settings.arrow_style}
      data-focus={settings.focus === "on" ? "center" : undefined}
      onMouseEnter={() => {
        setHeld(true)
      }}
      onMouseLeave={() => {
        setHeld(false)
      }}
      onFocus={() => {
        setHeld(true)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHeld(false)
        }
      }}
    >
      {(head ?? (besideHead && arrows)) && (
        <div className="gf-scroller-head flex items-end gap-4">
          <div className="min-w-0 flex-1">{head}</div>
          {besideHead && arrows}
        </div>
      )}
      <div className="relative">
        <ul
          id={id}
          ref={track}
          className="gf-scroller-track"
          data-drag={settings.drag === "on" ? "" : undefined}
        >
          {Children.toArray(children).map((child, index) => (
            <li key={index}>{child}</li>
          ))}
        </ul>
        {!besideHead && arrows}
      </div>
      {(dots || autoplay) && (
        <div
          className={cn(
            "flex items-center justify-center gap-1",
            (dots || playShown) && "min-h-11"
          )}
        >
          {/* The visitor's own word, whatever holds the row now (the pointer, focus) */}
          {autoplay && !reduced && !fits && (
            <button
              type="button"
              className={cn("gf-scroller-arrow", !playShown && "sr-only focus-visible:not-sr-only")}
              aria-label={stopped ? words.play : words.pause}
              onClick={() => {
                setStopped(!stopped)
              }}
            >
              {!stopped ? (
                <Pause aria-hidden="true" className="size-4" strokeWidth={2} />
              ) : (
                <Play aria-hidden="true" className="size-4" strokeWidth={2} />
              )}
            </button>
          )}
          {dots && hydrated && place.pages > 1 && (
            <div role="group" aria-label={words.pages} className="flex items-center">
              {Array.from({ length: place.pages }, (_, page) => (
                <button
                  key={page}
                  type="button"
                  aria-label={words.page.replace("{n}", String(page + 1))}
                  aria-current={page === place.page ? "true" : undefined}
                  className="group inline-flex h-11 min-w-11 items-center justify-center pointer-fine:min-w-7"
                  onClick={() => {
                    if (track.current) {
                      scrollTo(pageTarget(track.current, page))
                    }
                  }}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2 rounded-pill transition-colors",
                      page === place.page ? "w-6 bg-text" : "w-2 bg-rule group-hover:bg-edge"
                    )}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
