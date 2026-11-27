"use client"

import { useEffect, useState } from "react"

const REDUCED = "(prefers-reduced-motion: reduce)"

/**
 * One item at a time among `count`, turning by itself every `every` ms
 * unless held: still until the script knows the visitor does not ask for
 * less motion, paused by the visitor, while the pointer is over it (when
 * `hoverPause`) or focus is inside. A step by hand starts the item's time
 * again. `left` is the item just left and which way, for a slide (none
 * before the first step, so nothing moves on the first paint).
 */
export function useTurns(count: number, every: number, hoverPause = true) {
  const [active, setActive] = useState(0)
  const [left, setLeft] = useState<{ at: number; back: boolean } | null>(null)
  const [paused, setPaused] = useState(false)
  const [over, setOver] = useState(false)
  const [focused, setFocused] = useState(false)
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
  const go = (to: number, back: boolean) => {
    if (to === active) {
      return
    }
    setLeft({ at: active, back })
    setActive(to)
  }
  const step = (by: 1 | -1) => {
    go((active + by + count) % count, by < 0)
  }
  const turning = !still && !paused && !focused && !(over && hoverPause) && count > 1
  useEffect(() => {
    if (!turning) {
      return
    }
    const timer = window.setTimeout(() => {
      setLeft({ at: active, back: false })
      setActive((active + 1) % count)
    }, every)
    return () => {
      window.clearTimeout(timer)
    }
  }, [turning, every, count, active])
  return {
    active,
    left,
    paused,
    turning,
    over,
    focused,
    step,
    go,
    setPaused,
    /** The handlers the turning part carries. */
    hold: {
      onMouseEnter: () => {
        setOver(true)
      },
      onMouseLeave: () => {
        setOver(false)
      },
      onFocus: () => {
        setFocused(true)
      },
      onBlur: (event: { currentTarget: Element; relatedTarget: EventTarget | null }) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      },
    },
  }
}
