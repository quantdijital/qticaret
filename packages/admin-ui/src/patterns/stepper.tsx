import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { cn } from "../lib/utils"

export interface Step {
  key: string
  title: string
  done: boolean
}

interface StepperProps {
  steps: Step[]
  /** The step to do now; marked and named for screen readers. */
  currentKey: string | null
  onSelect?: (key: string) => void
  className?: string
}

/**
 * Progress through ordered steps (setup, wizards): numbered nodes joined by
 * a line that fills as steps are done; the current one is ringed in the
 * brand colour. Horizontal from tablet width, a list on phones.
 */
export function Stepper({ steps, currentKey, onSelect, className }: StepperProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
  return (
    <ol className={cn("flex flex-col gap-3 md:flex-row md:gap-0", className)}>
      {steps.map((step, index) => {
        const current = step.key === currentKey
        const last = index === steps.length - 1
        return (
          <li
            key={step.key}
            className="relative flex flex-1 items-start gap-3 md:flex-col md:gap-2"
          >
            {!last ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute hidden h-0.5 md:top-4 md:left-9 md:block md:w-[calc(100%-2.75rem)]",
                  step.done ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
            <button
              type="button"
              disabled={!onSelect}
              aria-current={current ? "step" : undefined}
              // A done step shows a tick, not its number: its name says both
              aria-label={step.done ? `${step.title} (${t("common.done")})` : step.title}
              onClick={() => onSelect?.(step.key)}
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                step.done && "border-primary bg-primary text-primary-foreground",
                current && "border-primary bg-card text-primary-text ring-4 ring-primary/15",
                !step.done && !current && "border-border bg-card text-muted-foreground",
                onSelect && "cursor-pointer hover:border-primary"
              )}
            >
              {step.done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
            </button>
            <span
              className={cn(
                "pt-1.5 text-[13px] leading-5 md:pt-0 md:pr-4",
                current
                  ? "font-semibold text-foreground"
                  : step.done
                    ? "text-muted-foreground"
                    : "text-foreground"
              )}
            >
              {step.title}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
