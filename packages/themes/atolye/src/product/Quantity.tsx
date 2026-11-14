"use client"

import { Minus, Plus } from "lucide-react"
import { useState } from "react"

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const STEP =
  "flex size-11 shrink-0 items-center justify-center rounded-button bg-paper-2 text-text transition-colors duration-(--dur-micro) hover:bg-paper-3 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"

/**
 * How many: a round minus and plus (44 px) either side of a real number
 * field, 48 px tall like the button beside it, its edge drawn at 3:1. The field posts with its
 * form (`form`), so it works before the script; a lower `max` (an
 * add-on's limit) takes the shown value down with it.
 */
export function Quantity({
  form,
  name,
  max,
  words,
  onValueChange,
}: {
  /** The form the field belongs to, when it stands outside it. */
  form: string
  name: string
  max: number
  words: { quantity: string; decrease: string; increase: string }
  onValueChange: (value: number) => void
}) {
  const [typed, setTyped] = useState(1)
  const value = clamp(typed, 1, max)
  const set = (next: number) => {
    const kept = clamp(next, 1, max)
    setTyped(kept)
    onValueChange(kept)
  }
  return (
    <div role="group" aria-label={words.quantity} className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label={words.decrease}
        disabled={value <= 1}
        onClick={() => {
          set(value - 1)
        }}
        className={STEP}
      >
        <Minus className="size-4" aria-hidden="true" strokeWidth={2.25} />
      </button>
      <input
        form={form}
        type="number"
        name={name}
        aria-label={words.quantity}
        min={1}
        max={max}
        value={value}
        inputMode="numeric"
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10)
          set(Number.isNaN(next) ? 1 : next)
        }}
        className="tabular h-12 w-12 appearance-none rounded-inner border border-edge bg-field text-center text-md font-semibold focus-visible:outline-offset-[-2px] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label={words.increase}
        disabled={value >= max}
        onClick={() => {
          set(value + 1)
        }}
        className={STEP}
      >
        <Plus className="size-4" aria-hidden="true" strokeWidth={2.25} />
      </button>
    </div>
  )
}
