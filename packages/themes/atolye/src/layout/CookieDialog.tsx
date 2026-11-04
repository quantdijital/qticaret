"use client"

import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { COOKIE_PREFERENCES_EVENT } from "./events"

/**
 * The cookie banner's frame (D9): drawn on the server and open while an
 * answer is due, and again when the footer's link asks; closed as soon as
 * an answer is sent. A band across the foot of the page under an ink rule,
 * a third of a phone's height at most (design.md § Cookie banner). Opened
 * again, it takes the focus, closes with Escape or its 44 px button and
 * gives the focus back to the link.
 */
export function CookieDialog({
  open: due,
  labelledBy,
  closeLabel,
  children,
}: {
  open: boolean
  labelledBy: string
  closeLabel: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(due)
  const [reopened, setReopened] = useState(false)
  const [answered, setAnswered] = useState(due)
  const frame = useRef<HTMLElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  // The server's word changed (answered, or a new policy asks again)
  if (answered !== due) {
    setAnswered(due)
    setOpen(due)
  }

  useEffect(() => {
    const show = (event: Event) => {
      event.preventDefault()
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setReopened(true)
      setOpen(true)
    }
    window.addEventListener(COOKIE_PREFERENCES_EVENT, show)
    return () => {
      window.removeEventListener(COOKIE_PREFERENCES_EVENT, show)
    }
  }, [])

  useEffect(() => {
    if (open && reopened) {
      frame.current?.focus()
    }
  }, [open, reopened])

  const close = () => {
    setOpen(false)
    setReopened(false)
    opener.current?.focus()
  }

  return (
    <section
      ref={frame}
      tabIndex={-1}
      hidden={!open}
      aria-labelledby={labelledBy}
      data-cookie-banner=""
      onSubmit={() => {
        setOpen(false)
        setReopened(false)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && reopened) {
          close()
        }
      }}
      className="fixed inset-x-0 bottom-0 z-(--z-modal) max-h-[35dvh] overflow-y-auto border-t-2 border-rule-ink bg-paper pb-[env(safe-area-inset-bottom)] text-text shadow-overlay outline-none sm:max-h-[60dvh]"
    >
      <div className="relative mx-auto w-full max-w-(--container) px-(--gutter) py-4 lg:py-6">
        {reopened && (
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="at-icon-btn absolute top-2 right-2"
          >
            <X className="size-5" aria-hidden="true" strokeWidth={1.75} />
          </button>
        )}
        {children}
      </div>
    </section>
  )
}
