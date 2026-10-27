import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
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
import {
  paytrFormSchema,
  paytrFormValues,
  paytrSaveBody,
  secretsRequired,
} from "@/features/settings/payments"
import type { PaytrFormValues } from "@/features/settings/payments"
import { errorText } from "@/lib/errors"

const STATE_TONES: Record<AccountState, StatusTone> = {
  connected: "success",
  unverified: "warning",
  rejected: "danger",
  unreadable: "danger",
  not_configured: "neutral",
}

const P = "settings.payments.paytr"

/** A check's outcome as a toast: what happened and what to do next, for a save or a test. */
function announce(t: (key: string) => string, check: AccountCheck | null, source: "save" | "test") {
  if (check === null || check === "valid") {
    toast.success(t(check === "valid" ? `${P}.checks.valid` : "settings.saved"))
  } else if (check === "unreachable") {
    toast.warning(t(source === "save" ? `${P}.checks.unreachable` : `${P}.checks.unreachableTest`))
  } else {
    toast.error(t(`${P}.checks.${check}`))
  }
}

// Password managers must not offer to keep or fill these: they are the shop's, not a login
const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": "",
  "data-lpignore": "true",
  "data-bwignore": "",
} as const

/**
 * Settings > Payment, PayTR (adr/0027): the shop's merchant number, key and
 * salt. The key and salt are written, never shown again; left blank they
 * stay as stored. PayTR is asked before anything is saved. The page
 * remounts the card when the stored account changes (`paytrCardKey`), so
 * the secrets typed for a save never linger after it.
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
  const form = useForm<PaytrFormValues>({
    resolver: zodResolver(paytrFormSchema(account)),
    defaultValues: paytrFormValues(account),
  })
  const { errors, isDirty } = form.formState
  const state = account?.state ?? "not_configured"
  const stored = state !== "not_configured"
  const busy = save.isPending || check.isPending || remove.isPending
  // A new shop number asks for both secrets again, as the server does
  const merchantId = useWatch({ control: form.control, name: "merchant_id" })
  const required = secretsRequired(account, merchantId)
  const message = (key: string | undefined) => (key ? t(key) : undefined)

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
      announce(t, answer.check, "save")
    } catch (error) {
      setFailure(errorText(t, error))
    }
  })

  return (
    <SectionCard
      title={t(`${P}.title`)}
      description={t(`${P}.description`)}
      action={
        <>
          {account?.settings?.test_mode ? (
            <StatusBadge tone="info">{t(`${P}.testModeBadge`)}</StatusBadge>
          ) : null}
          <StatusBadge tone={STATE_TONES[state]}>{t(`${P}.states.${state}`)}</StatusBadge>
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
            <AlertDescription>{t(`${P}.keyMissing`)}</AlertDescription>
          </Alert>
        ) : state === "unreadable" || state === "rejected" ? (
          <Alert>
            <AlertDescription>{t(`${P}.${state}`)}</AlertDescription>
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
            label={t(`${P}.merchantId`)}
            htmlFor="paytr-merchant-id"
            hint={t(`${P}.merchantIdHint`)}
            required
            error={message(errors.merchant_id?.message)}
          >
            <Input
              id="paytr-merchant-id"
              inputMode="numeric"
              {...NOT_A_LOGIN}
              {...form.register("merchant_id", {
                onChange: () => {
                  if (form.formState.isSubmitted) {
                    void form.trigger(["merchant_key", "merchant_salt"])
                  }
                },
              })}
            />
          </Field>
          <div className="flex items-start justify-between gap-4 rounded-md border px-4 py-3 md:mt-7">
            <div className="flex min-w-0 flex-col gap-0.5">
              <label htmlFor="paytr-test-mode" className="text-sm font-medium">
                {t(`${P}.testMode`)}
              </label>
              <span id="paytr-test-mode-hint" className="text-[13px] text-muted-foreground">
                {t(`${P}.testModeHint`)}
              </span>
            </div>
            <Controller
              control={form.control}
              name="test_mode"
              render={({ field }) => (
                <Switch
                  id="paytr-test-mode"
                  aria-describedby="paytr-test-mode-hint"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
          {(["merchant_key", "merchant_salt"] as const).map((name) => {
            const kept = account?.secrets[name] === true && !required
            return (
              <Field
                key={name}
                label={t(`${P}.${name}`)}
                htmlFor={`paytr-${name}`}
                hint={kept ? t(`${P}.secretStored`) : t(`${P}.secretHint`)}
                required={!kept}
                error={message(errors[name]?.message)}
              >
                <Input
                  id={`paytr-${name}`}
                  type="password"
                  spellCheck={false}
                  placeholder={kept ? "••••••••••••" : ""}
                  {...NOT_A_LOGIN}
                  {...form.register(name)}
                />
              </Field>
            )
          })}
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
                {t(`${P}.remove`)}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || isDirty || state === "unreadable"}
                onClick={() => {
                  void settle(check.mutateAsync(), (answer) => {
                    announce(t, answer.check, "test")
                  })
                }}
              >
                {check.isPending ? <Loader2 className="animate-spin" /> : null}
                {t(`${P}.test`)}
              </Button>
            </>
          ) : null}
          <Button type="submit" size="sm" disabled={!keyConfigured || busy || (stored && !isDirty)}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {t(`${P}.save`)}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t(`${P}.removeTitle`)}
        description={t(`${P}.removeDescription`)}
        confirmLabel={t(`${P}.remove`)}
        destructive
        onConfirm={() => {
          void settle(remove.mutateAsync(), () => {
            toast.success(t(`${P}.removed`))
          })
        }}
      />
    </SectionCard>
  )
}
