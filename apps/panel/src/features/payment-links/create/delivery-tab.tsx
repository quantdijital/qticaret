import { useQuery } from "@tanstack/react-query"
import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { SectionCard } from "@/components/patterns/section-card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { LinkFormValues } from "@/features/payment-links/form"
import { shopShippingOptionsQuery } from "@/features/settings/api/shipping-options"
import { TrAddressFields } from "@/features/tr-address/address-fields"
import { useFieldError } from "./use-field-error"

const D = "paymentLinks.form.delivery"
const CUSTOMER_PICKS = "__customer"

/**
 * Where it goes (adr/0051 §13), optional: an address typed now is the
 * cart's, and with it a shipping option may be set. The shop's options all
 * serve its Türkiye zone, so any of them fits a Turkish address; without
 * an address the customer enters both at checkout.
 */
export function DeliveryTab() {
  const { t } = useTranslation()
  const fieldError = useFieldError()
  const { control, register, formState } = useFormContext<LinkFormValues>()
  const deliver = useWatch({ control, name: "deliver" })
  const options = useQuery({ ...shopShippingOptionsQuery(), enabled: deliver })
  const errors = formState.errors
  return (
    <SectionCard
      title={t(`${D}.title`)}
      description={t(deliver ? `${D}.descriptionOn` : `${D}.descriptionOff`)}
      action={
        <Controller
          control={control}
          name="deliver"
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
      {deliver ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t(`${D}.firstName`)}
              htmlFor="link-address-first"
              error={fieldError(errors.recipient_first)}
              required
            >
              <Input id="link-address-first" maxLength={60} {...register("recipient_first")} />
            </Field>
            <Field
              label={t(`${D}.lastName`)}
              htmlFor="link-address-last"
              error={fieldError(errors.recipient_last)}
              required
            >
              <Input id="link-address-last" maxLength={60} {...register("recipient_last")} />
            </Field>
          </div>
          <TrAddressFields
            control={control}
            idPrefix="link-address"
            errors={{
              address_1: fieldError(errors.address_1),
              address_2: fieldError(errors.address_2),
              province: fieldError(errors.province),
              city: fieldError(errors.city),
              postal_code: fieldError(errors.postal_code),
              phone: fieldError(errors.phone),
            }}
          />
          <Field label={t(`${D}.shipping`)} htmlFor="link-shipping" hint={t(`${D}.shippingHint`)}>
            <Controller
              control={control}
              name="shipping_option_id"
              render={({ field }) => (
                <Select
                  value={field.value || CUSTOMER_PICKS}
                  onValueChange={(next) => {
                    field.onChange(next === CUSTOMER_PICKS ? "" : next)
                  }}
                >
                  <SelectTrigger id="link-shipping" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CUSTOMER_PICKS}>{t(`${D}.customerPicks`)}</SelectItem>
                    {(options.data ?? []).map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${D}.off`)}</p>
      )}
    </SectionCard>
  )
}
