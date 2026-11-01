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
}: {
  name: string
  label: string
  decrease: string
  increase: string
  min?: number
  max?: number
  defaultValue?: number
  className?: string
}) {
  const [value, setValue] = useState(defaultValue)
  const step = (by: number) => {
    setValue((current) => clamp(current + by, min, max))
  }
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex h-11 items-center rounded-full border bg-background", className)}
    >
      <button
        type="button"
        aria-label={decrease}
        disabled={value <= min}
        onClick={() => {
          step(-1)
        }}
        className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
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
          setValue(Number.isNaN(next) ? min : clamp(next, min, max))
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
        className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
