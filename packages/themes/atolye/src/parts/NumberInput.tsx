"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useRef, useState } from "react"
import type { ComponentProps } from "react"
import { useHydrated } from "@qticaret/ui/hooks/use-hydrated"
import { cn } from "@qticaret/ui/lib/utils"
import { nextValue } from "./number-step"
import type { NumberStep } from "./number-step"

export interface NumberInputWords {
  increase: string
  decrease: string
}

type InputProps = Omit<
  ComponentProps<"input">,
  "type" | "min" | "max" | "step" | "value" | "onChange" | "inputMode"
>

const ARROW =
  "flex min-h-0 flex-1 items-center justify-center rounded-pill text-text-3 transition-colors duration-(--dur-micro) hover:bg-paper-3 hover:text-text disabled:pointer-events-none disabled:opacity-35"

/**
 * A number field in the Grafit pill (`gf-field`) with its own up / down
 * chevrons stacked inside the right end: shown while the pointer is over
 * it or it has the focus, icon only, muted until pointed at, never the
 * browser's spinner (base.css hides that everywhere). The value is left
 * aligned, so the room they take while shown moves nothing; on a touch
 * screen they are left out (they could not be 44 px) and the number pad
 * does the work. The
 * arrow keys move by the same step. A real `type="number"` that posts
 * with its GET form, so it works before the script; the chevrons are
 * drawn once the script runs.
 */
export function NumberInput({
  rule,
  words,
  className,
  defaultValue,
  onKeyDown,
  ...props
}: InputProps & { rule: NumberStep; words: NumberInputWords }) {
  const hydrated = useHydrated()
  const field = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(defaultValue === undefined ? "" : String(defaultValue))
  const typed = text.trim() === "" ? null : Number(text)
  const move = (direction: 1 | -1) => {
    const input = field.current
    if (input) {
      const next = String(nextValue(input.value, direction, rule))
      input.value = next
      setText(next)
    }
  }
  return (
    <div className="group/number relative">
      <input
        {...props}
        ref={field}
        type="number"
        inputMode="numeric"
        // The chevrons stop at `max`; typing past it is the shopper's call
        min={rule.min}
        defaultValue={defaultValue}
        onChange={(event) => {
          setText(event.target.value)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (!event.defaultPrevented && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
            event.preventDefault()
            move(event.key === "ArrowUp" ? 1 : -1)
          }
        }}
        // Left aligned, so making room for the chevrons only while they show
        // moves nothing: a long example just ends sooner
        className={cn(
          "gf-field tabular text-ellipsis",
          "pointer-fine:group-hover/number:pr-10 pointer-fine:focus:pr-10",
          className
        )}
      />
      {hydrated && (
        <div
          data-number-steps=""
          className="absolute inset-y-1.5 right-3 hidden w-6 flex-col opacity-0 transition-opacity duration-(--dur-micro) group-focus-within/number:opacity-100 group-hover/number:opacity-100 pointer-fine:flex"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={words.increase}
            disabled={typed !== null && rule.max !== undefined && typed >= rule.max}
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              move(1)
            }}
            className={ARROW}
          >
            <ChevronUp className="size-4" aria-hidden="true" strokeWidth={2} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label={words.decrease}
            disabled={typed !== null && typed <= rule.min}
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              move(-1)
            }}
            className={ARROW}
          >
            <ChevronDown className="size-4" aria-hidden="true" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}
