import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { FormSection } from "@/components/patterns/form-section"
import { LeaveGuard } from "@/components/patterns/leave-guard"
import { Switch } from "@/components/ui/switch"
import type { YurticiAccount } from "@/features/settings/api/payments"
import { useAccountActions } from "@/features/settings/account-actions"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"
import {
  doorKept,
  yurticiFormSchema,
  yurticiFormValues,
  yurticiLoginsRequired,
  yurticiSaveBody,
} from "@/features/settings/yurtici"
import type { YurticiFormValues } from "@/features/settings/yurtici"

const S = "settings.shipping"
const Y = `${S}.yurtici`

/**
 * Settings > Shipping > Yurtiçi Kargo (adr/0035), in the order the shop
 * sets it up: the web service login, the door account for parcels paid at
 * the door when Yurtiçi gave one, then test mode until going live. Test
 * and live logins differ: switching asks for them again. Yurtiçi checks
 * each login before anything is saved.
 */
export function YurticiSettings({
  account,
  keyConfigured,
}: {
  account: YurticiAccount | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const name = t(`${S}.carriers.yurtici.name`)
  const actions = useAccountActions("yurtici", name, S)
  const form = useForm<YurticiFormValues>({
    resolver: zodResolver(yurticiFormSchema(account)),
    defaultValues: yurticiFormValues(account),
  })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const locked = !keyConfigured || actions.busy
  const testMode = useWatch({ control: form.control, name: "test_mode" })
  const required = yurticiLoginsRequired(account, testMode)
  const door = doorKept(account, testMode)
  const message = (key: string | undefined) => (key ? t(key, { name }) : undefined)

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit((values) => actions.submit(yurticiSaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      <AccountAlert provider="yurtici" state={state} keyConfigured={keyConfigured} ns={S} />
      <FormSection title={t(`${Y}.keys.title`)} description={t(`${Y}.keys.description`)}>
        <fieldset disabled={locked} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <SecretField
            id="yurtici-username"
            label={t(`${Y}.username`)}
            name={name}
            kept={account?.secrets["username"] === true && !required}
            error={message(errors.username?.message)}
            registration={form.register("username")}
          />
          <SecretField
            id="yurtici-password"
            label={t(`${Y}.password`)}
            name={name}
            kept={account?.secrets["password"] === true && !required}
            error={message(errors.password?.message)}
            registration={form.register("password")}
          />
          {/* Which of Yurtiçi's users this is, and how often it may be asked (V3 document) */}
          <p className="text-[13px] text-muted-foreground sm:col-span-2">{t(`${Y}.keysHint`)}</p>
        </fieldset>
      </FormSection>
      <FormSection title={t(`${Y}.door.title`)} description={t(`${Y}.door.description`)}>
        <fieldset disabled={locked} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <SecretField
            id="yurtici-cod-username"
            label={t(`${Y}.username`)}
            name={name}
            kept={door}
            optional
            hint={t(`${Y}.door.hint`)}
            error={message(errors.cod_username?.message)}
            registration={form.register("cod_username")}
          />
          <SecretField
            id="yurtici-cod-password"
            label={t(`${Y}.password`)}
            name={name}
            kept={door}
            optional
            hint={t(`${Y}.door.hint`)}
            error={message(errors.cod_password?.message)}
            registration={form.register("cod_password")}
          />
          <p className="text-[13px] text-muted-foreground sm:col-span-2">
            {t(`${Y}.door.loginHint`)}
          </p>
        </fieldset>
      </FormSection>
      <FormSection title={t(`${Y}.live.title`)} description={t(`${Y}.live.description`)}>
        <fieldset disabled={locked} className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <label htmlFor="yurtici-test-mode" className="text-sm font-medium">
              {t(`${Y}.testMode`)}
            </label>
            <span id="yurtici-test-mode-hint" className="text-[13px] text-muted-foreground">
              {t(`${Y}.testModeHint`)}
            </span>
          </div>
          <Controller
            control={form.control}
            name="test_mode"
            render={({ field }) => (
              <Switch
                id="yurtici-test-mode"
                aria-describedby="yurtici-test-mode-hint"
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
