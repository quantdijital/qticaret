import { Loader2 } from "lucide-react"
import { useState } from "react"
import type { UseFormRegisterReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { NOT_A_LOGIN } from "@/features/settings/account-actions"
import type { AccountActions } from "@/features/settings/account-actions"
import type { AccountState } from "@/features/settings/api/payments"

/**
 * What every provider's page shows alike (adr/0027): the state alert, the
 * write-only secret field, and the save / test / disconnect buttons
 * (`useAccountActions`). The provider's own fields and steps stay on its page.
 */

const A = "settings.payments.account"

/** Why nothing can be saved, or why the stored account no longer works. */
export function AccountAlert({
  provider,
  state,
  keyConfigured,
  ns = "settings.payments",
}: {
  provider: string
  state: AccountState
  keyConfigured: boolean
  /** Where the provider's own texts live (payment or shipping settings). */
  ns?: string
}) {
  const { t } = useTranslation()
  if (!keyConfigured) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t(`${A}.keyMissing`)}</AlertDescription>
      </Alert>
    )
  }
  if (state === "unreadable" || state === "rejected") {
    return (
      <Alert>
        <AlertDescription>
          {state === "unreadable" ? t(`${A}.unreadable`) : t(`${ns}.${provider}.rejected`)}
        </AlertDescription>
      </Alert>
    )
  }
  return null
}

/** A secret: written, never shown again; left blank, the stored one stays (`kept`). */
export function SecretField({
  id,
  label,
  name,
  kept,
  error,
  registration,
  optional = false,
  hint,
  example,
}: {
  id: string
  label: string
  /** The provider's name, for the hint. */
  name: string
  kept: boolean
  error: string | undefined
  registration: UseFormRegisterReturn
  /** A secret the shop may leave blank (a second account it may not have). */
  optional?: boolean
  /** Shown in place of the usual hint while nothing is stored. */
  hint?: string
  /** An example of the value while nothing is stored (a customer number's shape); none for a password. */
  example?: string
}) {
  const { t } = useTranslation()
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={kept ? t(`${A}.secretStored`) : (hint ?? t(`${A}.secretHint`, { name }))}
      required={!kept && !optional}
      error={error}
    >
      <Input
        id={id}
        type="password"
        spellCheck={false}
        placeholder={kept ? "••••••••••••" : (example ?? "")}
        {...NOT_A_LOGIN}
        {...registration}
      />
    </Field>
  )
}

/** Under the sections: a refused save, then disconnect, test and save. */
export function AccountFooter({
  actions,
  name,
  state,
  dirty,
  keyConfigured,
}: {
  actions: AccountActions
  name: string
  state: AccountState
  dirty: boolean
  keyConfigured: boolean
}) {
  const { t } = useTranslation()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const stored = state !== "not_configured"
  const { busy } = actions
  return (
    <>
      {/* Next to the buttons: a refused save is read where it was asked for */}
      {actions.failure ? (
        <Alert variant="destructive">
          <AlertDescription>{actions.failure}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-5">
        {stored ? (
          <>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive-text sm:mr-auto"
              disabled={busy}
              onClick={() => {
                setConfirmRemove(true)
              }}
            >
              {t(`${A}.remove`)}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || dirty || state === "unreadable"}
              onClick={actions.test}
            >
              {actions.check.isPending ? <Loader2 className="animate-spin" /> : null}
              {t(`${A}.test`)}
            </Button>
          </>
        ) : null}
        <Button type="submit" disabled={!keyConfigured || busy || (stored && !dirty)}>
          {actions.save.isPending ? <Loader2 className="animate-spin" /> : null}
          {t(`${A}.save`)}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t(`${A}.removeTitle`, { name })}
        description={t(`${A}.removeDescription`, { name })}
        confirmLabel={t(`${A}.remove`)}
        destructive
        onConfirm={actions.disconnect}
      />
    </>
  )
}
