import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { NumberField } from "@/components/patterns/number-field"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { ComplianceSettings } from "@/features/settings/api/sections"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

const A = "settings.legal.age"

const schema = z.object({
  min_age: z.string().refine((text) => {
    const age = Number(text.trim())
    return /^\d{2}$/.test(text.trim()) && age >= 18 && age <= 25
  }, `${A}.invalid`),
})
type Values = z.infer<typeof schema>

function Form({ saved }: { saved: ComplianceSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<ComplianceSettings>("compliance")
  const values: Values = { min_age: String(saved.min_age) }
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const error = form.formState.errors.min_age?.message
  const submit = form.handleSubmit((next) => {
    save.mutate(
      { min_age: Number(next.min_age) },
      {
        onSuccess: (result) => {
          form.reset({ min_age: String(result.values.min_age) }, FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${A}.title`)}
      description={t(`${A}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <Field
        label={t(`${A}.minAge`)}
        htmlFor="age-min"
        hint={t(`${A}.minAgeHint`)}
        error={error ? t(error) : undefined}
      >
        <NumberField
          min={18}
          max={25}
          id="age-min"
          className="w-40"
          {...form.register("min_age")}
        />
      </Field>
    </CardForm>
  )
}

/**
 * The age a buyer of a restricted product declares (F13.3, adr/0041 §4):
 * shown while the shop checks ages. The date of birth is checked at
 * checkout and never kept.
 */
export function AgeLimitCard() {
  const on = useFeature("compliance.age_verification")
  const query = useQuery({ ...sectionQuery<ComplianceSettings>("compliance"), enabled: on })
  return on && query.data ? <Form saved={query.data.values} /> : null
}
