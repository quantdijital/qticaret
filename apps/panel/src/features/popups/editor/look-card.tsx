import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { Controller, useFormContext, useFormState } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { POPUP_LAYOUTS, POPUP_LIMITS } from "@/features/popups/api/types"
import type { PopupLayout } from "@/features/popups/api/types"
import type { PopupValues } from "@/features/popups/form"
import { DesignPicker } from "./design-picker"
import { NumberInput } from "./number-input"

const F = "popups.form"

/** The shape each layout draws, small: a centred box or one in the corner. */
function LayoutShape({ layout }: { layout: PopupLayout }) {
  return (
    <span
      aria-hidden="true"
      className="relative block h-10 w-14 shrink-0 rounded-sm border bg-muted"
    >
      <span
        className={cn(
          "absolute rounded-xs bg-foreground/60",
          layout === "modal" ? "inset-x-3 top-2 bottom-2" : "right-1 bottom-1 h-4 w-6"
        )}
      />
    </span>
  )
}

/**
 * Görünüm (adr/0080 §6): the design inside (§6a), then a centred window
 * or a corner card on a wide screen (a phone draws both as a bottom
 * sheet); under "Gelişmiş", which one wins when two could show on the
 * same page.
 */
export function LookCard() {
  const { t } = useTranslation()
  const { control } = useFormContext<PopupValues>()
  const { errors } = useFormState({ control, name: "priority" })
  const [advanced, setAdvanced] = useState(false)
  const open = advanced || Boolean(errors.priority)
  return (
    <SectionCard title={t(`${F}.look`)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t(`${F}.design`)}</span>
          <DesignPicker />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t(`${F}.layout`)}</span>
          <Controller
            control={control}
            name="layout"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                aria-label={t(`${F}.layout`)}
                onValueChange={field.onChange}
                className="grid gap-2 sm:grid-cols-2"
              >
                {POPUP_LAYOUTS.map((layout) => (
                  <label
                    key={layout}
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                  >
                    <RadioGroupItem value={layout} />
                    <LayoutShape layout={layout} />
                    <span className="font-medium">{t(`popups.choices.layout.${layout}`)}</span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => {
              setAdvanced(!open)
            }}
            className="inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
          >
            {t(`${F}.advanced`)}
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4 transition-transform", open ? "rotate-180" : "")}
            />
          </button>
          {open ? (
            <div className="max-w-xs">
              <NumberInput
                name="priority"
                label={t(`${F}.priority`)}
                min={0}
                max={POPUP_LIMITS.priorityMax}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">{t(`${F}.priorityHint`)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  )
}
