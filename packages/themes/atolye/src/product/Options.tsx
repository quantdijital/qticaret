import type { ProductOptionView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Swatch } from "../parts/Swatch"

const PILL =
  "inline-flex min-h-11 min-w-12 cursor-pointer items-center justify-center gf-pill rounded-pill px-5 text-sm font-semibold transition-colors duration-(--dur-micro) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"

const SWATCH =
  "inline-flex size-11 cursor-pointer items-center justify-center rounded-pill p-1 ring-2 ring-transparent transition-shadow duration-(--dur-micro) hover:ring-edge has-[:checked]:ring-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"

/** A value no variant can be had in (with the other choices kept): its words struck, quieter. */
const SOLD_OUT = "text-text-3 line-through decoration-1 has-[:checked]:text-paper"

/**
 * A product's options as real radio groups (`option_<id>`, docs/19 §6.6):
 * a value the shop named a colour for is a 44 px swatch, any other a
 * filled pill, the chosen one dark; the legend says what is chosen. An
 * option with one value offers no choice and is not drawn (its variant
 * still goes with the form). A value sold out with the other choices kept
 * says so before it is chosen: a pill's words struck, a swatch faded under
 * a slash, "Tükendi" read with its name; it stays choosable (its stock alert).
 */
export function Options({
  options,
  chosen,
  choose,
  soldOut,
  soldOutLabel,
}: {
  options: ProductOptionView[]
  chosen: Record<string, string>
  choose: (optionId: string, value: string) => void
  /** Whether no variant with this value (and the other choices) is in stock. */
  soldOut: (optionId: string, value: string) => boolean
  /** "Tükendi", read after a sold-out value's name. */
  soldOutLabel: string
}) {
  return options
    .filter((option) => option.values.length > 1)
    .map((option) => (
      <fieldset key={option.id} className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">
          {option.title}
          {chosen[option.id] && (
            <span className="font-normal text-text-2">: {chosen[option.id]}</span>
          )}
        </legend>
        <div className="flex flex-wrap gap-2">
          {option.values.map((value) => {
            const id = `secenek-${option.id}-${value}`
            const swatch = option.swatches?.[value]
            const out = soldOut(option.id, value)
            const name = out ? `${value}, ${soldOutLabel}` : value
            return (
              <label
                key={value}
                htmlFor={id}
                title={swatch ? name : undefined}
                className={cn(
                  swatch ? SWATCH : PILL,
                  out && !swatch && SOLD_OUT,
                  out && swatch && "relative"
                )}
              >
                <input
                  id={id}
                  type="radio"
                  name={`option_${option.id}`}
                  value={value}
                  checked={chosen[option.id] === value}
                  onChange={() => {
                    choose(option.id, value)
                  }}
                  className="sr-only"
                />
                {swatch ? (
                  <>
                    <Swatch hex={swatch} className={cn("size-full", out && "opacity-45")} />
                    {out && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-1.5 top-1/2 h-0.5 -translate-y-1/2 -rotate-45 rounded-pill bg-text-2"
                      />
                    )}
                    <span className="sr-only">{name}</span>
                  </>
                ) : (
                  <>
                    {value}
                    {out && <span className="sr-only">, {soldOutLabel}</span>}
                  </>
                )}
              </label>
            )
          })}
        </div>
      </fieldset>
    ))
}
