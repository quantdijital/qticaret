"use client"

import { Minus, Plus } from "lucide-react"
import { useState } from "react"
import { cn } from "@qticaret/ui/lib/utils"

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * A quantity with a minus and a plus beside a real number field: the
 * form posts the field, so it works before the script loads too.
 */
export function QuantityField({
  name,
  label,
  decrease,
  increase,
  min = 1,
  max = 99,
  defaultValue = 1,
  className,
  onValueChange,
}: {
  name: string
  label: string
  decrease: string
  increase: string
  min?: number
  max?: number
  defaultValue?: number
  className?: string
  /** Hears each new value (a running total beside the field). */
  onValueChange?: (value: number) => void
}) {
  const [typed, setTyped] = useState(defaultValue)
  // A lower `max` (an add-on's limit, adr/0052) takes the shown value down with it
  const value = clamp(typed, min, max)
  const set = (next: number) => {
    const kept = clamp(next, min, max)
    setTyped(kept)
    onValueChange?.(kept)
  }
  const step = (by: number) => {
    set(value + by)
  }
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex h-12 items-center rounded-button border bg-card", className)}
    >
      <button
        type="button"
        aria-label={decrease}
        disabled={value <= min}
        onClick={() => {
          step(-1)
        }}
        className="flex size-12 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input
        type="number"
        name={name}
        aria-label={label}
        min={min}
        max={max}
        value={value}
        inputMode="numeric"
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10)
          set(Number.isNaN(next) ? min : next)
        }}
        className="tabular w-10 appearance-none bg-transparent text-center text-sm font-medium outline-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label={increase}
        disabled={value >= max}
        onClick={() => {
          step(1)
        }}
        className="flex size-12 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
