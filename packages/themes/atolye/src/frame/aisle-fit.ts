"use client"

import { useLayoutEffect, useRef, useState } from "react"

/**
 * How many of the widths fit on one line `room` wide, `gap` between
 * them; when not all do (or `always`: the "Daha fazla" button holds
 * something else too), the button (`more` wide) takes its place after the
 * ones that fit. Pure, for the test.
 */
export function aisleFit(
  widths: readonly number[],
  more: number,
  gap: number,
  room: number,
  always = false
) {
  const line = (count: number) =>
    widths.slice(0, count).reduce((sum, width) => sum + width, 0) + gap * Math.max(0, count - 1)
  if (!always && line(widths.length) <= room + 0.5) {
    return widths.length
  }
  let count = always ? widths.length : widths.length - 1
  while (count > 0 && line(count) + gap + more > room + 0.5) {
    count -= 1
  }
  return count
}

/** What a measured menu bar keeps on its line: how many categories, and whether the shop's links stay. */
export interface BarFit {
  count: number
  links: boolean
}

/** The measured widths a menu bar decides with. */
export interface BarSizes {
  widths: readonly number[]
  more: number
  gap: number
  /** The highlighted link's width after the categories; 0: none. */
  tail: number
  /** The shop's top links at the bar's end (`top_links: bar`); 0: none. */
  links: number
  /** The bar's own gap between the main menu and the links. */
  between: number
}

/**
 * The menu bar's line (adr/0049 Ek 2026-11-15): `room` is the line's
 * width with the links' room added back. The shop's links stay at the
 * bar's end only while every category fits beside them; otherwise they go
 * under "Daha fazla" (which then always shows) and the categories take the
 * whole line. Without links, `aisleFit` as before. Pure, for the test.
 */
export function barFit(sizes: BarSizes, room: number): BarFit {
  const { widths, more, gap, tail, links, between } = sizes
  const line = room - (tail > 0 ? tail + gap : 0)
  if (links > 0 && aisleFit(widths, more, gap, line - links - between) === widths.length) {
    return { count: widths.length, links: true }
  }
  return { count: aisleFit(widths, more, gap, line, links > 0), links: false }
}

/**
 * The menu bar's main menu on one line (adr/0049 Ek 2026-11-15, Tezgâh
 * K-03): the items that fit stay, the rest go under "Daha fazla". The
 * first render (and the server's) draws every item on a line that clips
 * what does not fit (and the shop's links, when the bar has them, at its
 * end), so nothing wraps or shifts; once laid out, each item's width is
 * read (`data-aisle-item`, and the "Daha fazla" item's, `data-aisle-more`,
 * and the links group's, `links`) and kept, and the bar's width decides
 * how many stay and whether the links do, again whenever it changes. An
 * item always shown after them (the bar's highlighted link,
 * `data-aisle-tail`) keeps its own width of the line, so it stands right
 * after the last one (Tezgâh audit Y-05). The widths are read again when
 * the web fonts arrive. `null`: not measured yet, or not in the bar.
 * `shape` changes with the items (the editor's preview): drawn whole,
 * then measured again.
 */
export function useAisleFit(shape: string, on: boolean) {
  const list = useRef<HTMLUListElement>(null)
  const links = useRef<HTMLElement>(null)
  const sizes = useRef<(BarSizes & { shape: string }) | null>(null)
  const [fit, setFit] = useState<BarFit | null>(null)
  // Whether the links take their room beside the line now (the line is that much narrower)
  const linksShown = useRef(true)

  const decide = (line: HTMLUListElement) => {
    const measured = sizes.current
    if (measured) {
      const kept = linksShown.current && measured.links > 0
      const next = barFit(
        measured,
        line.clientWidth + (kept ? measured.links + measured.between : 0)
      )
      linksShown.current = next.links
      setFit((was) => (was?.count === next.count && was.links === next.links ? was : next))
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
      if (sizes.current?.shape !== shape) {
        setFit(null)
      }
      return
    }
    const items = [...line.querySelectorAll<HTMLElement>(":scope > [data-aisle-item]")]
    const more = line.querySelector<HTMLElement>(":scope > [data-aisle-more]")
    const tail = line.querySelector<HTMLElement>(":scope > [data-aisle-tail]")
    const group = links.current
    const bar = group?.parentElement
    sizes.current = {
      shape,
      widths: items.map((item) => item.getBoundingClientRect().width),
      more: more?.getBoundingClientRect().width ?? 0,
      gap: Number.parseFloat(getComputedStyle(line).columnGap) || 0,
      tail: tail?.getBoundingClientRect().width ?? 0,
      links: group?.getBoundingClientRect().width ?? 0,
      between: bar ? Number.parseFloat(getComputedStyle(bar).columnGap) || 0 : 0,
    }
    linksShown.current = true
    decide(line)
  }, [on, fit, shape])

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

  return { list, links, fit }
}
