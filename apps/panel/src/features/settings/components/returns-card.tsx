import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MIN_WITHDRAWAL_DAYS, sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { ReturnsSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const R = "settings.shipping.returns"
const PAYERS = ["shop", "customer"] as const

const schema = z.object({
  withdrawal_days: z.string().refine((text) => {
    const days = Number(text.trim())
    return /^\d{2,3}$/.test(text.trim()) && days >= MIN_WITHDRAWAL_DAYS && days <= 365
  }, `${R}.daysInvalid`),
  return_shipping: z.enum(PAYERS),
})
type Values = z.infer<typeof schema>

const valuesOf = (saved: ReturnsSettings): Values => ({
  withdrawal_days: String(saved.withdrawal_days),
  return_shipping: saved.return_shipping,
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
      { withdrawal_days: Number(next.withdrawal_days), return_shipping: next.return_shipping },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values))
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
        form.reset(values)
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
        <Field label={t(`${R}.payer`)} htmlFor="returns-payer" hint={t(`${R}.payerHint`)}>
          <Controller
            control={form.control}
            name="return_shipping"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="returns-payer" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYERS.map((payer) => (
                    <SelectItem key={payer} value={payer}>
                      {t(`${R}.payers.${payer}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>
      <p className="text-[13px] text-muted-foreground">{t(`${R}.excludedHint`)}</p>
    </CardForm>
  )
}

/**
 * Settings > Shipping: the shop's return rules (F13.4, adr/0041). The days
 * a shopper may withdraw in (the law's 14 or more) bound the return window
 * and fill the return policy; who pays the return shows in the products'
 * structured data. Products outside the right are marked on their own page.
 */
export function ReturnsCard() {
  const query = useQuery(sectionQuery<ReturnsSettings>("returns"))
  return query.data ? <Form saved={query.data.values} /> : <Skeleton className="h-64 rounded-lg" />
}
