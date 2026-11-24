import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Input } from "@qticaret/admin-ui/ui/input"
import { POPUP_FREQUENCIES, POPUP_LIMITS, POPUP_TRIGGERS } from "@/features/popups/api/types"
import type { PopupValues } from "@/features/popups/form"
import { ChoiceSelect } from "./choice-select"
import { NumberInput } from "./number-input"
import { useFieldError } from "./use-field-error"

const F = "popups.form"

/** Where a new trigger starts: five seconds in, or halfway down the page. */
const TRIGGER_START = { delay: 5, scroll: 50 } as const

/** Ne zaman (adr/0080 §4): its dates, what opens it and how often one visitor sees it. */
export function TimingCard() {
  const { t } = useTranslation()
  const { register, control, setValue } = useFormContext<PopupValues>()
  const error = useFieldError()
  const [trigger, frequency] = useWatch({ control, name: ["trigger", "frequency"] })
  const delayed = trigger === "delay"
  return (
    <SectionCard title={t(`${F}.timing`)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t(`${F}.startsAt`)} htmlFor="popup-starts-at" error={error("starts_at")}>
          <Input id="popup-starts-at" type="datetime-local" {...register("starts_at")} />
        </Field>
        <Field
          label={t(`${F}.endsAt`)}
          htmlFor="popup-ends-at"
          hint={t(`${F}.endsAtHint`)}
          error={error("ends_at")}
        >
          <Input id="popup-ends-at" type="datetime-local" {...register("ends_at")} />
        </Field>
        <ChoiceSelect
          name="trigger"
          options={POPUP_TRIGGERS}
          label={t(`${F}.trigger`)}
          onPicked={(next) => {
            setValue("trigger_value", TRIGGER_START[next as keyof typeof TRIGGER_START], {
              shouldDirty: true,
              shouldValidate: true,
            })
          }}
        />
        <NumberInput
          name="trigger_value"
          label={t(delayed ? `${F}.delaySeconds` : `${F}.scrollPercent`)}
          min={delayed ? 0 : 1}
          max={delayed ? POPUP_LIMITS.delayMax : POPUP_LIMITS.scrollMax}
          suffix={delayed ? t(`${F}.secondsUnit`) : "%"}
        />
        <ChoiceSelect name="frequency" options={POPUP_FREQUENCIES} label={t(`${F}.frequency`)} />
        {frequency === "days" ? (
          <NumberInput
            name="frequency_days"
            label={t(`${F}.frequencyDays`)}
            min={1}
            max={POPUP_LIMITS.daysMax}
            suffix={t(`${F}.daysUnit`)}
          />
        ) : null}
      </div>
    </SectionCard>
  )
}
