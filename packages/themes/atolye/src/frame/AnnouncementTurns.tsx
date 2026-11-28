"use client"

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { useEffect, useState } from "react"
import type { AnnouncementSettings } from "@qticaret/types"
import type { LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { AnnouncementLine } from "./announcement-line"
import { announcementStepsOf } from "./announcement-steps"

/** How long a line stays while they take turns, by the shop's step (ms; Dawn's own is 5 s). */
export const ANNOUNCEMENT_INTERVAL: Readonly<Record<AnnouncementSettings["interval"], number>> = {
  slow: 8000,
  medium: 6000,
  fast: 4000,
}

const REDUCED = "(prefers-reduced-motion: reduce)"

/** The turning bar's words; the arrows' and each line's place only where they are drawn. */
export interface AnnouncementTurnsWords {
  announcements: string
  pause: string
  play: string
  previous?: string
  next?: string
  /** Each line's place ("2 / 3"), read with it. */
  slides?: readonly string[]
}

type Turning = Pick<AnnouncementSettings, "interval" | "pause_button" | "hover_pause"> &
  Partial<Pick<AnnouncementSettings, "align" | "size" | "transition" | "arrows">>

/**
 * The announcement bar's lines taking turns in one place (docs/tema/
 * bilesen-denetimi (b) 6), a slider when the shop wants (owner 2026-11-27:
 * `transition: slide`, `arrows: on`, each line its own link). Every line
 * stands in the same grid cell, so the bar is as tall as its tallest line
 * from the first paint (no layout shift) and the server's page shows the
 * first. The turning starts once the script runs, never under reduced
 * motion (the first line stays; the arrows still step); it stops under the
 * pointer (when the shop wants), while focus is in the bar and with the
 * pause button (WCAG 2.2.2; never taken away, only shown on hover when the
 * shop picks it, always on a touch screen). A step by an arrow starts the
 * line's time again. Only the shown line is read out; the list speaks up
 * politely only while it is not turning by itself (WAI-ARIA's carousel
 * pattern: a live region that changes every few seconds talks over the page).
 */
export function AnnouncementTurns({
  lines,
  links,
  settings,
  words,
  keys,
}: {
  lines: readonly string[]
  /** Each line's own link, by its place; none: words only. */
  links?: readonly (LinkView | null)[] | undefined
  /** Each line's field key in the editor's live preview (adr/0065 Faz 2b); none elsewhere. */
  keys?: readonly string[] | undefined
  settings: Turning
  words: AnnouncementTurnsWords
}) {
  const [active, setActive] = useState(0)
  // The line just left and which way the last step went, for the slide; none before the first
  const [left, setLeft] = useState<{ at: number; back: boolean } | null>(null)
  const [paused, setPaused] = useState(false)
  // The pointer over the bar (it shows a hover-only button), and whether that stops the turning
  const [over, setOver] = useState(false)
  const [focused, setFocused] = useState(false)
  // Still until the script knows the visitor does not ask for less motion
  const [still, setStill] = useState(true)
  useEffect(() => {
    const query = window.matchMedia(REDUCED)
    const read = () => {
      setStill(query.matches)
    }
    read()
    query.addEventListener("change", read)
    return () => {
      query.removeEventListener("change", read)
    }
  }, [])
  const count = lines.length
  const step = (by: 1 | -1) => {
    setLeft({ at: active, back: by < 0 })
    setActive((active + by + count) % count)
  }
  const held = focused || (over && settings.hover_pause === "on")
  const turning = !still && !paused && !held
  useEffect(() => {
    if (!turning) {
      return
    }
    // Restarted on every step, so a line an arrow brought stays its full time
    const timer = window.setTimeout(() => {
      setLeft({ at: active, back: false })
      setActive((active + 1) % count)
    }, ANNOUNCEMENT_INTERVAL[settings.interval])
    return () => {
      window.clearTimeout(timer)
    }
  }, [turning, settings.interval, count, active])
  const Icon = paused ? Play : Pause
  const { align, size } = announcementStepsOf(settings)
  const slide = settings.transition === "slide"
  const arrows = settings.arrows === "on"
  const arrow = cn(
    "inline-flex",
    size.button,
    "shrink-0 items-center justify-center rounded-button text-stage-text-2 hover:text-stage-text pointer-coarse:size-11"
  )
  return (
    <div
      data-announcement-turns=""
      data-pause-button={settings.pause_button}
      className="flex min-w-0 items-center gap-2"
      onMouseEnter={() => {
        setOver(true)
      }}
      onMouseLeave={() => {
        setOver(false)
      }}
      onFocus={() => {
        setFocused(true)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      {...(arrows ? { role: "group", "aria-roledescription": "carousel" } : {})}
      {...(arrows ? { "aria-label": words.announcements } : {})}
    >
      {arrows && (
        <button
          type="button"
          data-part="previous"
          aria-label={words.previous}
          onClick={() => {
            step(-1)
          }}
          className={arrow}
        >
          <ChevronLeft className="size-4" aria-hidden="true" strokeWidth={2} />
        </button>
      )}
      <ul
        aria-label={words.announcements}
        aria-live={turning ? "off" : "polite"}
        className={cn("grid min-w-0 flex-1", slide && "gf-turns")}
        {...(slide ? { "data-transition": "slide" } : {})}
        {...(slide && left?.back ? { "data-back": "" } : {})}
      >
        {lines.map((line, index) => (
          <li
            key={index}
            {...(keys?.[index] ? { "data-qf": keys[index] } : {})}
            aria-hidden={index === active ? undefined : true}
            data-active={index === active ? "" : undefined}
            className={cn(
              "invisible",
              size.pad,
              align.text,
              "font-semibold opacity-0 transition-opacity duration-300 [grid-area:1/1] motion-reduce:transition-none",
              align.textWide,
              "data-active:visible data-active:opacity-100"
            )}
            // The slide's two moving lines: the one coming in and the one it pushes out
            {...(slide && left !== null && index === active ? { "data-move": "in" } : {})}
            {...(slide && left !== null && index === left.at && index !== active
              ? { "data-move": "out" }
              : {})}
            {...(arrows && words.slides?.[index]
              ? {
                  role: "group",
                  "aria-roledescription": "slide",
                  "aria-label": words.slides[index],
                }
              : {})}
          >
            <AnnouncementLine line={line} link={links?.[index]} />
          </li>
        ))}
      </ul>
      {arrows && (
        <button
          type="button"
          data-part="next"
          aria-label={words.next}
          onClick={() => {
            step(1)
          }}
          className={arrow}
        >
          <ChevronRight className="size-4" aria-hidden="true" strokeWidth={2} />
        </button>
      )}
      <button
        type="button"
        data-part="button"
        aria-label={paused ? words.play : words.pause}
        onClick={() => {
          setPaused(!paused)
        }}
        className={cn(
          "inline-flex",
          size.button,
          "shrink-0 items-center justify-center rounded-button text-stage-text-2 hover:text-stage-text pointer-coarse:size-11 motion-reduce:hidden",
          // Shown on hover only where there is hover; a touch screen always shows it
          settings.pause_button === "hover" &&
            !over &&
            !focused &&
            "[@media(hover:hover)]:opacity-0"
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" strokeWidth={2} fill="currentColor" />
      </button>
    </div>
  )
}
