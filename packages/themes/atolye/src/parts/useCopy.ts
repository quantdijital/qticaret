"use client"

import { useEffect, useState } from "react"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"

/**
 * A value to the clipboard in one press (the IBAN of a transfer, the
 * shop's MERSİS number): whether there is a clipboard to write to (only
 * with the script), whether the value was just copied (for 2.5 s), and
 * the press itself. Spaces never go to the clipboard.
 */
export function useCopy(value: string): { available: boolean; copied: boolean; copy: () => void } {
  const hydrated = useHydrated()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = window.setTimeout(() => {
      setCopied(false)
    }, 2500)
    return () => {
      window.clearTimeout(timer)
    }
  }, [copied])
  const available = hydrated && typeof navigator !== "undefined" && "clipboard" in navigator
  const copy = () => {
    void navigator.clipboard.writeText(value.replace(/\s+/g, "")).then(
      () => {
        setCopied(true)
      },
      () => {
        setCopied(false)
      }
    )
  }
  return { available, copied, copy }
}
