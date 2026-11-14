"use client"

import { useEffect, useId, useRef, useState } from "react"

/** A quote longer than this is closed at five lines from the first paint (the server's guess). */
const LONG = 220

/**
 * A review quoted on a card (`.gf-quote` in `pages.css`): five lines, so
 * the cards in a row stay even, with "Devamını oku" / "Daha az göster"
 * under it only when the text runs past them, measured once laid out and
 * again when the card's width changes. Without the script the whole
 * quote shows and no toggle.
 */
export function ReviewQuote({ text, more, less }: { text: string; more: string; less: string }) {
  const id = useId()
  const body = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [runsOver, setRunsOver] = useState(text.length > LONG)

  useEffect(() => {
    const quote = body.current
    if (!quote) {
      return
    }
    const measure = () => {
      // An open quote shows everything: nothing to measure until it closes again
      if (quote.dataset["open"] === "true") {
        return
      }
      quote.dataset["open"] = "false"
      setRunsOver(quote.scrollHeight > quote.clientHeight + 1)
    }
    measure()
    const resized = new ResizeObserver(measure)
    resized.observe(quote)
    return () => {
      resized.disconnect()
    }
  }, [])

  return (
    <>
      <p ref={body} id={id} className="gf-quote" data-open={open ? "true" : "false"}>
        “{text}”
      </p>
      {runsOver && (
        <button
          type="button"
          className="gf-link gf-quote-toggle self-start text-sm"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            setOpen(!open)
          }}
        >
          {open ? less : more}
        </button>
      )}
    </>
  )
}
