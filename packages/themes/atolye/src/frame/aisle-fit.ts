"use client"

import { useLayoutEffect, useRef, useState } from "react"

/**
 * How many of the widths fit on one line `room` wide, `gap` between
 * them; when not all do, the "Daha fazla" button (`more` wide) takes its
 * place after the ones that fit. Pure, for the test.
 */
export function aisleFit(widths: readonly number[], more: number, gap: number, room: number) {
  const line = (count: number) =>
    widths.slice(0, count).reduce((sum, width) => sum + width, 0) + gap * Math.max(0, count - 1)
  if (line(widths.length) <= room + 0.5) {
    return widths.length
  }
  let count = widths.length - 1
  while (count > 0 && line(count) + gap + more > room + 0.5) {
    count -= 1
  }
  return count
}

/**
 * The menu bar's main menu on one line (adr/0049 Ek 2026-11-15, Tezgâh
 * K-03): the items that fit stay, the rest go under "Daha fazla". The
 * first render (and the server's) draws every item on a line that clips
 * what does not fit, so nothing wraps or shifts; once laid out, each
 * item's width is read (`data-aisle-item`, and the "Daha fazla" item's,
 * `data-aisle-more`) and kept, and the line's width decides how many
 * stay, again whenever it changes. The widths are read again when the
 * web fonts arrive. `null`: not measured yet, or not in the bar.
 */
export function useAisleFit(count: number, on: boolean) {
  const list = useRef<HTMLUListElement>(null)
  const sizes = useRef<{ count: number; widths: number[]; more: number; gap: number } | null>(null)
  const [fit, setFit] = useState<number | null>(null)

  const decide = (line: HTMLUListElement) => {
    if (sizes.current) {
      const { widths, more, gap } = sizes.current
      setFit(aisleFit(widths, more, gap, line.clientWidth))
    }
  }

  // The measuring pass: every item on the line, each one's width read once
  useLayoutEffect(() => {
    const line = list.current
    if (!on || !line) {
      return
    }
    if (fit !== null) {
      // Another set of items (the editor's preview): drawn whole, then measured
      if (sizes.current?.count !== count) {
        setFit(null)
      }
      return
    }
    const items = [...line.querySelectorAll<HTMLElement>(":scope > [data-aisle-item]")]
    const more = line.querySelector<HTMLElement>(":scope > [data-aisle-more]")
    sizes.current = {
      count,
      widths: items.map((item) => item.getBoundingClientRect().width),
      more: more?.getBoundingClientRect().width ?? 0,
      gap: Number.parseFloat(getComputedStyle(line).columnGap) || 0,
    }
    decide(line)
  }, [on, fit, count])

  useLayoutEffect(() => {
    const line = list.current
    if (!on || !line) {
      return
    }
    const sized = new ResizeObserver(() => {
      decide(line)
    })
    sized.observe(line)
    let live = true
    if (document.fonts.status !== "loaded") {
      void document.fonts.ready.then(() => {
        if (live) {
          // Every item drawn again, its width read with the shop's face
          sizes.current = null
          setFit(null)
        }
      })
    }
    return () => {
      live = false
      sized.disconnect()
    }
  }, [on])

  return { list, fit }
}
