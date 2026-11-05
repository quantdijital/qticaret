import type { ProductOptionView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Swatch } from "../parts/Swatch"

const PILL =
  "inline-flex min-h-11 min-w-12 cursor-pointer items-center justify-center rounded-pill bg-paper-2 px-5 text-sm font-semibold transition-colors duration-(--dur-micro) hover:bg-paper-3 has-[:checked]:bg-text has-[:checked]:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"

const SWATCH =
  "inline-flex size-11 cursor-pointer items-center justify-center rounded-pill p-1 ring-2 ring-transparent transition-shadow duration-(--dur-micro) hover:ring-edge has-[:checked]:ring-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"

/**
 * A product's options as real radio groups (`option_<id>`, docs/19 §6.6):
 * a value the shop named a colour for is a 44 px swatch, any other a
 * filled pill, the chosen one dark; the legend says what is chosen. An
 * option with one value offers no choice and is not drawn (its variant
 * still goes with the form).
 */
export function Options({
  options,
  chosen,
  choose,
}: {
  options: ProductOptionView[]
  chosen: Record<string, string>
  choose: (optionId: string, value: string) => void
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
            return (
              <label
                key={value}
                htmlFor={id}
                title={swatch ? value : undefined}
                className={cn(swatch ? SWATCH : PILL)}
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
                    <Swatch hex={swatch} className="size-full" />
                    <span className="sr-only">{value}</span>
                  </>
                ) : (
                  value
                )}
              </label>
            )
          })}
        </div>
      </fieldset>
    ))
}
