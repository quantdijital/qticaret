"use client"

import { ChevronDown } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/** The closed text's height (`.gf-more` in `pages.css`, 26rem). */
const LIMIT = 416
/** What a toggle must hide to be worth it, and how far past the height a block may end: parts of it. */
const SLACK = 0.385
const ROOM = 0.23
/** A block the closed text leaves out: not laid out at all, so nothing hides under what follows. */
const MARK = "data-more-hidden"

/**
 * Where the closed text ends: after the last whole block within about
 * 26rem (never on a heading; a start too short takes the next block with
 * its heading too), the blocks after it marked out. `fits`: nothing worth
 * hiding; `clip`: a first block alone far taller, or one block holding
 * it all, so the stylesheet cuts it at 26rem instead.
 */
function cut(prose: Element): { fits: boolean; clip: boolean } {
  const blocks = [...prose.children]
  for (const block of blocks) {
    block.removeAttribute(MARK)
  }
  const top = prose.getBoundingClientRect().top
  if (prose.getBoundingClientRect().height <= LIMIT * (1 + SLACK)) {
    return { fits: true, clip: false }
  }
  const ends = blocks.map((block) => block.getBoundingClientRect().bottom - top)
  const heading = (n: number) => /^H[2-6]$/.test(blocks[n]?.tagName ?? "")
  let keep = Math.max(1, ends.filter((end) => end <= LIMIT * (1 + ROOM)).length)
  while (keep > 1 && heading(keep - 1)) {
    keep -= 1
  }
  // Too short a start: the next block (with its heading) too, while it ends within twice the height
  if ((ends[keep - 1] ?? 0) < LIMIT * 0.6) {
    let next = keep
    while (next < blocks.length - 1 && heading(next)) {
      next += 1
    }
    if ((ends[next] ?? Infinity) <= LIMIT * 2) {
      keep = next + 1
    }
  }
  if ((ends[keep - 1] ?? 0) > LIMIT * 2 || keep >= blocks.length) {
    return { fits: false, clip: true }
  }
  for (const block of blocks.slice(keep)) {
    block.setAttribute(MARK, "")
  }
  return { fits: false, clip: false }
}

/**
 * A long description opens at about half (sahip 2026-11-05: "açıklama
 * yarısı açık gelsin"): its blocks up to about 26rem, the last fading
 * out over a real toggle, "Devamını oku" / "Daha az göster", that keeps
 * the focus and, closing, keeps itself where it was on the screen.
 * Without the script the whole text shows and no toggle (`scripting:
 * none`); with it the stylesheet cuts it at 26rem from the first paint
 * when the server judged it long (`long`), then the measure cuts it
 * between whole blocks. A link inside a cut part, reached by Tab, opens it.
 */
export function ReadMore({
  id,
  long,
  more,
  less,
  children,
}: {
  id: string
  /** The server's guess from the text's length: closed from the first paint. */
  long: boolean
  more: string
  less: string
  children: ReactNode
}) {
  const body = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const kept = useRef<number | null>(null)
  const [fits, setFits] = useState(!long)
  const [open, setOpen] = useState(false)
  const [clip, setClip] = useState(true)

  // The text's whole height decides, once laid out (a hidden tab measures
  // nothing yet) and again when its width changes
  useEffect(() => {
    const text = body.current
    const prose = text?.firstElementChild
    if (!text || !prose) {
      return
    }
    let width = 0
    const measure = () => {
      const now = text.getBoundingClientRect().width
      if (now === 0 || now === width) {
        return
      }
      width = now
      const result = cut(prose)
      setFits(result.fits)
      setClip(result.clip)
    }
    measure()
    const resized = new ResizeObserver(measure)
    resized.observe(text)
    return () => {
      resized.disconnect()
    }
  }, [])

  // Closing: the toggle stays where it was on the screen, the page moves instead
  useLayoutEffect(() => {
    const before = kept.current
    kept.current = null
    if (before === null || !toggle.current) {
      return
    }
    const moved = toggle.current.getBoundingClientRect().top - before
    if (Math.abs(moved) > 1) {
      window.scrollBy({ top: moved, behavior: "instant" })
    }
  }, [open])

  return (
    <div className="gf-more flex flex-col gap-4" data-open={open || fits ? "true" : "false"}>
      <div
        ref={body}
        id={id}
        className="gf-more-body"
        data-cut={clip ? undefined : ""}
        onFocus={(event) => {
          // Only a link under the cut (a cut block's links are not laid out at all)
          const edge = event.currentTarget.getBoundingClientRect().bottom
          if (!open && !fits && event.target.getBoundingClientRect().bottom > edge) {
            setOpen(true)
          }
        }}
      >
        {children}
      </div>
      {!fits && (
        <button
          ref={toggle}
          type="button"
          className="gf-btn gf-btn--quiet gf-btn--small gf-more-toggle self-start"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            if (open && toggle.current) {
              kept.current = toggle.current.getBoundingClientRect().top
            }
            setOpen(!open)
          }}
        >
          {open ? less : more}
          <ChevronDown
            className={cn("size-4", open && "rotate-180")}
            aria-hidden="true"
            strokeWidth={2}
          />
        </button>
      )}
    </div>
  )
}
