import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { FormSection } from "@qticaret/admin-ui/patterns/form-section"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { DhlEcomAccount } from "@/features/settings/api/payments"
import { useAccountActions } from "@/features/settings/account-actions"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"
import {
  dhlEcomFormSchema,
  dhlEcomFormValues,
  dhlEcomKeysRequired,
  dhlEcomSaveBody,
} from "@/features/settings/dhlecommerce"
import type { DhlEcomFormValues } from "@/features/settings/dhlecommerce"

const S = "settings.shipping"
const D = `${S}.dhlecommerce`

/**
 * Settings > Shipping > DHL eCommerce (formerly MNG Kargo): the shop's
 * customer number and "Online Şube" password, then test mode until going
 * live. The app keys are the platform's (adr/0027 Ek 2026-11-26): on a
 * server without them the page says so and saves nothing. DHL checks the
 * details before anything is saved.
 */
export function DhlEcomSettings({
  account,
  keyConfigured,
  available,
}: {
  account: DhlEcomAccount | undefined
  keyConfigured: boolean
  /** The platform's app is set on this server. */
  available: boolean
}) {
  const { t } = useTranslation()
  const name = t(`${S}.carriers.dhlecommerce.name`)
  const actions = useAccountActions("dhlecommerce", name, S)
  const form = useForm<DhlEcomFormValues>({
    resolver: zodResolver(dhlEcomFormSchema(account)),
    defaultValues: dhlEcomFormValues(account),
  })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const locked = !keyConfigured || !available || actions.busy
  const testMode = useWatch({ control: form.control, name: "test_mode" })
  const required = dhlEcomKeysRequired(account, testMode)
  const message = (key: string | undefined) => (key ? t(key, { name }) : undefined)

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit((values) => actions.submit(dhlEcomSaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      {available ? null : (
        <Alert>
          <AlertDescription>{t(`${D}.unavailable`)}</AlertDescription>
        </Alert>
      )}
      <AccountAlert provider="dhlecommerce" state={state} keyConfigured={keyConfigured} ns={S} />
      <FormSection title={t(`${D}.keys.title`)} description={t(`${D}.keys.description`)}>
        <fieldset disabled={locked} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <SecretField
            id="dhlecommerce-customer-number"
            label={t(`${D}.customerNumber`)}
            name={name}
            kept={account?.secrets["customer_number"] === true && !required}
            example={t(`${D}.customerNumberPlaceholder`)}
            error={message(errors.customer_number?.message)}
            registration={form.register("customer_number")}
          />
          <SecretField
            id="dhlecommerce-password"
            label={t(`${D}.password`)}
            name={name}
            kept={account?.secrets["password"] === true && !required}
            error={message(errors.password?.message)}
            registration={form.register("password")}
          />
          <p className="text-[13px] text-muted-foreground sm:col-span-2">{t(`${D}.keysHint`)}</p>
        </fieldset>
      </FormSection>
      <FormSection title={t(`${D}.live.title`)} description={t(`${D}.live.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor="dhlecommerce-test-mode" className="text-sm font-medium">
              {t(`${D}.testMode`)}
            </label>
            <span id="dhlecommerce-test-mode-hint" className="text-[13px] text-muted-foreground">
              {t(`${D}.testModeHint`)}
            </span>
          </div>
          <Controller
            control={form.control}
            name="test_mode"
            render={({ field }) => (
              <Switch
                id="dhlecommerce-test-mode"
                aria-describedby="dhlecommerce-test-mode-hint"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </fieldset>
      </FormSection>
      <AccountFooter
        actions={actions}
        name={name}
        state={state}
        dirty={isDirty}
        keyConfigured={keyConfigured && available}
      />
    </form>
  )
}
