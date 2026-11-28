import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { FormSection } from "@qticaret/admin-ui/patterns/form-section"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import type { SuratAccount } from "@/features/settings/api/payments"
import { useAccountActions } from "@/features/settings/account-actions"
import {
  AccountAlert,
  AccountFooter,
  SecretField,
} from "@/features/settings/components/account-form"
import {
  cariKept,
  suratFormSchema,
  suratFormValues,
  suratLoginRequired,
  suratSaveBody,
} from "@/features/settings/surat"
import type { SuratFormValues } from "@/features/settings/surat"

const S = "settings.shipping"
const K = `${S}.surat`

/**
 * Settings > Shipping > Sürat Kargo (docs/entegrasyonlar/surat.md), in the
 * order the shop sets it up: the web service login that opens parcels,
 * with whose label prints, then the cari kodu and web password when Sürat
 * gave a separate pair. Sürat has no test service: no test mode.
 * The tracking login is checked with Sürat before anything is saved.
 */
export function SuratSettings({
  account,
  keyConfigured,
}: {
  account: SuratAccount | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const name = t(`${S}.carriers.surat.name`)
  const actions = useAccountActions("surat", name, S)
  const form = useForm<SuratFormValues>({
    resolver: zodResolver(suratFormSchema(account)),
    defaultValues: suratFormValues(),
  })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const locked = !keyConfigured || actions.busy
  const required = suratLoginRequired(account)
  const cari = cariKept(account)
  const message = (key: string | undefined) => (key ? t(key, { name }) : undefined)

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit((values) => actions.submit(suratSaveBody(values)))()
      }}
    >
      <LeaveGuard when={isDirty && !actions.save.isPending} />
      <AccountAlert provider="surat" state={state} keyConfigured={keyConfigured} ns={S} />
      <FormSection title={t(`${K}.keys.title`)} description={t(`${K}.keys.description`)}>
        <fieldset disabled={locked} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <SecretField
            id="surat-username"
            label={t(`${K}.username`)}
            name={name}
            kept={account?.secrets["username"] === true && !required}
            example={t(`${K}.usernamePlaceholder`)}
            error={message(errors.username?.message)}
            registration={form.register("username")}
          />
          <SecretField
            id="surat-password"
            label={t(`${K}.password`)}
            name={name}
            kept={account?.secrets["password"] === true && !required}
            error={message(errors.password?.message)}
            registration={form.register("password")}
          />
          <p className="text-[13px] text-muted-foreground sm:col-span-2">{t(`${K}.keysHint`)}</p>
          {/* Sürat seldom grants labels: whose label prints, and what the branch must scan */}
          <p className="text-[13px] text-muted-foreground sm:col-span-2">{t(`${K}.labelHint`)}</p>
        </fieldset>
      </FormSection>
      <FormSection title={t(`${K}.cari.title`)} description={t(`${K}.cari.description`)}>
        <fieldset disabled={locked} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <SecretField
            id="surat-cari-code"
            label={t(`${K}.cariCode`)}
            name={name}
            kept={cari}
            optional
            hint={t(`${K}.cari.hint`)}
            example={t(`${K}.cariCodePlaceholder`)}
            error={message(errors.cari_code?.message)}
            registration={form.register("cari_code")}
          />
          <SecretField
            id="surat-web-password"
            label={t(`${K}.webPassword`)}
            name={name}
            kept={cari}
            optional
            hint={t(`${K}.cari.hint`)}
            error={message(errors.web_password?.message)}
            registration={form.register("web_password")}
          />
          <p className="text-[13px] text-muted-foreground sm:col-span-2">{t(`${K}.cariHint`)}</p>
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
