import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field, FormSection } from "@qticaret/admin-ui/patterns/form-section"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { PaytrAccount } from "@/features/settings/api/payments"
import { NOT_A_LOGIN, useAccountActions } from "@/features/settings/account-actions"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"
import { NotificationAddress } from "@/features/settings/components/notification-address"
import {
  paytrFormSchema,
  paytrFormValues,
  paytrNotificationUrl,
  paytrSaveBody,
  secretsRequired,
} from "@/features/settings/payments"
import type { PaytrFormValues } from "@/features/settings/payments"

const P = "settings.payments.paytr"

/**
 * Settings > Payment > PayTR (adr/0027), in the order the shop sets it up:
 * the account, the notification address to paste into PayTR, then test
 * mode until going live. Each step says where in PayTR's own panel it is
 * done (dev.paytr.com, 2026-10-27). PayTR is asked before anything is
 * saved. The page remounts this form when the stored account changes
 * (`accountKey`), so the secrets typed for a save never linger.
 */
export function PaytrSettings({
  account,
  keyConfigured,
}: {
  account: PaytrAccount | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const name = t("settings.payments.methods.paytr.name")
  const actions = useAccountActions("paytr", name)
  const form = useForm<PaytrFormValues>({
    resolver: zodResolver(paytrFormSchema(account)),
    defaultValues: paytrFormValues(account),
  })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const locked = !keyConfigured || actions.busy
  // A new shop number asks for both secrets again, as the server does
  const merchantId = useWatch({ control: form.control, name: "merchant_id" })
  const required = secretsRequired(account, merchantId)
  const message = (key: string | undefined) => (key ? t(key, { name }) : undefined)

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit((values) => actions.submit(paytrSaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      <AccountAlert provider="paytr" state={state} keyConfigured={keyConfigured} />
      <FormSection title={t(`${P}.account.title`)} description={t(`${P}.account.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5">
          <Field
            label={t(`${P}.merchantId`)}
            htmlFor="paytr-merchant-id"
            hint={t(`${P}.merchantIdHint`)}
            required
            error={message(errors.merchant_id?.message)}
          >
            <Input
              id="paytr-merchant-id"
              inputMode="numeric"
              {...NOT_A_LOGIN}
              {...form.register("merchant_id", {
                onChange: () => {
                  if (form.formState.isSubmitted) {
                    void form.trigger(["merchant_key", "merchant_salt"])
                  }
                },
              })}
            />
          </Field>
          {(["merchant_key", "merchant_salt"] as const).map((field) => (
            <SecretField
              key={field}
              id={`paytr-${field}`}
              label={t(`${P}.${field}`)}
              name={name}
              kept={account?.secrets[field] === true && !required}
              error={message(errors[field]?.message)}
              registration={form.register(field)}
            />
          ))}
        </fieldset>
      </FormSection>
      <FormSection
        title={t(`${P}.notification.title`)}
        description={t(`${P}.notification.description`)}
      >
        <NotificationAddress
          id="paytr-notification-url"
          url={paytrNotificationUrl(window.location.origin)}
          label={t(`${P}.notification.title`)}
          hint={t(`${P}.notification.where`)}
        />
      </FormSection>
      <FormSection title={t(`${P}.live.title`)} description={t(`${P}.live.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor="paytr-test-mode" className="text-sm font-medium">
              {t(`${P}.testMode`)}
            </label>
            <span id="paytr-test-mode-hint" className="text-[13px] text-muted-foreground">
              {t(`${P}.testModeHint`)}
            </span>
          </div>
          <Controller
            control={form.control}
            name="test_mode"
            render={({ field }) => (
              <Switch
                id="paytr-test-mode"
                aria-describedby="paytr-test-mode-hint"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </fieldset>
        <p className="border-t pt-4 text-xs text-muted-foreground">{t(`${P}.live.where`)}</p>
      </FormSection>
      <AccountFooter
        actions={actions}
        name={name}
        state={state}
        dirty={isDirty}
        keyConfigured={keyConfigured}
      />
    </form>
  )
}
