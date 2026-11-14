"use client"

import { Pause, Play } from "lucide-react"
import { useRef, useState } from "react"

/**
 * The scrolling strip's pause button (WCAG 2.2.2): the one script the
 * strip has. It marks its strip `data-paused` (the stylesheet holds the
 * loop) and says what pressing it again will do. Before the script runs
 * the strip already stops under the pointer and on focus.
 */
export function MarqueeToggle({ pause, play }: { pause: string; play: string }) {
  const [paused, setPaused] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const Icon = paused ? Play : Pause
  return (
    <button
      ref={button}
      type="button"
      data-part="button"
      className="gf-marquee-toggle"
      aria-label={paused ? play : pause}
      onClick={() => {
        const next = !paused
        setPaused(next)
        button.current?.closest("[data-marquee]")?.toggleAttribute("data-paused", next)
      }}
    >
      <Icon aria-hidden="true" strokeWidth={2} fill="currentColor" />
    </button>
  )
}
