import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { FormSection } from "@qticaret/admin-ui/patterns/form-section"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { IyzicoAccount } from "@/features/settings/api/payments"
import { useAccountActions } from "@/features/settings/account-actions"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"
import { NotificationAddress } from "@/features/settings/components/notification-address"
import {
  iyzicoFormSchema,
  iyzicoFormValues,
  iyzicoKeysRequired,
  iyzicoSaveBody,
  iyzicoWebhookUrl,
} from "@/features/settings/payments"
import type { IyzicoFormValues } from "@/features/settings/payments"

const I = "settings.payments.iyzico"

/**
 * Settings > Payment > iyzico (adr/0027, F5 V8), in the order the shop
 * sets it up: the API keys, the notification address, then the sandbox
 * until going live. The sandbox and the live service have their own keys:
 * switching asks for both again, and iyzico checks them at the address
 * of the chosen mode before anything is saved.
 */
export function IyzicoSettings({
  account,
  keyConfigured,
}: {
  account: IyzicoAccount | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const name = t("settings.payments.methods.iyzico.name")
  const actions = useAccountActions("iyzico", name)
  const form = useForm<IyzicoFormValues>({
    resolver: zodResolver(iyzicoFormSchema(account)),
    defaultValues: iyzicoFormValues(account),
  })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const locked = !keyConfigured || actions.busy
  const testMode = useWatch({ control: form.control, name: "test_mode" })
  const required = iyzicoKeysRequired(account, testMode)
  const message = (key: string | undefined) => (key ? t(key, { name }) : undefined)

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit((values) => actions.submit(iyzicoSaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      <AccountAlert provider="iyzico" state={state} keyConfigured={keyConfigured} />
      <FormSection title={t(`${I}.keys.title`)} description={t(`${I}.keys.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5">
          {(["api_key", "secret_key"] as const).map((field) => (
            <SecretField
              key={field}
              id={`iyzico-${field}`}
              label={t(`${I}.${field}`)}
              name={name}
              kept={account?.secrets[field] === true && !required}
              error={message(errors[field]?.message)}
              registration={form.register(field)}
            />
          ))}
        </fieldset>
      </FormSection>
      <FormSection
        title={t(`${I}.notification.title`)}
        description={t(`${I}.notification.description`)}
      >
        <NotificationAddress
          id="iyzico-webhook-url"
          url={iyzicoWebhookUrl(window.location.origin)}
          label={t(`${I}.notification.title`)}
          hint={t(`${I}.notification.where`)}
        />
      </FormSection>
      <FormSection title={t(`${I}.live.title`)} description={t(`${I}.live.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor="iyzico-test-mode" className="text-sm font-medium">
              {t(`${I}.testMode`)}
            </label>
            <span id="iyzico-test-mode-hint" className="text-[13px] text-muted-foreground">
              {t(`${I}.testModeHint`)}
            </span>
          </div>
          <Controller
            control={form.control}
            name="test_mode"
            render={({ field }) => (
              <Switch
                id="iyzico-test-mode"
                aria-describedby="iyzico-test-mode-hint"
                checked={field.value}
                onCheckedChange={(on) => {
                  field.onChange(on)
                  // The keys of the other mode are asked for at once, not on save
                  if (form.formState.isSubmitted) {
                    void form.trigger(["api_key", "secret_key"])
                  }
                }}
              />
            )}
          />
        </fieldset>
        <p className="border-t pt-4 text-xs text-muted-foreground">{t(`${I}.live.where`)}</p>
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
