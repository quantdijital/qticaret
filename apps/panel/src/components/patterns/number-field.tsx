import { ChevronDown, ChevronUp } from "lucide-react"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { readNumber, stepText } from "./number-step"
import { useHoldStep } from "./use-hold-step"

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
 * The panel's number field (docs/18 §2): the value, an optional unit and,
 * inside the right edge, a pair of small up / down chevrons stacked in
 * the box's height; no browser spinner. The chevrons show while the
 * pointer is over the field or it has the focus (their room is kept, so
 * nothing moves), icon only, muted until pointed at; held down they
 * repeat. On a touch screen they are left out and the phone's number pad
 * does the work. The arrow keys step as before; both keep to min and
 * max. Turkish text ("1.250,50") unless `plain`. The chevrons stay out of
 * the tab order (the arrow keys do the same) and never steal the caret.
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
  /** One step; false when there was no room for it (or the field is locked). */
  const move = (direction: 1 | -1): boolean => {
    const input = own.current
    if (!input || locked) {
      return false
    }
    const next = stepText(input.value, direction, rule)
    if (next === input.value) {
      return false
    }
    write(input, next)
    return true
  }
  const compact = size === "compact"
  return (
    <div
      data-slot="number-field"
      data-size={size}
      className={cn(
        "group/number flex w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs dark:bg-input/30",
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
          // No browser spinner (globals.css hides it everywhere too)
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          compact ? "pl-2 text-right" : "pl-3",
          // The chevrons' column follows; on a touch screen it is not there
          suffix ? "pr-1.5" : "pr-1 pointer-coarse:pr-3",
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
          className="flex shrink-0 items-center pr-0.5 text-sm text-muted-foreground pointer-coarse:pr-3"
        >
          {suffix}
        </span>
      ) : null}
      <Steps
        locked={locked}
        compact={compact}
        up={{
          label: t("common.increase"),
          stop: rule.max !== undefined && current !== null && current >= rule.max,
          move: () => move(1),
        }}
        down={{
          label: t("common.decrease"),
          stop: rule.min !== undefined && current !== null && current <= rule.min,
          move: () => move(-1),
        }}
      />
    </div>
  )
}

interface Arrow {
  label: string
  /** At its limit: the arrow is off */
  stop: boolean
  move: () => boolean
}

/**
 * The up / down pair, each half the field's height, in a column whose
 * room is always kept: hidden until the pointer is over the field or it
 * has the focus, never shown on a locked field, left out on a touch screen.
 */
function Steps({
  locked,
  compact,
  up,
  down,
}: {
  locked: boolean
  compact: boolean
  up: Arrow
  down: Arrow
}) {
  const hold = useHoldStep()
  return (
    <div
      data-slot="number-field-steps"
      className={cn(
        "flex shrink-0 flex-col justify-center py-0.5 pr-0.5 opacity-0 transition-opacity duration-100 pointer-coarse:hidden",
        compact ? "w-5" : "w-6",
        locked
          ? "invisible"
          : "group-focus-within/number:opacity-100 group-hover/number:opacity-100"
      )}
    >
      {[
        { arrow: up, Icon: ChevronUp, slot: "number-field-up" },
        { arrow: down, Icon: ChevronDown, slot: "number-field-down" },
      ].map(({ arrow, Icon, slot }) => (
        <StepButton
          key={slot}
          slot={slot}
          arrow={arrow}
          disabled={locked || arrow.stop}
          hold={hold}
        >
          <Icon />
        </StepButton>
      ))}
    </div>
  )
}

function StepButton({
  slot,
  arrow,
  disabled,
  hold,
  children,
}: {
  slot: string
  arrow: Arrow
  disabled: boolean
  hold: ReturnType<typeof useHoldStep>
  children: React.ReactNode
}) {
  // A press already stepped; the click that follows it does not again
  const pressed = React.useRef(false)
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={arrow.label}
      disabled={disabled}
      data-slot={slot}
      className="flex min-h-0 flex-1 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:stroke-[2.25]"
      // The caret stays in the field; a row's own click is not set off
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return
        }
        pressed.current = true
        hold.start(arrow.move)
      }}
      onPointerLeave={hold.stop}
      onClick={(event) => {
        event.stopPropagation()
        // A click without a press (a screen reader's) steps once
        if (!pressed.current) {
          arrow.move()
        }
        pressed.current = false
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
