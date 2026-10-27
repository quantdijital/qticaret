import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { FormSection } from "@/components/patterns/form-section"
import { LeaveGuard } from "@/components/patterns/leave-guard"
import { Switch } from "@/components/ui/switch"
import type { GeliverAccount } from "@/features/settings/api/payments"
import { useAccountActions } from "@/features/settings/account-actions"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"
import { geliverFormSchema, geliverFormValues, geliverSaveBody } from "@/features/settings/geliver"
import type { GeliverFormValues } from "@/features/settings/geliver"
import { nothingStored } from "@/features/settings/payments"

const S = "settings.shipping"
const G = `${S}.geliver`

/**
 * Settings > Shipping > Geliver (F7, adr/0031), in the order the shop sets
 * it up: the API token, then test shipments until going live. One token
 * serves both: Geliver marks a test shipment on the shipment itself, so
 * switching asks for nothing again. Geliver checks the token before
 * anything is saved.
 */
export function GeliverSettings({
  account,
  keyConfigured,
}: {
  account: GeliverAccount | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const name = t(`${S}.carriers.geliver.name`)
  const actions = useAccountActions("geliver", name, S)
  const form = useForm<GeliverFormValues>({
    resolver: zodResolver(geliverFormSchema(account)),
    defaultValues: geliverFormValues(account),
  })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const locked = !keyConfigured || actions.busy
  const message = (key: string | undefined) => (key ? t(key, { name }) : undefined)

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit((values) => actions.submit(geliverSaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      <AccountAlert provider="geliver" state={state} keyConfigured={keyConfigured} ns={S} />
      <FormSection title={t(`${G}.keys.title`)} description={t(`${G}.keys.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5">
          <SecretField
            id="geliver-api-token"
            label={t(`${G}.apiToken`)}
            name={name}
            kept={account?.secrets["api_token"] === true && !nothingStored(account)}
            error={message(errors.api_token?.message)}
            registration={form.register("api_token")}
          />
        </fieldset>
      </FormSection>
      <FormSection title={t(`${G}.live.title`)} description={t(`${G}.live.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor="geliver-test-mode" className="text-sm font-medium">
              {t(`${G}.testMode`)}
            </label>
            <span id="geliver-test-mode-hint" className="text-[13px] text-muted-foreground">
              {t(`${G}.testModeHint`)}
            </span>
          </div>
          <Controller
            control={form.control}
            name="test_mode"
            render={({ field }) => (
              <Switch
                id="geliver-test-mode"
                aria-describedby="geliver-test-mode-hint"
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
