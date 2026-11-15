"use client"

import { Pause, Play } from "lucide-react"
import { useEffect, useState } from "react"
import type { AnnouncementSettings } from "@qticaret/types"
import { cn } from "@qticaret/ui/lib/utils"

/** How long a line stays while they take turns, by the shop's step (ms; Dawn's own is 5 s). */
export const ANNOUNCEMENT_INTERVAL: Readonly<Record<AnnouncementSettings["interval"], number>> = {
  slow: 8000,
  medium: 6000,
  fast: 4000,
}

const REDUCED = "(prefers-reduced-motion: reduce)"

/**
 * The announcement bar's lines taking turns in one place (docs/tema/
 * bilesen-denetimi (b) 6). Every line stands in the same grid cell, so the
 * bar is as tall as its tallest line from the first paint (no layout
 * shift) and the server's page shows the first. The turning starts once
 * the script runs, never under reduced motion (the first line stays); it
 * stops under the pointer (when the shop wants), while focus is in the bar
 * and with the pause button (WCAG 2.2.2; never taken away, only shown on
 * hover when the shop picks it, always on a touch screen). Only the shown
 * line is read out; the list speaks up politely only while it is not
 * turning by itself (WAI-ARIA's carousel pattern: a live region that
 * changes every few seconds talks over the page).
 */
export function AnnouncementTurns({
  lines,
  settings,
  words,
}: {
  lines: readonly string[]
  settings: Pick<AnnouncementSettings, "interval" | "pause_button" | "hover_pause">
  words: { announcements: string; pause: string; play: string }
}) {
  const [active, setActive] = useState(0)
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
  const held = focused || (over && settings.hover_pause === "on")
  const turning = !still && !paused && !held
  useEffect(() => {
    if (!turning) {
      return
    }
    const timer = window.setInterval(() => {
      setActive((at) => (at + 1) % lines.length)
    }, ANNOUNCEMENT_INTERVAL[settings.interval])
    return () => {
      window.clearInterval(timer)
    }
  }, [turning, settings.interval, lines.length])
  const Icon = paused ? Play : Pause
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
    >
      <ul
        aria-label={words.announcements}
        aria-live={turning ? "off" : "polite"}
        className="grid min-w-0 flex-1"
      >
        {lines.map((line, index) => (
          <li
            key={index}
            aria-hidden={index === active ? undefined : true}
            data-active={index === active ? "" : undefined}
            className={cn(
              "invisible py-2 text-center font-semibold opacity-0 transition-opacity duration-300 [grid-area:1/1] motion-reduce:transition-none lg:text-left",
              "data-active:visible data-active:opacity-100"
            )}
          >
            {line}
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-part="button"
        aria-label={paused ? words.play : words.pause}
        onClick={() => {
          setPaused(!paused)
        }}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-button text-stage-text-2 hover:text-stage-text pointer-coarse:size-11 motion-reduce:hidden",
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
