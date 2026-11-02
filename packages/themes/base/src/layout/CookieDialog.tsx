"use client"

import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { COOKIE_PREFERENCES_EVENT } from "./cookie-events"

/**
 * The banner's frame (D9): open while the server says an answer is due,
 * and again when the footer's link asks; closed as soon as an answer is
 * sent. Opened again, it takes the focus, closes with Escape or its own
 * button and gives the focus back to the link.
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
      onSubmit={() => {
        setOpen(false)
        setReopened(false)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && reopened) {
          close()
        }
      }}
      className={`fixed inset-x-3 bottom-3 z-50 mx-auto max-h-[calc(100dvh-1.5rem)] max-w-3xl overflow-y-auto rounded-3xl border bg-card p-5 shadow-2xl shadow-foreground/10 outline-none sm:inset-x-6 sm:bottom-6 sm:p-6 ${reopened ? "pr-14 sm:pr-14" : ""}`}
    >
      {reopened && (
        <button
          type="button"
          onClick={close}
          aria-label={closeLabel}
          className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full hover:bg-muted"
        >
          <X className="size-4.5" aria-hidden="true" />
        </button>
      )}
      {children}
    </section>
  )
}
