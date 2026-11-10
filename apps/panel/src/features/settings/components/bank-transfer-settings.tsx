import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { useSaveSection } from "@/features/settings/api/sections"
import type { BankTransferSettings } from "@/features/settings/api/sections"
import { formatIban, isValidTrIban, normalizeIban } from "@/features/settings/iban"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const B = "settings.payments.bankTransfer"

const accountSchema = z.object({
  account_holder: z.string().trim().min(1, `${B}.required`).max(140),
  bank_name: z.string().trim().min(1, `${B}.required`).max(80),
  iban: z.string().refine(isValidTrIban, `${B}.ibanInvalid`),
  deadline_hours: z.coerce
    .number<string | number>()
    .int()
    .min(1, `${B}.deadlineInvalid`)
    .max(336, `${B}.deadlineInvalid`),
})
type AccountInput = z.input<typeof accountSchema>
type AccountValues = z.output<typeof accountSchema>

const accountOf = (saved: BankTransferSettings): AccountInput => ({
  account_holder: saved.account_holder,
  bank_name: saved.bank_name,
  iban: formatIban(saved.iban),
  deadline_hours: saved.deadline_hours,
})

/** Whether shoppers are offered it: on only once the account is saved. */
function StatusCard({ saved }: { saved: BankTransferSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<BankTransferSettings>("bank_transfer")
  const ready = saved.iban !== "" && saved.account_holder !== "" && saved.bank_name !== ""
  return (
    <SectionCard title={t(`${B}.status.title`)} description={t(`${B}.status.description`)}>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="bank-transfer-enabled" className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{t(`${B}.status.enabled`)}</span>
          <span className="text-[13px] text-muted-foreground">
            {t(ready ? `${B}.status.enabledHint` : `${B}.status.needsAccount`)}
          </span>
        </label>
        <Switch
          id="bank-transfer-enabled"
          checked={saved.enabled}
          disabled={!ready || save.isPending}
          onCheckedChange={(enabled) => {
            save.mutate(
              { enabled },
              {
                onSuccess: () => toast.success(t("settings.saved")),
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        />
      </div>
    </SectionCard>
  )
}

/** The account's fields; the IBAN is shown in fours once it checks out. */
function AccountFields({ form }: { form: UseFormReturn<AccountInput, unknown, AccountValues> }) {
  const { t } = useTranslation()
  const { errors } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  return (
    <>
      <Field
        label={t(`${B}.holder`)}
        htmlFor="bank-holder"
        required
        error={message(errors.account_holder?.message)}
      >
        <Input id="bank-holder" autoComplete="off" {...form.register("account_holder")} />
      </Field>
      <Field
        label={t(`${B}.bank`)}
        htmlFor="bank-name"
        required
        error={message(errors.bank_name?.message)}
      >
        <Input id="bank-name" autoComplete="off" {...form.register("bank_name")} />
      </Field>
      <Field
        label="IBAN"
        htmlFor="bank-iban"
        required
        hint={t(`${B}.ibanHint`)}
        error={message(errors.iban?.message)}
      >
        <Input
          id="bank-iban"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
          {...form.register("iban", {
            onBlur: (event: { target: { value: string } }) => {
              if (isValidTrIban(event.target.value)) {
                form.setValue("iban", formatIban(event.target.value), { shouldDirty: true })
              }
            },
          })}
        />
      </Field>
      <Field
        label={t(`${B}.deadline`)}
        htmlFor="bank-deadline"
        hint={t(`${B}.deadlineHint`)}
        error={message(errors.deadline_hours?.message)}
      >
        <NumberField
          plain
          id="bank-deadline"
          min={1}
          max={336}
          className="w-40"
          {...form.register("deadline_hours")}
        />
      </Field>
    </>
  )
}

/** The account shoppers send the money to, and how long they have. */
function AccountCard({ saved }: { saved: BankTransferSettings }) {
  const { t } = useTranslation()
  const save = useSaveSection<BankTransferSettings>("bank_transfer")
  const values = accountOf(saved)
  const form = useForm<AccountInput, unknown, AccountValues>({
    resolver: zodResolver(accountSchema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const submit = form.handleSubmit((next) => {
    save.mutate(
      { ...next, iban: normalizeIban(next.iban) },
      {
        onSuccess: (result) => {
          form.reset(accountOf(result.values), FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  return (
    <CardForm
      title={t(`${B}.account.title`)}
      description={t(`${B}.account.description`)}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <AccountFields form={form} />
    </CardForm>
  )
}

/** Settings > Payment > Bank transfer (F6, adr/0029): no provider, the shop's own account. */
export function BankTransferSettingsCards({ saved }: { saved: BankTransferSettings }) {
  return (
    <div className="flex flex-col gap-6">
      <StatusCard saved={saved} />
      <AccountCard saved={saved} />
    </div>
  )
}
