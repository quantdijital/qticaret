"use client"

import { X } from "lucide-react"
import { useEffect, useRef } from "react"

/**
 * The scrolling strip's close button (adr/0049 Ek 2026-11-15), when the
 * shop offers one: closing marks the strip's shell `data-closed` (the
 * stylesheet takes it and its look's box off the page) and remembers it in
 * this browser under `key`, the strip's id with its words' digest, so a
 * strip the shop rewrites shows again. Only that flag is stored, nothing
 * about the shopper. A browser without storage (private mode, blocked)
 * closes it for this page only. A strip closed before is taken off as soon
 * as the script runs; the page may move once then (no inline script under
 * the CSP to hide it before the first paint).
 */
export function MarqueeClose({ label, storageKey }: { label: string; storageKey: string }) {
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (read(storageKey)) {
      close(button.current)
    }
  }, [storageKey])
  return (
    <button
      ref={button}
      type="button"
      data-part="close"
      className="gf-marquee-toggle gf-marquee-close"
      aria-label={label}
      onClick={() => {
        write(storageKey)
        close(button.current)
      }}
    >
      <X aria-hidden="true" strokeWidth={2.25} />
    </button>
  )
}

function close(button: HTMLButtonElement | null) {
  button?.closest("[data-mq-shell]")?.setAttribute("data-closed", "")
}

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function write(key: string) {
  try {
    window.localStorage.setItem(key, "1")
  } catch {
    // No storage: closed for this page only
  }
}
