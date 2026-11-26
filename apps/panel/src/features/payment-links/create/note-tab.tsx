import { useFormContext } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { DEFAULT_HOURS, MAX_HOURS, MIN_HOURS } from "@/features/payment-links/form"
import type { LinkFormValues } from "@/features/payment-links/form"
import { useFieldError } from "./use-field-error"

const N = "paymentLinks.form.note"

/**
 * How long the link opens (1 hour to 7 days, 72 hours unless said
 * otherwise) and a note the team reads; the customer never sees it.
 */
export function NoteTab() {
  const { t } = useTranslation()
  const fieldError = useFieldError()
  const { register, formState } = useFormContext<LinkFormValues>()
  const errors = formState.errors
  return (
    <SectionCard title={t(`${N}.title`)} description={t(`${N}.description`)}>
      <div className="flex flex-col gap-4">
        <Field
          label={t(`${N}.hours`)}
          htmlFor="link-hours"
          hint={t(`${N}.hoursHint`, { min: MIN_HOURS, max: MAX_HOURS, default: DEFAULT_HOURS })}
          error={fieldError(errors.hours)}
          required
        >
          <NumberField
            min={MIN_HOURS}
            max={MAX_HOURS}
            id="link-hours"
            className="w-40"
            {...register("hours")}
          />
        </Field>
        <Field
          label={t(`${N}.note`)}
          htmlFor="link-note"
          hint={t(`${N}.noteHint`)}
          error={fieldError(errors.note)}
        >
          <Textarea
            placeholder={t("paymentLinks.placeholders.note")}
            id="link-note"
            rows={3}
            maxLength={1000}
            {...register("note")}
          />
        </Field>
      </div>
    </SectionCard>
  )
}
