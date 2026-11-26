import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Input } from "@qticaret/admin-ui/ui/input"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { InvoiceCarrier, InvoicingSettings } from "@/features/settings/api/einvoice"
import { errorText } from "@/lib/errors"

const C = "settings.shipping.invoiceIdentity"

const schema = z
  .object({ title: z.string().trim().max(200), tax_id: z.string().trim() })
  .refine((value) => (value.title === "") === (value.tax_id === ""), {
    message: `${C}.both`,
    path: ["title"],
  })
  .refine((value) => value.tax_id === "" || /^\d{10,11}$/.test(value.tax_id), {
    message: `${C}.taxIdInvalid`,
    path: ["tax_id"],
  })
type Values = z.infer<typeof schema>

const valuesOf = (saved: InvoicingSettings, carrier: InvoiceCarrier): Values => ({
  title: saved.carriers[carrier]?.title ?? "",
  tax_id: saved.carriers[carrier]?.tax_id ?? "",
})

function IdentityForm({ saved, carrier }: { saved: InvoicingSettings; carrier: InvoiceCarrier }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const save = useSaveSection<InvoicingSettings>("invoicing")
  const values = valuesOf(saved, carrier)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors } = form.formState
  const submit = form.handleSubmit(async (next) => {
    // The section keeps every carrier's in one map, sent whole: the others go back as
    // stored now, read again first, so one saved meanwhile elsewhere is not undone
    const fresh = await client
      .query({ ...sectionQuery<InvoicingSettings>("invoicing"), staleTime: 0 })
      .then((answer) => answer.values.carriers)
      .catch(() => saved.carriers)
    const others = Object.fromEntries(Object.entries(fresh).filter(([key]) => key !== carrier))
    const carriers =
      next.title === ""
        ? others
        : { ...others, [carrier]: { title: next.title, tax_id: next.tax_id } }
    save.mutate(
      { carriers },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values, carrier), FULL_RESET)
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
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field
          label={t(`${C}.titleLabel`)}
          htmlFor={`carrier-${carrier}-title`}
          error={errors.title?.message ? t(errors.title.message) : undefined}
        >
          <Input id={`carrier-${carrier}-title`} maxLength={200} {...form.register("title")} />
        </Field>
        <Field
          label={t(`${C}.taxId`)}
          htmlFor={`carrier-${carrier}-tax`}
          error={errors.tax_id?.message ? t(errors.tax_id.message) : undefined}
        >
          <Input
            id={`carrier-${carrier}-tax`}
            inputMode="numeric"
            maxLength={11}
            {...form.register("tax_id")}
          />
        </Field>
      </div>
    </CardForm>
  )
}

/**
 * Settings > Shipping > a carrier's page: its registered name and tax id,
 * which an e-Arşiv for a parcel it carried names (adr/0034 §3). Kept in
 * the invoicing section as before; it moved here from the invoices page
 * (the owner, 2026-11-26: carrier details belong with the carrier).
 */
export function CarrierInvoiceCard({ carrier }: { carrier: InvoiceCarrier }) {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<InvoicingSettings>("invoicing"))
  if (query.isError) {
    return <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
  }
  if (!query.data) {
    return <LoadingRows rows={2} />
  }
  return (
    <IdentityForm
      key={JSON.stringify(query.data.values.carriers[carrier] ?? null)}
      saved={query.data.values}
      carrier={carrier}
    />
  )
}
