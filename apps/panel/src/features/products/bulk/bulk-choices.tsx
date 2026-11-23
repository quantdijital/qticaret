import { cn } from "@qticaret/admin-ui/lib/utils"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"

/** A bulk change's options as boxes in a row, one picked. */
export function Choices<V extends string>({
  label,
  value,
  options,
  onChange,
  className = "sm:grid-cols-3",
}: {
  label: string
  value: V
  options: readonly { value: V; label: string; disabled?: boolean }[]
  onChange: (value: V) => void
  /** The columns from `sm` up; three by default. */
  className?: string
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        onChange(next as V)
      }}
      className={cn("grid gap-2", className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 items-center gap-2.5 rounded-md border px-3 py-2.5 text-[13px] has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
        >
          <RadioGroupItem value={option.value} disabled={option.disabled === true} />
          {option.label}
        </label>
      ))}
    </RadioGroup>
  )
}
