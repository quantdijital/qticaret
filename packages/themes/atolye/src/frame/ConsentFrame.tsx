"use client"

import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { COOKIE_PREFERENCES_EVENT } from "./events"

/**
 * The cookie notice's frame (D9): drawn on the server and open while an
 * answer is due, and again when the footer's link asks; closed as soon as
 * an answer is sent. A floating card at the foot of the screen, a third of
 * a phone's height at most. Opened again, it takes the focus, closes with
 * Escape or its 44 px button and gives the focus back to the link.
 */
export function ConsentFrame({
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
      className="fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-(--z-modal) mx-auto max-h-[33dvh] max-w-3xl overflow-y-auto rounded-tile bg-field text-text shadow-float outline-none sm:inset-x-4 sm:max-h-[60dvh] lg:bottom-6"
    >
      <div className="relative p-4 sm:p-6">
        {reopened && (
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="gf-icon-btn absolute top-2 right-2"
          >
            <X className="size-5" aria-hidden="true" strokeWidth={2} />
          </button>
        )}
        {children}
      </div>
    </section>
  )
}
