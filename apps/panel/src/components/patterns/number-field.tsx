import { Minus, Plus } from "lucide-react"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { readNumber, stepText } from "./number-step"

type InputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "size" | "inputMode" | "min" | "max" | "step"
>

export interface NumberFieldProps extends InputProps {
  /** Also a string, as a form library's register hands it over */
  min?: number | string | undefined
  max?: number | string | undefined
  /** What − / + and the arrow keys move by; 1 unless set */
  step?: number
  /** Decimals the field takes, typed the Turkish way ("12,50"); 0, the default, for whole numbers */
  decimals?: number
  /** The browser's number input, its value a plain number ("12.5"), for code that reads it with Number() */
  plain?: boolean
  /** A unit after the value: ₺, %, adet, cm, g */
  suffix?: string
  /** 32 px, for a list's or a table's row */
  size?: "default" | "compact"
  /** The value's own classes; `className` is the box's (its width) */
  inputClassName?: string
}

/**
 * The panel's number field (docs/18 §2): the value, an optional unit and a
 * − / + pair in one 36 px box, no browser spinner. Typing and the arrow keys
 * work as before; the pair and the keys keep to min and max. Turkish text
 * ("1.250,50") unless `plain`. The buttons stay out of the tab order (the
 * arrow keys do the same) and never steal the caret.
 */
export function NumberField({
  min,
  max,
  step = 1,
  decimals = 0,
  plain = false,
  suffix,
  size = "default",
  className,
  inputClassName,
  ref,
  value,
  defaultValue,
  disabled,
  readOnly,
  onChange,
  onKeyDown,
  ...props
}: NumberFieldProps) {
  const { t } = useTranslation()
  const own = React.useRef<HTMLInputElement | null>(null)
  // The caller's ref too (a form library's register)
  const attach = React.useCallback(
    (node: HTMLInputElement | null) => {
      own.current = node
      if (typeof ref === "function") {
        return ref(node)
      }
      if (ref) {
        ref.current = node
      }
      return undefined
    },
    [ref]
  )
  const controlled = value !== undefined
  const [typed, setTyped] = React.useState(() => String(defaultValue ?? ""))
  const text = controlled ? String(value) : typed
  // A form's reset writes the input without an event; the form renders the
  // field again with a fresh register ref, and what the input holds is read back
  React.useLayoutEffect(() => {
    const held = own.current?.value
    if (!controlled && held !== undefined && held !== typed) {
      setTyped(held)
    }
  }, [controlled, typed, attach])
  const rule = { plain, decimals, min: bound(min), max: bound(max), step }
  const current = readNumber(text, rule)
  const locked = disabled === true || readOnly === true
  const move = (direction: 1 | -1) => {
    const input = own.current
    if (input && !locked) {
      write(input, stepText(input.value, direction, rule))
    }
  }
  const compact = size === "compact"
  return (
    <div
      data-slot="number-field"
      data-size={size}
      className={cn(
        "flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs dark:bg-input/30",
        compact ? "h-8" : "h-9",
        "has-[input[aria-invalid=true]]:border-destructive has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-50",
        className
      )}
    >
      <input
        autoComplete="off"
        {...props}
        ref={attach}
        type={plain ? "number" : "text"}
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        {...(plain
          ? { min: rule.min, max: rule.max, step: "any" }
          : {
              role: "spinbutton",
              "aria-valuemin": rule.min,
              "aria-valuemax": rule.max,
              "aria-valuenow": current ?? undefined,
            })}
        {...(suffix && text ? { "aria-valuetext": `${text} ${suffix}` } : {})}
        {...(controlled ? { value } : defaultValue !== undefined ? { defaultValue } : {})}
        disabled={disabled}
        readOnly={readOnly}
        data-slot="number-field-input"
        className={cn(
          "w-full min-w-0 flex-1 bg-transparent text-base tabular-nums outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none md:text-sm",
          // No browser spinner: the pair below is the field's own
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          compact ? "px-2 text-right" : "px-3",
          inputClassName
        )}
        onChange={(event) => {
          if (!controlled) {
            setTyped(event.target.value)
          }
          onChange?.(event)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (!event.defaultPrevented && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
            event.preventDefault()
            move(event.key === "ArrowUp" ? 1 : -1)
          }
        }}
      />
      {suffix ? (
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center text-sm text-muted-foreground",
            compact ? "pr-2" : "pr-3"
          )}
        >
          {suffix}
        </span>
      ) : null}
      <StepButton
        label={t("common.decrease")}
        compact={compact}
        disabled={locked || (rule.min !== undefined && current !== null && current <= rule.min)}
        onStep={() => {
          move(-1)
        }}
      >
        <Minus />
      </StepButton>
      <StepButton
        label={t("common.increase")}
        compact={compact}
        disabled={locked || (rule.max !== undefined && current !== null && current >= rule.max)}
        onStep={() => {
          move(1)
        }}
      >
        <Plus />
      </StepButton>
    </div>
  )
}

function StepButton({
  label,
  compact,
  disabled,
  onStep,
  children,
}: {
  label: string
  compact: boolean
  disabled: boolean
  onStep: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      data-slot="number-field-step"
      className={cn(
        "flex shrink-0 items-center justify-center border-l border-input text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-3.5",
        compact ? "w-7" : "w-8"
      )}
      // The caret stays in the field; a row's own click is not set off
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onClick={(event) => {
        event.stopPropagation()
        onStep()
      }}
    >
      {children}
    </button>
  )
}

const bound = (value: number | string | undefined): number | undefined =>
  value === undefined || value === "" || !Number.isFinite(Number(value)) ? undefined : Number(value)

/** A value set as typing would: React and form libraries see the change. */
function write(input: HTMLInputElement, text: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}
