import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field, FormSection } from "@qticaret/admin-ui/patterns/form-section"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { Input } from "@qticaret/admin-ui/ui/input"
import type { MetaAccount } from "@/features/settings/api/payments"
import { useAccountActions } from "@/features/settings/account-actions"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"
import { metaFormSchema, metaFormValues, metaSaveBody } from "@/features/settings/conversions"
import type { MetaFormValues } from "@/features/settings/conversions"
import { nothingStored } from "@/features/settings/payments"

const N = "settings.marketing.conversions"
const S = `${N}.meta`

/**
 * Settings > Marketing > Meta (F10.9): the shop's pixel and the access
 * token of its Conversions API; Meta checks both before they are saved.
 * Purchases go only with the shopper's marketing consent.
 */
export function MetaSettings({
  account,
  keyConfigured,
}: {
  account: MetaAccount | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const name = t(`${N}.providers.meta.name`)
  const actions = useAccountActions("meta", name, N)
  const form = useForm<MetaFormValues>({
    resolver: zodResolver(metaFormSchema(account)),
    defaultValues: metaFormValues(account),
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
        void form.handleSubmit((values) => actions.submit(metaSaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      <AccountAlert provider="meta" state={state} keyConfigured={keyConfigured} ns={N} />
      <FormSection title={t(`${S}.keys.title`)} description={t(`${S}.keys.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t(`${S}.pixelId`)}
              htmlFor="meta-pixel-id"
              hint={t(`${S}.pixelIdHint`)}
              error={message(errors.pixelId?.message)}
              required
            >
              <Input
                placeholder={t("settings.placeholders.pixelId")}
                id="meta-pixel-id"
                inputMode="numeric"
                autoComplete="off"
                {...form.register("pixelId")}
              />
            </Field>
            <SecretField
              id="meta-access-token"
              label={t(`${S}.accessToken`)}
              name={name}
              kept={account?.secrets["access_token"] === true && !nothingStored(account)}
              error={message(errors.accessToken?.message)}
              registration={form.register("accessToken")}
            />
          </div>
          <Field
            label={t(`${S}.testEventCode`)}
            htmlFor="meta-test-event-code"
            hint={t(`${S}.testEventCodeHint`)}
            error={message(errors.testEventCode?.message)}
          >
            <Input
              placeholder={t("settings.placeholders.testEventCode")}
              id="meta-test-event-code"
              autoComplete="off"
              className="sm:w-64"
              {...form.register("testEventCode")}
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
