import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { PasswordInput } from "@/features/auth/components/password-input"
import { useChangePassword, useRequestEmailChange } from "@/features/settings/api/account"
import { newPasswordIssue } from "@/features/settings/my-account"
import { errorText, isUnauthorized } from "@/lib/errors"
import { isReauthCancelled } from "@/lib/reauth"

const S = "settings.security.signIn"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface DialogProps {
  onClose: () => void
}

/** "Şifreyi değiştir": the current one, the new one twice (the owner, 2026-11-06). */
export function PasswordDialog({ onClose }: DialogProps) {
  const { t } = useTranslation()
  const change = useChangePassword()
  const [values, setValues] = useState({ current: "", next: "", repeat: "" })
  const [shown, setShown] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const issue = newPasswordIssue(values)
  const dirty = values.current !== "" || values.next !== "" || values.repeat !== ""
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues({ ...values, [key]: event.target.value })
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`${S}.passwordTitle`)}
      description={t(`${S}.passwordHint`)}
      size="sm"
      dirty={dirty}
      saving={change.isPending}
      submitLabel={t(`${S}.passwordSave`)}
      onSubmit={() => {
        setShown(true)
        setFailure(null)
        if (values.current === "" || issue) {
          return
        }
        change.mutate(
          { current_password: values.current, new_password: values.next },
          {
            onSuccess: (result) => {
              toast.success(
                t(result.sessions_ended > 0 ? `${S}.passwordChangedOthers` : `${S}.passwordChanged`)
              )
              onClose()
            },
            onError: (error) => {
              if (!isReauthCancelled(error) && !isUnauthorized(error)) {
                setFailure(errorText(t, error))
              }
            },
          }
        )
      }}
    >
      <DialogBody>
        <Field
          label={t(`${S}.currentPassword`)}
          htmlFor="password-current"
          error={shown && values.current === "" ? t(`${S}.currentRequired`) : undefined}
          required
        >
          <PasswordInput
            id="password-current"
            autoComplete="current-password"
            value={values.current}
            onChange={set("current")}
          />
        </Field>
        <Field
          label={t(`${S}.newPassword`)}
          htmlFor="password-new"
          hint={t("invite.passwordHint")}
          error={
            shown && issue && issue !== "mismatch" ? t(`${S}.passwordIssues.${issue}`) : undefined
          }
          required
        >
          <PasswordInput
            id="password-new"
            autoComplete="new-password"
            value={values.next}
            onChange={set("next")}
          />
        </Field>
        <Field
          label={t(`${S}.repeatPassword`)}
          htmlFor="password-repeat"
          error={shown && issue === "mismatch" ? t(`${S}.passwordIssues.mismatch`) : undefined}
          required
        >
          <PasswordInput
            id="password-repeat"
            autoComplete="new-password"
            value={values.repeat}
            onChange={set("repeat")}
          />
        </Field>
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}

/** "E-postayı değiştir": the new address and the current password; a link goes to it. */
export function EmailDialog({ current, onClose }: DialogProps & { current: string }) {
  const { t } = useTranslation()
  const request = useRequestEmailChange()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [shown, setShown] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const address = email.trim().toLocaleLowerCase("en")
  const emailIssue = !EMAIL.test(address)
    ? "invalid"
    : address === current.toLocaleLowerCase("en")
      ? "same"
      : null

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`${S}.emailTitle`)}
      description={t(`${S}.emailHint`)}
      size="sm"
      dirty={email !== "" || password !== ""}
      saving={request.isPending}
      submitLabel={t(`${S}.emailSend`)}
      onSubmit={() => {
        setShown(true)
        setFailure(null)
        if (emailIssue || password === "") {
          return
        }
        request.mutate(
          { email: address, current_password: password },
          {
            onSuccess: () => {
              toast.success(t(`${S}.emailSent`, { email: address }))
              onClose()
            },
            onError: (error) => {
              if (!isReauthCancelled(error) && !isUnauthorized(error)) {
                setFailure(errorText(t, error))
              }
            },
          }
        )
      }}
    >
      <DialogBody>
        <Field
          label={t(`${S}.newEmail`)}
          htmlFor="email-new"
          hint={t(`${S}.currentEmail`, { email: current })}
          error={shown && emailIssue ? t(`${S}.emailIssues.${emailIssue}`) : undefined}
          required
        >
          <Input
            id="email-new"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
            }}
          />
        </Field>
        <Field
          label={t(`${S}.currentPassword`)}
          htmlFor="email-password"
          error={shown && password === "" ? t(`${S}.currentRequired`) : undefined}
          required
        >
          <PasswordInput
            id="email-password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
            }}
          />
        </Field>
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
