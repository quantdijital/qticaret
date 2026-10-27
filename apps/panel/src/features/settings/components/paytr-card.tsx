import { Loader2 } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { Field } from "@/components/patterns/form-section"
import { LeaveGuard } from "@/components/patterns/leave-guard"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useCheckPaytr, useRemovePaytr, useSavePaytr } from "@/features/settings/api/payments"
import type { AccountCheck, AccountState, ProviderAccount } from "@/features/settings/api/payments"
import { paytrFormValues, paytrSaveBody, secretsRequired } from "@/features/settings/payments"
import type { PaytrFormValues } from "@/features/settings/payments"
import { errorText } from "@/lib/errors"

const STATE_TONES: Record<AccountState, StatusTone> = {
  connected: "success",
  unverified: "warning",
  unreadable: "danger",
  not_configured: "neutral",
}

/** A check's outcome as a toast: what happened and what to do next. */
function announce(t: (key: string) => string, check: AccountCheck | null) {
  const p = "settings.payments.paytr.checks"
  if (check === null || check === "valid") {
    toast.success(t(check === "valid" ? `${p}.valid` : "settings.saved"))
  } else if (check === "unreachable") {
    toast.warning(t(`${p}.unreachable`))
  } else {
    toast.error(t(`${p}.${check}`))
  }
}

/**
 * Settings > Payment, PayTR (adr/0027): the shop's merchant number, key and
 * salt. The key and salt are written, never shown again; left blank they
 * stay as stored. PayTR is asked before anything is saved.
 */
export function PaytrCard({
  account,
  keyConfigured,
}: {
  account: ProviderAccount | undefined
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const save = useSavePaytr()
  const check = useCheckPaytr()
  const remove = useRemovePaytr()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  // The page remounts the card when the stored account changes (`paytrCardKey`), so
  // the form starts from it and the secrets typed for a save never linger after it
  const form = useForm<PaytrFormValues>({ defaultValues: paytrFormValues(account) })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const stored = state !== "not_configured"
  const busy = save.isPending || check.isPending || remove.isPending
  const p = "settings.payments.paytr"
  const needSecret = (value: string) =>
    value.trim() !== "" || !secretsRequired(account, form.getValues("merchant_id"))

  // Awaited, not `mutate` callbacks: the card remounts once the stored account
  // changes, and a callback of the unmounted card would never run
  async function settle<T>(run: Promise<T>, done: (answer: T) => void) {
    try {
      done(await run)
    } catch (error) {
      toast.error(errorText(t, error))
    }
  }

  const submit = form.handleSubmit(async (next) => {
    setFailure(null)
    try {
      const answer = await save.mutateAsync(paytrSaveBody(next))
      announce(t, answer.check)
    } catch (error) {
      setFailure(errorText(t, error))
    }
  })

  return (
    <SectionCard
      title={t(`${p}.title`)}
      description={t(`${p}.description`)}
      action={
        <>
          {account?.settings?.test_mode ? (
            <StatusBadge tone="info">{t(`${p}.testModeBadge`)}</StatusBadge>
          ) : null}
          <StatusBadge tone={STATE_TONES[state]}>{t(`${p}.states.${state}`)}</StatusBadge>
        </>
      }
    >
      <LeaveGuard when={isDirty && !save.isPending} />
      <form
        noValidate
        className="flex flex-1 flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {!keyConfigured ? (
          <Alert variant="destructive">
            <AlertDescription>{t(`${p}.keyMissing`)}</AlertDescription>
          </Alert>
        ) : state === "unreadable" ? (
          <Alert>
            <AlertDescription>{t(`${p}.unreadable`)}</AlertDescription>
          </Alert>
        ) : null}
        {failure ? (
          <Alert variant="destructive">
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        ) : null}
        {/* Account and mode on the first row, the two secrets on the second */}
        <fieldset
          disabled={!keyConfigured || busy}
          className="grid items-start gap-5 md:grid-cols-2"
        >
          <Field
            label={t(`${p}.merchantId`)}
            htmlFor="paytr-merchant-id"
            hint={t(`${p}.merchantIdHint`)}
            required
            error={errors.merchant_id ? t(`${p}.merchantIdInvalid`) : undefined}
          >
            <Input
              id="paytr-merchant-id"
              inputMode="numeric"
              autoComplete="off"
              {...form.register("merchant_id", { pattern: /^\s*\d{1,20}\s*$/, required: true })}
            />
          </Field>
          <div className="flex items-start justify-between gap-4 rounded-md border px-4 py-3 md:mt-7">
            <label htmlFor="paytr-test-mode" className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{t(`${p}.testMode`)}</span>
              <span className="text-[13px] text-muted-foreground">{t(`${p}.testModeHint`)}</span>
            </label>
            <Controller
              control={form.control}
              name="test_mode"
              render={({ field }) => (
                <Switch
                  id="paytr-test-mode"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
          {(["merchant_key", "merchant_salt"] as const).map((name) => (
            <Field
              key={name}
              label={t(`${p}.${name}`)}
              htmlFor={`paytr-${name}`}
              hint={account?.secrets[name] ? t(`${p}.secretStored`) : t(`${p}.secretHint`)}
              required={!account?.secrets[name]}
              error={errors[name] ? t(`${p}.secretRequired`) : undefined}
            >
              <Input
                id={`paytr-${name}`}
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                placeholder={account?.secrets[name] ? "••••••••••••" : ""}
                {...form.register(name, { validate: needSecret })}
              />
            </Field>
          ))}
        </fieldset>
        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          {stored ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive-text sm:mr-auto"
                disabled={busy}
                onClick={() => {
                  setConfirmRemove(true)
                }}
              >
                {t(`${p}.remove`)}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || isDirty || state === "unreadable"}
                onClick={() => {
                  void settle(check.mutateAsync(), (answer) => {
                    announce(t, answer.check)
                  })
                }}
              >
                {check.isPending ? <Loader2 className="animate-spin" /> : null}
                {t(`${p}.test`)}
              </Button>
            </>
          ) : null}
          <Button type="submit" size="sm" disabled={!keyConfigured || busy || (stored && !isDirty)}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {t(`${p}.save`)}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t(`${p}.removeTitle`)}
        description={t(`${p}.removeDescription`)}
        confirmLabel={t(`${p}.remove`)}
        destructive
        onConfirm={() => {
          void settle(remove.mutateAsync(), () => {
            toast.success(t(`${p}.removed`))
          })
        }}
      />
    </SectionCard>
  )
}
