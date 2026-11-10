import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import type { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { errorLine, infoPagesSchema, useSaveStorefront } from "@/features/settings/storefront"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const C = "settings.storefront.infoPages"
// The addresses Turkish shops give these pages: the server's own defaults
const PAYMENT_DEFAULT = "/odeme-secenekleri"
const SHIPPING_DEFAULT = "/kargo-ve-teslimat"

type Values = z.infer<typeof infoPagesSchema>

const valuesOf = (saved: StorefrontSettings): Values => ({
  payment: saved.payment_info_path ?? "",
  shipping: saved.shipping_info_path ?? "",
})

/**
 * The pages the storefront shows its live facts beside (adr/0046 Ek
 * 2026-11-05), chosen as the contact page is: the payment page gets the
 * ways to pay and the installment rates, the shipping page the carriers
 * and the shop's promises. A field left empty names no page.
 */
export function InfoPagesCard({ saved }: { saved: StorefrontSettings }) {
  const { t } = useTranslation()
  const { save, saving } = useSaveStorefront()
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(infoPagesSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const submit = form.handleSubmit((next) => {
    save(
      {
        payment_info_path: next.payment === "" ? null : next.payment,
        shipping_info_path: next.shipping === "" ? null : next.shipping,
      },
      (stored) => {
        form.reset(valuesOf(stored), FULL_RESET)
      }
    )
  })
  const paymentError = errorLine(t, form.formState.errors.payment)
  const shippingError = errorLine(t, form.formState.errors.shipping)
  return (
    <CardForm
      title={t(`${C}.title`)}
      description={t(`${C}.description`)}
      dirty={form.formState.isDirty}
      saving={saving}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t(`${C}.payment`)}
          htmlFor="storefront-payment-page"
          hint={t(`${C}.paymentHint`)}
          error={paymentError}
        >
          <Input
            id="storefront-payment-page"
            autoComplete="off"
            placeholder={PAYMENT_DEFAULT}
            aria-invalid={Boolean(paymentError)}
            {...form.register("payment")}
          />
        </Field>
        <Field
          label={t(`${C}.shipping`)}
          htmlFor="storefront-shipping-page"
          hint={t(`${C}.shippingHint`)}
          error={shippingError}
        >
          <Input
            id="storefront-shipping-page"
            autoComplete="off"
            placeholder={SHIPPING_DEFAULT}
            aria-invalid={Boolean(shippingError)}
            {...form.register("shipping")}
          />
        </Field>
      </div>
      <p className="text-[13px] text-muted-foreground">{t(`${C}.empty`)}</p>
    </CardForm>
  )
}
