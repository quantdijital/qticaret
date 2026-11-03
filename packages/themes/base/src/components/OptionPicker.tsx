import type { ProductOptionView } from "@qticaret/ui"
import { Swatch } from "./Swatch"

const SWATCH =
  "inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-transparent p-0.5 transition-colors hover:border-foreground/40 has-[:checked]:border-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"

const PILL =
  "inline-flex h-11 min-w-12 cursor-pointer items-center justify-center rounded-button border bg-card px-5 text-sm font-medium transition-colors hover:border-foreground has-[:checked]:border-foreground has-[:checked]:bg-foreground has-[:checked]:text-background has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"

/**
 * A product's options as radio groups (`option_<id>`): a value the shop
 * named a colour for is a swatch, any other a pill. Real radios, so the
 * choice reads for agents and keyboards alike (docs/19 §6.6).
 */
export function OptionPicker({
  options,
  chosen,
  choose,
}: {
  options: ProductOptionView[]
  chosen: Record<string, string>
  choose: (optionId: string, value: string) => void
}) {
  return options.map((option) => (
    <fieldset key={option.id} className="flex flex-col gap-2.5">
      <legend className="mb-1 text-sm font-medium">
        {option.title}
        {chosen[option.id] && (
          <span className="font-normal text-muted-foreground">: {chosen[option.id]}</span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {option.values.map((value) => {
          const id = `option-${option.id}-${value}`
          const swatch = option.swatches?.[value]
          return (
            <label
              key={value}
              htmlFor={id}
              title={swatch ? value : undefined}
              className={swatch ? SWATCH : PILL}
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
