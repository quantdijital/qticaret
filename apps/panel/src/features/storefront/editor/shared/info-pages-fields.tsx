import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { infoPagesSchema, useSaveStorefront } from "@/features/settings/storefront"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { rolePageId } from "../page-roles"
import { useContentPages } from "../use-content-pages"
import type { ContentPageOption } from "../use-content-pages"
import { PageRolePicker } from "./page-role-picker"

const C = "settings.storefront.infoPages"

type Values = z.infer<typeof infoPagesSchema>

// A section saved before the ids: its old paths read as the pages at those addresses
const valuesOf = (
  saved: StorefrontSettings,
  pages: readonly ContentPageOption[] | undefined
): Values => ({
  payment: rolePageId(saved, "payment", pages),
  shipping: rolePageId(saved, "shipping", pages),
})

/**
 * The pages the storefront shows its live facts beside (adr/0046 Ek
 * 2026-11-05), chosen as the contact page is: the payment page gets the
 * ways to pay and the installment rates, the shipping page the carriers
 * and the shop's promises. Kept by the pages' ids (adr/0073 Açık kararlar
 * 3); "none" names no page. Saved at once to the storefront section.
 */
export function InfoPagesFields({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const pages = useContentPages().data?.pages
  const values = valuesOf(saved, pages)
  const form = useForm<Values>({
    resolver: zodResolver(infoPagesSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const submit = form.handleSubmit((next) => {
    save({ payment_page_id: next.payment, shipping_page_id: next.shipping }, (stored) => {
      form.reset(valuesOf(stored, pages), FULL_RESET)
    })
  })
  const none = t(`${C}.none`)
  return (
    <CardForm
      bare
      title={t(`${C}.title`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <Field
        label={t(`${C}.payment`)}
        htmlFor="storefront-payment-page"
        hint={t(`${C}.paymentHint`)}
      >
        <Controller
          control={form.control}
          name="payment"
          render={({ field }) => (
            <PageRolePicker
              id="storefront-payment-page"
              value={field.value}
              onChange={field.onChange}
              noneLabel={none}
            />
          )}
        />
      </Field>
      <Field
        label={t(`${C}.shipping`)}
        htmlFor="storefront-shipping-page"
        hint={t(`${C}.shippingHint`)}
      >
        <Controller
          control={form.control}
          name="shipping"
          render={({ field }) => (
            <PageRolePicker
              id="storefront-shipping-page"
              value={field.value}
              onChange={field.onChange}
              noneLabel={none}
            />
          )}
        />
      </Field>
      <p className="text-xs text-muted-foreground">{t(`${C}.empty`)}</p>
    </CardForm>
  )
}
