import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"

/** A bulk change's options as boxes in a row, one picked. */
export function Choices<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: V
  options: readonly { value: V; label: string }[]
  onChange: (value: V) => void
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        onChange(next as V)
      }}
      className="grid gap-2 sm:grid-cols-3"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-[13px] has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
        >
          <RadioGroupItem value={option.value} />
          {option.label}
        </label>
      ))}
    </RadioGroup>
  )
}
