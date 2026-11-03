import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { MIN_WITHDRAWAL_DAYS, sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { ReturnsSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

const R = "settings.shipping.returns"

const schema = z.object({
  withdrawal_days: z.string().refine((text) => {
    const days = Number(text.trim())
    return /^\d{2,3}$/.test(text.trim()) && days >= MIN_WITHDRAWAL_DAYS && days <= 365
  }, `${R}.daysInvalid`),
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: ReturnsSettings): Values => ({
  withdrawal_days: String(saved.withdrawal_days),
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
  const { errors } = form.formState
  const submit = form.handleSubmit((next) => {
    save.mutate(
      // Who pays the return is the law's, not a choice: never sent (adr/0032 Ek 2026-11-03)
      { withdrawal_days: Number(next.withdrawal_days) },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values), FULL_RESET)
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
          <Input id="returns-days" inputMode="numeric" {...form.register("withdrawal_days")} />
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
