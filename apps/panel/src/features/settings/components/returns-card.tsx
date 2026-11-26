import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { MIN_WITHDRAWAL_DAYS, sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { ReturnsSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"

const R = "settings.shipping.returns"

const schema = z.object({
  withdrawal_days: z.string().refine((text) => {
    const days = Number(text.trim())
    return /^\d{2,3}$/.test(text.trim()) && days >= MIN_WITHDRAWAL_DAYS && days <= 365
  }, `${R}.daysInvalid`),
  package_travel: z.boolean(),
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: ReturnsSettings): Values => ({
  withdrawal_days: String(saved.withdrawal_days),
  package_travel: saved.package_travel,
})

function Form({ saved }: { saved: ReturnsSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<ReturnsSettings>("returns")
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const packageTravel = useWatch({ control: form.control, name: "package_travel" })
  const { errors } = form.formState
  const submit = form.handleSubmit((next) => {
    const settle = beginSave(form)
    save.mutate(
      // Who pays the return is the law's, not a choice: never sent (adr/0032 Ek 2026-11-03)
      { withdrawal_days: Number(next.withdrawal_days), package_travel: next.package_travel },
      {
        onSuccess: (result) => {
          settle(valuesOf(result.values))
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${R}.title`)}
      description={t(`${R}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t(`${R}.days`)}
          htmlFor="returns-days"
          hint={t(`${R}.daysHint`, { min: MIN_WITHDRAWAL_DAYS })}
          error={errors.withdrawal_days?.message ? t(errors.withdrawal_days.message) : undefined}
        >
          <NumberField
            min={MIN_WITHDRAWAL_DAYS}
            max={365}
            id="returns-days"
            {...form.register("withdrawal_days")}
          />
        </Field>
        {/* The rule in words where a control was: since 1.1.2026 the shopper never pays it (MSY md. 12) */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t(`${R}.payer`)}</span>
          <p className="flex min-h-9 items-center rounded-md bg-muted px-3 py-2 text-sm">
            {t(`${R}.payerRule`)}
          </p>
          <p className="text-xs text-muted-foreground">{t(`${R}.payerHint`)}</p>
        </div>
      </div>
      <p className="text-[13px] text-muted-foreground">{t(`${R}.excludedHint`)}</p>
      {/* Package travel (adr/0076 §8): a switch, no sector in the code */}
      <div className="flex items-start justify-between gap-4 border-t pt-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor="returns-package-travel" className="text-sm font-medium">
            {t(`${R}.packageTravel`)}
          </label>
          <span id="returns-package-travel-hint" className="text-[13px] text-muted-foreground">
            {t(`${R}.packageTravelHint`)}
          </span>
        </div>
        <Switch
          id="returns-package-travel"
          aria-describedby="returns-package-travel-hint"
          checked={packageTravel}
          onCheckedChange={(checked) => {
            form.setValue("package_travel", checked, { shouldDirty: true })
          }}
        />
      </div>
    </CardForm>
  )
}

/**
 * Settings > Shipping: the shop's return rules (F13.4, adr/0041). The days
 * a shopper may withdraw in (the law's 14 or more) bound the return window
 * and fill the return policy. The return's shipping is the shop's by law
 * (adr/0032 Ek 2026-11-03: MSY md. 12/5, md. 13/3 repealed), said as a
 * sentence: the server takes only "shop", and the products' structured
 * data says a free return. Products outside the right are marked on their
 * own page.
 */
export function ReturnsCard() {
  const query = useQuery(sectionQuery<ReturnsSettings>("returns"))
  return query.data ? <Form saved={query.data.values} /> : <Skeleton className="h-64 rounded-lg" />
}
