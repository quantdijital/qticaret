import { Minus, Plus } from "lucide-react"
import { cn } from "@qticaret/ui/lib/utils"

/** The most units a cart line holds (the storefront's action takes 1–99). */
export const MAX_QUANTITY = 99

export interface StepperWords {
  /** "Çakı adedi": the group's name. */
  group: string
  decrease: string
  increase: string
}

const STEP =
  "gf-icon-btn size-11 text-text disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-offset-[-2px]"

/**
 * A cart line's quantity in a 44 px pill: minus and plus are the line
 * form's own submit buttons, each sending the quantity it makes (minus at
 * one sends nothing left, which takes the line out), so it works before
 * the script loads. The number is said when it changes.
 */
export function Stepper({
  quantity,
  most,
  busy = false,
  words,
  className,
}: {
  quantity: number
  /** The line's own limit (its add-on picks may set one), never past 99. */
  most: number
  busy?: boolean
  words: StepperWords
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={words.group}
      className={cn("flex h-11 shrink-0 items-center rounded-pill bg-field", className)}
    >
      <button
        type="submit"
        name="quantity"
        value={quantity - 1}
        disabled={busy}
        aria-label={words.decrease}
        className={STEP}
      >
        <Minus className="size-4" aria-hidden="true" strokeWidth={2.25} />
      </button>
      <span aria-live="polite" className="tabular w-7 text-center text-md font-extrabold">
        {quantity}
      </span>
      <button
        type="submit"
        name="quantity"
        value={quantity + 1}
        disabled={busy || quantity >= Math.min(most, MAX_QUANTITY)}
        aria-label={words.increase}
        className={STEP}
      >
        <Plus className="size-4" aria-hidden="true" strokeWidth={2.25} />
      </button>
    </div>
  )
}
