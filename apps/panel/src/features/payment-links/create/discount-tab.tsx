import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { useStaff } from "@/features/auth/api/staff"
import { DISCOUNT_TYPES } from "@/features/payment-links/api/types"
import type { PaymentLinkSettings } from "@/features/payment-links/api/types"
import { MAX_PERCENT } from "@/features/payment-links/form"
import type { LinkFormValues } from "@/features/payment-links/form"
import { sectionQuery } from "@/features/settings/api/sections"
import { useFieldError } from "./use-field-error"

const D = "paymentLinks.form.discount"

/**
 * A discount on this link only (adr/0051 §2), owner and admin: a percent
 * or an amount in lira, always with its reason (the owner reads them in the
 * list). An admin's limit is the owner's setting; the backend holds it.
 */
export function DiscountTab() {
  const { t } = useTranslation()
  const fieldError = useFieldError()
  const { control, register, formState } = useFormContext<LinkFormValues>()
  const [on, type] = useWatch({ control, name: ["discountOn", "discountType"] })
  const admin = useStaff()?.role === "admin"
  const settings = useQuery({
    ...sectionQuery<PaymentLinkSettings>("payment_links"),
    enabled: admin && on,
  })
  const limit = settings.data?.values.admin_max_discount_percent
  const errors = formState.errors
  return (
    <SectionCard
      title={t(`${D}.title`)}
      description={t(`${D}.description`)}
      action={
        <Controller
          control={control}
          name="discountOn"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-label={t(`${D}.toggle`)}
            />
          )}
        />
      }
    >
      {on ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t(`${D}.type`)}>
            <Controller
              control={control}
              name="discountType"
              render={({ field }) => (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={field.value}
                  aria-label={t(`${D}.type`)}
                  className="w-full"
                  onValueChange={(next) => {
                    if (next) {
                      field.onChange(next)
                    }
                  }}
                >
                  {DISCOUNT_TYPES.map((each) => (
                    <ToggleGroupItem key={each} value={each} className="flex-1">
                      {t(`${D}.types.${each}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            />
          </Field>
          <Field
            label={t(type === "percentage" ? `${D}.percent` : `${D}.amount`)}
            htmlFor="link-discount-value"
            hint={
              type === "percentage"
                ? admin && limit !== undefined
                  ? t(`${D}.adminLimit`, { limit })
                  : t(`${D}.percentHint`, { max: MAX_PERCENT })
                : t(`${D}.amountHint`)
            }
            error={fieldError(errors.discountValue)}
            required
          >
            <NumberField
              id="link-discount-value"
              decimals={type === "percentage" ? 0 : 2}
              min={0}
              {...(type === "percentage" ? { suffix: "%" } : {})}
              {...register("discountValue")}
            />
          </Field>
          <Field
            label={t(`${D}.reason`)}
            htmlFor="link-discount-reason"
            hint={t(`${D}.reasonHint`)}
            error={fieldError(errors.discountReason)}
            className="sm:col-span-2"
            required
          >
            <Input
              placeholder={t("paymentLinks.placeholders.discountReason")}
              id="link-discount-reason"
              maxLength={200}
              {...register("discountReason")}
            />
          </Field>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${D}.off`)}</p>
      )}
    </SectionCard>
  )
}
