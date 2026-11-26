import { Controller, useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Input } from "@qticaret/admin-ui/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { searchCustomers } from "@/features/payment-links/api/payment-links"
import type { LinkFormValues } from "@/features/payment-links/form"
import { useFieldError } from "./use-field-error"

const C = "paymentLinks.form.customer"

/**
 * Who the order is for (adr/0051 §13): a customer the shop knows, found
 * by name or e-mail (their group's prices apply), or a new one by name,
 * e-mail and phone. The link goes to that e-mail; the phone opens WhatsApp.
 */
export function CustomerCard() {
  const { t } = useTranslation()
  const fieldError = useFieldError()
  const { control, register, formState } = useFormContext<LinkFormValues>()
  const mode = useWatch({ control, name: "customerMode" })
  const errors = formState.errors
  return (
    <SectionCard
      title={t(`${C}.title`)}
      description={t(`${C}.description`)}
      action={
        <Controller
          control={control}
          name="customerMode"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={field.value}
              aria-label={t(`${C}.mode`)}
              onValueChange={(next) => {
                if (next) {
                  field.onChange(next)
                }
              }}
            >
              <ToggleGroupItem value="existing" className="px-3">
                {t(`${C}.existing`)}
              </ToggleGroupItem>
              <ToggleGroupItem value="guest" className="px-3">
                {t(`${C}.guest`)}
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        />
      }
    >
      {mode === "existing" ? (
        <Field
          label={t(`${C}.search`)}
          htmlFor="link-customer"
          hint={t(`${C}.searchHint`)}
          error={fieldError(errors.customer)}
          required
        >
          <Controller
            control={control}
            name="customer"
            render={({ field }) => (
              <SearchPicker
                id="link-customer"
                value={field.value}
                onChange={field.onChange}
                search={searchCustomers}
                queryKey={["payment-links", "customers"]}
                placeholder={t(`${C}.searchPlaceholder`)}
                empty={t(`${C}.searchEmpty`)}
                inactiveNote={t(`${C}.noEmail`)}
              />
            )}
          />
        </Field>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t(`${C}.firstName`)}
            htmlFor="link-guest-first"
            error={fieldError(errors.guest?.first_name)}
            required
          >
            <Input
              placeholder={t("common.placeholder.firstName")}
              id="link-guest-first"
              maxLength={60}
              {...register("guest.first_name")}
            />
          </Field>
          <Field
            label={t(`${C}.lastName`)}
            htmlFor="link-guest-last"
            error={fieldError(errors.guest?.last_name)}
            required
          >
            <Input
              placeholder={t("common.placeholder.lastName")}
              id="link-guest-last"
              maxLength={60}
              {...register("guest.last_name")}
            />
          </Field>
          <Field
            label={t(`${C}.email`)}
            htmlFor="link-guest-email"
            error={fieldError(errors.guest?.email)}
            required
          >
            <Input
              placeholder={t("common.placeholder.email")}
              id="link-guest-email"
              type="email"
              autoComplete="off"
              maxLength={100}
              {...register("guest.email")}
            />
          </Field>
          <Field
            label={t(`${C}.phone`)}
            htmlFor="link-guest-phone"
            hint={t(`${C}.phoneHint`)}
            error={fieldError(errors.guest?.phone)}
          >
            <Input
              placeholder={t("common.placeholder.phone")}
              id="link-guest-phone"
              type="tel"
              autoComplete="off"
              maxLength={20}
              {...register("guest.phone")}
            />
          </Field>
        </div>
      )}
    </SectionCard>
  )
}
