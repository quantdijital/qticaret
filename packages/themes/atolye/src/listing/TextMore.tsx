"use client"

import { ChevronDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/** The closed text's lines (`.gf-ltext` in `listing-text.css`, 6lh). */
const LINES = 6
/** A toggle hides at least this part of the closed height again: two lines more is no reason to fold. */
const SLACK = 1.35

/**
 * A listing's long text folded to its first six lines (adr/0075 §7), the
 * last fading out over a real toggle, "Devamını oku" / "Daha az göster"
 * (`aria-expanded`). The whole text is in the HTML either way: the fold
 * only limits its height. Without the script it shows whole and no toggle
 * (`scripting: none`); with it the stylesheet folds it from the first
 * paint when the server judged it long (`long`), then its measured height
 * decides, again when its width changes. A link under the fold, reached
 * by Tab, opens it.
 */
export function TextMore({
  id,
  long,
  more,
  less,
  center,
  children,
}: {
  id: string
  /** The server's guess from the text's length: folded from the first paint. */
  long: boolean
  more: string
  less: string
  /** The text is centred: so is its toggle. */
  center: boolean
  children: ReactNode
}) {
  const body = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(!long)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const text = body.current
    if (!text) {
      return
    }
    let width = 0
    const measure = () => {
      const now = text.getBoundingClientRect().width
      if (now === 0 || now === width) {
        return
      }
      width = now
      const style = getComputedStyle(text)
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.75
      // The whole text's height, folded or not
      setFits(text.scrollHeight <= line * LINES * SLACK)
    }
    measure()
    const resized = new ResizeObserver(measure)
    resized.observe(text)
    return () => {
      resized.disconnect()
    }
  }, [])

  return (
    <div className="gf-ltext flex flex-col gap-4" data-open={open || fits ? "true" : "false"}>
      <div
        ref={body}
        id={id}
        className="gf-ltext-body"
        onFocus={(event) => {
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
          type="button"
          className={cn(
            "gf-btn gf-btn--quiet gf-btn--small gf-ltext-toggle",
            center ? "self-center" : "self-start"
          )}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
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
