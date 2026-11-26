import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field, FormSection } from "@qticaret/admin-ui/patterns/form-section"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { NetgsmAccount } from "@/features/settings/api/payments"
import { useAccountActions } from "@/features/settings/account-actions"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"
import { netgsmFormSchema, netgsmFormValues, netgsmSaveBody } from "@/features/settings/netgsm"
import type { NetgsmFormValues } from "@/features/settings/netgsm"
import { nothingStored } from "@/features/settings/payments"

const N = "settings.sms"
const S = `${N}.netgsm`

/**
 * Settings > SMS > Netgsm (adr/0036): the shop's own Netgsm
 * account, since its sender name is registered to its company. Netgsm
 * checks the login and the sender name before anything is saved.
 */
export function NetgsmSettings({
  account,
  keyConfigured,
}: {
  account: NetgsmAccount | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const name = t(`${N}.providers.netgsm.name`)
  const actions = useAccountActions("netgsm", name, N)
  const form = useForm<NetgsmFormValues>({
    resolver: zodResolver(netgsmFormSchema(account)),
    defaultValues: netgsmFormValues(account),
  })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const locked = !keyConfigured || actions.busy
  const message = (key: string | undefined) => (key ? t(key, { name }) : undefined)
  const kept = (secret: "usercode" | "password") =>
    account?.secrets[secret] === true && !nothingStored(account)

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit((values) => actions.submit(netgsmSaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      <AccountAlert provider="netgsm" state={state} keyConfigured={keyConfigured} ns={N} />
      <FormSection title={t(`${S}.keys.title`)} description={t(`${S}.keys.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <SecretField
              id="netgsm-usercode"
              label={t(`${S}.usercode`)}
              name={name}
              kept={kept("usercode")}
              error={message(errors.usercode?.message)}
              registration={form.register("usercode")}
            />
            <SecretField
              id="netgsm-password"
              label={t(`${S}.password`)}
              name={name}
              kept={kept("password")}
              error={message(errors.password?.message)}
              registration={form.register("password")}
            />
          </div>
          <Field
            label={t(`${S}.msgheader`)}
            htmlFor="netgsm-msgheader"
            hint={t(`${S}.msgheaderHint`)}
            error={message(errors.msgheader?.message)}
            required
          >
            <Input
              placeholder={t("settings.placeholders.smsHeader")}
              id="netgsm-msgheader"
              autoComplete="off"
              maxLength={11}
              {...form.register("msgheader")}
            />
          </Field>
        </fieldset>
      </FormSection>
      <FormSection title={t(`${S}.iys.title`)} description={t(`${S}.iys.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5">
          <Field
            label={t(`${S}.iysBrandCode`)}
            htmlFor="netgsm-iys-brand-code"
            hint={t(`${S}.iysBrandCodeHint`)}
            error={message(errors.iysBrandCode?.message)}
          >
            <Input
              placeholder={t("settings.placeholders.iysCode")}
              id="netgsm-iys-brand-code"
              autoComplete="off"
              inputMode="numeric"
              maxLength={12}
              className="sm:w-64"
              {...form.register("iysBrandCode")}
            />
          </Field>
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
