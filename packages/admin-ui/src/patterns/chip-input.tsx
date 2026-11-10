import { X } from "lucide-react"
import { useRef } from "react"
import type { KeyboardEvent } from "react"
import { cn } from "../lib/utils"

export interface Chip {
  key: string
  label: string
}

interface ChipInputProps {
  chips: readonly Chip[]
  /** What is being typed, not yet a chip. */
  text: string
  onTextChange: (text: string) => void
  /** Enter, a comma or leaving the field: the typed text is offered as chips. */
  onCommit: () => void
  onRemove: (index: number) => void
  /** The remove button's name for a screen reader: "Remove “red”". */
  removeLabel: (label: string) => string
  id?: string | undefined
  "aria-label"?: string | undefined
  /** The hint or error under the field. */
  "aria-describedby"?: string | undefined
  placeholder?: string | undefined
  invalid?: boolean
  className?: string | undefined
}

/**
 * Values typed as chips (docs/18 §7): Enter or a comma turns the text into
 * chips, Backspace in an empty field takes the last one back. The owner
 * decides what a chip is: the field only reports what was typed.
 */
export function ChipInput({
  chips,
  text,
  onTextChange,
  onCommit,
  onRemove,
  removeLabel,
  id,
  placeholder,
  invalid = false,
  className,
  ...aria
}: ChipInputProps) {
  const input = useRef<HTMLInputElement>(null)
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      onCommit()
    } else if (event.key === "Backspace" && text === "" && chips.length > 0) {
      onRemove(chips.length - 1)
    }
  }
  return (
    // A click on the frame types into the field, as a plain input would
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          input.current?.focus()
        }
      }}
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 dark:bg-input/30",
        invalid && "border-destructive",
        className
      )}
    >
      {chips.map((chip, index) => (
        <span
          key={chip.key}
          className="flex max-w-full min-w-0 items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[13px] text-accent-foreground"
        >
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            aria-label={removeLabel(chip.label)}
            onClick={() => {
              onRemove(index)
            }}
            className="shrink-0 rounded-sm opacity-70 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={input}
        id={id}
        value={text}
        aria-label={aria["aria-label"]}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={invalid || undefined}
        placeholder={chips.length ? "" : placeholder}
        autoComplete="off"
        onChange={(event) => {
          onTextChange(event.target.value)
        }}
        onKeyDown={onKeyDown}
        onBlur={onCommit}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}
