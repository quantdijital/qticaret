import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Stepper } from "./stepper"

export interface WizardStep {
  key: string
  title: string
  description: string
}

interface WizardProps {
  steps: WizardStep[]
  /** Zero-based. */
  current: number
  /** Steps already passed; going back to one is allowed. */
  reached: number
  onStepSelect: (index: number) => void
  children: ReactNode
  /** Back, next, save: pinned to the bottom of the screen. */
  footer: ReactNode
}

/**
 * Making something in stages (docs/18 §7 Wizard): the stages across the
 * top, one question group at a time, the step's title in words, and the
 * actions always in reach at the bottom.
 */
export function Wizard({ steps, current, reached, onStepSelect, children, footer }: WizardProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const step = steps[current]
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border bg-card px-5 py-5 shadow-card">
        <Stepper
          steps={steps.map((item, index) => ({
            key: item.key,
            title: item.title,
            done: index < current,
          }))}
          currentKey={step?.key ?? null}
          onSelect={(key) => {
            const index = steps.findIndex((item) => item.key === key)
            if (index <= reached) {
              onStepSelect(index)
            }
          }}
        />
      </div>
      {step ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            {t("wizard.stepOf", { step: current + 1, total: steps.length })}
          </span>
          <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">{step.title}</h2>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-6">{children}</div>
      {/* Sticks to the bottom of the screen while the step is longer than it */}
      <div className="sticky bottom-0 z-20 -mx-[var(--page-padding)] -mb-6 border-t bg-card/95 backdrop-blur-sm lg:-mx-[var(--page-padding-wide)] lg:-mb-8">
        <div className="flex items-center justify-between gap-3 px-[var(--page-padding)] py-3 lg:px-[var(--page-padding-wide)]">
          {footer}
        </div>
      </div>
    </div>
  )
}
