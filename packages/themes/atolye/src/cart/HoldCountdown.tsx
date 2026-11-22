"use client"

import { CircleAlert, Timer } from "lucide-react"
import { useEffect, useState } from "react"
import type { BookingHoldView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** Seconds until the hold ends (0: gone), from the clock now. */
export function secondsLeft(expiresAt: string | null, now: number = Date.now()): number {
  if (expiresAt === null) {
    return 0
  }
  const end = Date.parse(expiresAt)
  return Number.isNaN(end) ? 0 : Math.max(0, Math.ceil((end - now) / 1000))
}

/** "07:05": minutes and seconds, minutes past an hour kept whole. */
export function clockOf(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
}

/** The hold's seconds left, ticking once a second until it ends; null without a hold. */
export function useHoldLeft(hold: BookingHoldView | null | undefined): number | null {
  const expiresAt = hold ? hold.expiresAt : undefined
  // The clock as last read: the seconds left follow from it, read again each second
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (expiresAt === undefined || secondsLeft(expiresAt) === 0) {
      return undefined
    }
    const timer = window.setInterval(() => {
      const at = Date.now()
      setNow(at)
      if (secondsLeft(expiresAt, at) === 0) {
        window.clearInterval(timer)
      }
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [expiresAt])
  return expiresAt === undefined ? null : secondsLeft(expiresAt, now)
}

export interface HoldWords {
  /** "Yerleriniz {time} daha tutuluyor". */
  held: string
  /** "Rezervasyon süreniz doldu; tarihleri yeniden seçin." */
  expired: string
}

/**
 * The dated lines' hold (adr/0076 §10): "Yerleriniz 07:05 daha
 * tutuluyor", ticking; once it ends, the expired line, said at once. The
 * clock itself is a timer (not read out each second).
 */
export function HoldCountdown({
  hold,
  words,
  className,
}: {
  hold: BookingHoldView
  words: HoldWords
  className?: string
}) {
  const left = useHoldLeft(hold) ?? 0
  if (left === 0) {
    return (
      <p
        role="alert"
        className={cn("flex items-start gap-2 text-sm font-semibold text-error", className)}
      >
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
        {words.expired}
      </p>
    )
  }
  const [before, after = ""] = words.held.split("{time}")
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-media bg-highlight-soft px-4 py-3 text-sm",
        className
      )}
    >
      <Timer className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
      <span>
        {before}
        <span role="timer" suppressHydrationWarning className="tabular font-extrabold">
          {clockOf(left)}
        </span>
        {after}
      </span>
    </p>
  )
}
