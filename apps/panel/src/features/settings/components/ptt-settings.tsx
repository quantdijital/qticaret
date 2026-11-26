import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field, FormSection } from "@qticaret/admin-ui/patterns/form-section"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import type { PttAccount } from "@/features/settings/api/payments"
import { useAccountActions } from "@/features/settings/account-actions"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"
import {
  pttFormSchema,
  pttFormValues,
  pttPasswordRequired,
  pttSaveBody,
} from "@/features/settings/ptt"
import type { PttFormValues } from "@/features/settings/ptt"

const S = "settings.shipping"
const P = `${S}.ptt`

/**
 * Settings > Shipping > PTT Kargo (docs/entegrasyonlar/ptt.md), in the
 * order the shop sets it up: the customer number and web service password
 * the PTT Başmüdürlük gave, then test mode until going live. PTT is asked
 * with them (a tracking query) before anything is saved; another number
 * or mode asks for the password again. The barcode range and what to ask
 * PTT for are cards of their own below.
 */
export function PttSettings({
  account,
  keyConfigured,
}: {
  account: PttAccount | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const name = t(`${S}.carriers.ptt.name`)
  const actions = useAccountActions("ptt", name, S)
  const form = useForm<PttFormValues>({
    resolver: zodResolver(pttFormSchema(account)),
    defaultValues: pttFormValues(account),
  })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const locked = !keyConfigured || actions.busy
  const message = (key: string | undefined) => (key ? t(key, { name }) : undefined)
  const [customerId, testMode] = useWatch({
    control: form.control,
    name: ["customer_id", "test_mode"],
  })
  const required = pttPasswordRequired(account, { customer_id: customerId, test_mode: testMode })

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit((values) => actions.submit(pttSaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      <AccountAlert provider="ptt" state={state} keyConfigured={keyConfigured} ns={S} />
      <FormSection title={t(`${P}.keys.title`)} description={t(`${P}.keys.description`)}>
        <fieldset disabled={locked} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <Field
            label={t(`${P}.customerId`)}
            htmlFor="ptt-customer-id"
            hint={t(`${P}.customerIdHint`)}
            error={message(errors.customer_id?.message)}
          >
            <Input
              id="ptt-customer-id"
              autoComplete="off"
              inputMode="numeric"
              maxLength={10}
              placeholder={t(`${P}.customerIdPlaceholder`)}
              {...form.register("customer_id")}
            />
          </Field>
          {/* No example in a password field: an example would read as a password to copy */}
          <SecretField
            id="ptt-password"
            label={t(`${P}.password`)}
            name={name}
            kept={account?.secrets["password"] === true && !required}
            error={message(errors.password?.message)}
            registration={form.register("password")}
          />
          <p className="text-[13px] text-muted-foreground sm:col-span-2">{t(`${P}.keysHint`)}</p>
        </fieldset>
      </FormSection>
      <FormSection title={t(`${P}.live.title`)} description={t(`${P}.live.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor="ptt-test-mode" className="text-sm font-medium">
              {t(`${P}.testMode`)}
            </label>
            <span id="ptt-test-mode-hint" className="text-[13px] text-muted-foreground">
              {t(`${P}.testModeHint`)}
            </span>
          </div>
          <Controller
            control={form.control}
            name="test_mode"
            render={({ field }) => (
              <Switch
                id="ptt-test-mode"
                aria-describedby="ptt-test-mode-hint"
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
