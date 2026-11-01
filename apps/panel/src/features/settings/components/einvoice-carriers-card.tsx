import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { useSaveSection } from "@/features/settings/api/sections"
import { INVOICE_CARRIERS } from "@/features/settings/api/einvoice"
import type { InvoiceCarrier, InvoicingSettings } from "@/features/settings/api/einvoice"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"

const C = "settings.einvoice.carriers"

const row = z
  .object({ title: z.string().trim().max(200), tax_id: z.string().trim() })
  .refine((value) => (value.title === "") === (value.tax_id === ""), `${C}.both`)
  .refine((value) => value.tax_id === "" || /^\d{10,11}$/.test(value.tax_id), `${C}.taxIdInvalid`)
const schema = z.object(Object.fromEntries(INVOICE_CARRIERS.map((carrier) => [carrier, row])))
type Values = Record<InvoiceCarrier, { title: string; tax_id: string }>

const valuesOf = (saved: InvoicingSettings): Values =>
  Object.fromEntries(
    INVOICE_CARRIERS.map((carrier) => [
      carrier,
      {
        title: saved.carriers[carrier]?.title ?? "",
        tax_id: saved.carriers[carrier]?.tax_id ?? "",
      },
    ])
  ) as Values

/**
 * The carriers' registered name and tax id (adr/0034 §3): an e-Arşiv for a
 * parcel names who carried it. On the carrier's own invoice to the shop;
 * a parcel whose carrier has none waits for it.
 */
export function EinvoiceCarriersCard({ saved }: { saved: InvoicingSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<InvoicingSettings>("invoicing")
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema) as never,
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const submit = form.handleSubmit((next) => {
    const carriers = Object.fromEntries(
      INVOICE_CARRIERS.filter((carrier) => next[carrier].title !== "").map((carrier) => [
        carrier,
        { title: next[carrier].title.trim(), tax_id: next[carrier].tax_id.trim() },
      ])
    )
    save.mutate(
      { carriers },
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
      title={t(`${C}.title`)}
      description={t(`${C}.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
        {INVOICE_CARRIERS.map((carrier) => {
          const error = form.formState.errors[carrier]
          const message = error?.root?.message ?? error?.message
          return (
            <fieldset
              key={carrier}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_9rem]"
            >
              <legend className="px-1 text-sm font-medium">{t(`${C}.names.${carrier}`)}</legend>
              <Field
                label={t(`${C}.titleLabel`)}
                htmlFor={`carrier-${carrier}-title`}
                {...(message ? { error: t(message) } : {})}
              >
                <Input id={`carrier-${carrier}-title`} {...form.register(`${carrier}.title`)} />
              </Field>
              <Field label={t(`${C}.taxId`)} htmlFor={`carrier-${carrier}-tax`}>
                <Input
                  id={`carrier-${carrier}-tax`}
                  inputMode="numeric"
                  {...form.register(`${carrier}.tax_id`)}
                />
              </Field>
            </fieldset>
          )
        })}
      </div>
    </CardForm>
  )
}
