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
  /**
   * The first chip is the primary one (a page's main focus keyword): it
   * carries this short mark ("Ana"). Left out: every chip is alike.
   */
  primaryLabel?: string | undefined
  /** With `primaryLabel`: another chip's text is a button that makes it the primary. */
  onMakePrimary?: ((index: number) => void) | undefined
  /** That button's name for a screen reader: "Make “red” primary". */
  makePrimaryLabel?: ((label: string) => string) | undefined
}

/**
 * Values typed as chips (docs/18 §7): Enter or a comma turns the text into
 * chips, Backspace in an empty field takes the last one back. The owner
 * decides what a chip is: the field only reports what was typed. With
 * `primaryLabel` the first chip is marked as the primary, and another one
 * can be made the primary by its text (a button, reachable by keyboard).
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
  primaryLabel,
  onMakePrimary,
  makePrimaryLabel,
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
          className={cn(
            "flex max-w-full min-w-0 items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[13px] text-accent-foreground",
            primaryLabel && index === 0 && "font-medium ring-1 ring-border ring-inset"
          )}
        >
          {primaryLabel && index === 0 ? (
            <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
              {primaryLabel}
            </span>
          ) : null}
          {primaryLabel && index > 0 && onMakePrimary ? (
            <button
              type="button"
              title={makePrimaryLabel?.(chip.label)}
              aria-label={makePrimaryLabel?.(chip.label)}
              onClick={() => {
                onMakePrimary(index)
              }}
              className="min-w-0 truncate rounded-sm hover:underline"
            >
              {chip.label}
            </button>
          ) : (
            <span className="truncate">{chip.label}</span>
          )}
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
