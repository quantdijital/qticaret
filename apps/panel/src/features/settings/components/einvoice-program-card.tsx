import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { useSaveSection } from "@/features/settings/api/sections"
import {
  INVOICING_PROVIDERS,
  invoicingProviderOf,
  useParasutOffered,
} from "@/features/settings/api/einvoice"
import type { InvoicingSettings } from "@/features/settings/api/einvoice"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const E = "settings.einvoice.program"
const TRIGGERS = ["shipped", "placed"] as const

type Values = Pick<InvoicingSettings, "provider" | "trigger"> & { series: string }

/**
 * Who issues the shop's invoices and when (F8, adr/0034 §1, §8): Paraşüt,
 * BirFatura pulling the orders (adr/0072), the shop's own program writing
 * them back, or none; when the parcel
 * leaves or once the order is placed and paid. The owner's to change.
 * Paraşüt is offered once the platform has opened it (docs/06 principle
 * 10); a shop already on it keeps seeing its choice.
 */
export function EinvoiceProgramCard({
  saved,
  className,
}: {
  saved: InvoicingSettings
  className?: string
}) {
  const { t } = useTranslation()
  const save = useSaveSection<InvoicingSettings>("invoicing")
  const parasut = useParasutOffered()
  const values: Values = {
    provider: invoicingProviderOf(saved.provider),
    trigger: saved.trigger,
    series: saved.series ?? "",
  }
  const offered = INVOICING_PROVIDERS.filter(
    (each) => each !== "parasut" || parasut || values.provider === "parasut"
  )
  const form = useForm<Values>({ values, resetOptions: { keepDirtyValues: true } })
  const provider = useWatch({ control: form.control, name: "provider" })
  const trigger = useWatch({ control: form.control, name: "trigger" })
  // Numbers written back from outside are held to the web sales' series
  const numbered = provider === "external" || provider === "birfatura"
  const submit = form.handleSubmit((next) => {
    const series = next.series.trim().toUpperCase()
    save.mutate(
      { provider: next.provider, trigger: next.trigger, series: series === "" ? null : series },
      {
        onSuccess: (result) => {
          form.reset(
            {
              provider: invoicingProviderOf(result.values.provider),
              trigger: result.values.trigger,
              series: result.values.series ?? "",
            },
            FULL_RESET
          )
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${E}.title`)}
      description={t(`${E}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
      {...(className ? { className } : {})}
    >
      {/* The series matters where invoices are typed in by hand (Paraşüt keeps its own): a row of its own */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t(`${E}.provider`)} htmlFor="einvoice-provider">
          <Controller
            control={form.control}
            name="provider"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="einvoice-provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {offered.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {t(`${E}.providers.${provider}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label={t(`${E}.trigger`)} htmlFor="einvoice-trigger">
          <Controller
            control={form.control}
            name="trigger"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="einvoice-trigger" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((trigger) => (
                    <SelectItem key={trigger} value={trigger}>
                      {t(`${E}.triggers.${trigger}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        {numbered ? (
          <Field label={t(`${E}.series`)} htmlFor="einvoice-series" className="sm:col-span-2">
            <Input
              id="einvoice-series"
              maxLength={3}
              className="w-28 uppercase"
              placeholder="WEB"
              {...form.register("series")}
            />
          </Field>
        ) : null}
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] text-muted-foreground">
        <li>{t(`${E}.hints.${provider}`)}</li>
        <li>{t(`${E}.triggerHints.${trigger}`)}</li>
        {numbered ? <li>{t(`${E}.seriesHint`)}</li> : null}
        <li>{t(`${E}.listed`)}</li>
      </ul>
    </CardForm>
  )
}
