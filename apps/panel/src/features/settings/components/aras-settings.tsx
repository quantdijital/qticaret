import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field, FormSection } from "@/components/patterns/form-section"
import { LeaveGuard } from "@/components/patterns/leave-guard"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { ArasAccount } from "@/features/settings/api/payments"
import { useAccountActions } from "@/features/settings/account-actions"
import {
  arasFormSchema,
  arasFormValues,
  arasSaveBody,
  arasSecretsRequired,
} from "@/features/settings/aras"
import type { ArasFormValues } from "@/features/settings/aras"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"

const S = "settings.shipping"
const A = `${S}.aras`

/**
 * Settings > Shipping > Aras Kargo (adr/0035), in the order the shop sets
 * it up: the details from Aras's integration document, then test mode
 * until going live. Aras checks the user name and password before anything
 * is saved; another customer code, address or mode asks for both again.
 */
export function ArasSettings({
  account,
  keyConfigured,
}: {
  account: ArasAccount | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const name = t(`${S}.carriers.aras.name`)
  const actions = useAccountActions("aras", name, S)
  const form = useForm<ArasFormValues>({
    resolver: zodResolver(arasFormSchema(account)),
    defaultValues: arasFormValues(account),
  })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const locked = !keyConfigured || actions.busy
  const message = (key: string | undefined) => (key ? t(key, { name }) : undefined)
  const [customerCode, serviceUrl, testMode] = useWatch({
    control: form.control,
    name: ["customer_code", "service_url", "test_mode"],
  })
  const required = arasSecretsRequired(account, {
    customer_code: customerCode,
    service_url: serviceUrl,
    test_mode: testMode,
  })
  const kept = (secret: "username" | "password") => account?.secrets[secret] === true && !required

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit((values) => actions.submit(arasSaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      <AccountAlert provider="aras" state={state} keyConfigured={keyConfigured} ns={S} />
      <FormSection title={t(`${A}.keys.title`)} description={t(`${A}.keys.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <SecretField
              id="aras-username"
              label={t(`${A}.username`)}
              name={name}
              kept={kept("username")}
              error={message(errors.username?.message)}
              registration={form.register("username")}
            />
            <SecretField
              id="aras-password"
              label={t(`${A}.password`)}
              name={name}
              kept={kept("password")}
              error={message(errors.password?.message)}
              registration={form.register("password")}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t(`${A}.customerCode`)}
              htmlFor="aras-customer-code"
              hint={t(`${A}.customerCodeHint`)}
              error={message(errors.customer_code?.message)}
            >
              <Input
                id="aras-customer-code"
                autoComplete="off"
                maxLength={20}
                {...form.register("customer_code")}
              />
            </Field>
            <Field
              label={t(`${A}.serviceUrl`)}
              htmlFor="aras-service-url"
              hint={t(`${A}.serviceUrlHint`)}
              error={message(errors.service_url?.message)}
            >
              <Input
                id="aras-service-url"
                autoComplete="off"
                inputMode="url"
                placeholder="https://"
                {...form.register("service_url")}
              />
            </Field>
          </div>
        </fieldset>
      </FormSection>
      <FormSection title={t(`${A}.live.title`)} description={t(`${A}.live.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor="aras-test-mode" className="text-sm font-medium">
              {t(`${A}.testMode`)}
            </label>
            <span id="aras-test-mode-hint" className="text-[13px] text-muted-foreground">
              {t(`${A}.testModeHint`)}
            </span>
          </div>
          <Controller
            control={form.control}
            name="test_mode"
            render={({ field }) => (
              <Switch
                id="aras-test-mode"
                aria-describedby="aras-test-mode-hint"
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
        keyConfigured={keyConfigured}
      />
    </form>
  )
}
