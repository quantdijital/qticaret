import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field, FormSection } from "@qticaret/admin-ui/patterns/form-section"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { Ga4Account } from "@/features/settings/api/payments"
import { useAccountActions } from "@/features/settings/account-actions"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"
import { ga4FormSchema, ga4FormValues, ga4SaveBody } from "@/features/settings/conversions"
import type { Ga4FormValues } from "@/features/settings/conversions"
import { nothingStored } from "@/features/settings/payments"

const N = "settings.marketing.conversions"
const S = `${N}.ga4`

/**
 * Settings > Marketing > GA4 (F10.9): the shop's web stream and a
 * Measurement Protocol API secret. GA4 takes any secret without a word,
 * so only its form is checked here. Purchases go only with the shopper's
 * analytics consent.
 */
export function Ga4Settings({
  account,
  keyConfigured,
}: {
  account: Ga4Account | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const name = t(`${N}.providers.ga4.name`)
  const actions = useAccountActions("ga4", name, N)
  const form = useForm<Ga4FormValues>({
    resolver: zodResolver(ga4FormSchema(account)),
    defaultValues: ga4FormValues(account),
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
        void form.handleSubmit((values) => actions.submit(ga4SaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      <AccountAlert provider="ga4" state={state} keyConfigured={keyConfigured} ns={N} />
      <FormSection title={t(`${S}.keys.title`)} description={t(`${S}.keys.description`)}>
        <fieldset disabled={locked} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <Field
            label={t(`${S}.measurementId`)}
            htmlFor="ga4-measurement-id"
            hint={t(`${S}.measurementIdHint`)}
            error={message(errors.measurementId?.message)}
            required
          >
            <Input id="ga4-measurement-id" autoComplete="off" {...form.register("measurementId")} />
          </Field>
          <SecretField
            id="ga4-api-secret"
            label={t(`${S}.apiSecret`)}
            name={name}
            kept={account?.secrets["api_secret"] === true && !nothingStored(account)}
            error={message(errors.apiSecret?.message)}
            registration={form.register("apiSecret")}
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
