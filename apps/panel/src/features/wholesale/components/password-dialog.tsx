import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { passwordSchema } from "@/features/wholesale/account-form"
import type { PasswordValues } from "@/features/wholesale/account-form"
import { useSetAccountPassword } from "@/features/wholesale/api/accounts"
import type { WholesaleAccount } from "@/features/wholesale/api/types"
import { errorText } from "@/lib/errors"
import { PasswordField } from "./password-field"

const P = "wholesale.password"
const BLANK: PasswordValues = { password: "" }

/**
 * A wholesaler's new password (ADR-0068 Ek 2026-11-15 (2)): typed or made
 * here, shown in this window only, to be handed over. Their open
 * sign-ins end; the storefront's own "şifremi unuttum" stays open to them.
 */
export function PasswordDialog({
  account,
  open,
  onOpenChange,
}: {
  account: WholesaleAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const set = useSetAccountPassword(account.id)
  const [failure, setFailure] = useState<string | null>(null)
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: BLANK,
  })
  const { errors, isDirty, isSubmitting } = form.formState
  const submit = form.handleSubmit(async ({ password }) => {
    setFailure(null)
    try {
      await set.mutateAsync(password)
      toast.success(t(`${P}.saved`))
      form.reset(BLANK)
      onOpenChange(false)
    } catch (error) {
      setFailure(errorText(t, error))
    }
  })
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset(BLANK)
          setFailure(null)
        }
        onOpenChange(next)
      }}
      title={t(`${P}.title`)}
      description={account.email ?? undefined}
      dirty={isDirty}
      saving={isSubmitting || set.isPending}
      onSubmit={() => {
        void submit()
      }}
      submitLabel={t(`${P}.save`)}
    >
      <DialogBody>
        <Field
          label={t("wholesale.form.password")}
          htmlFor="wholesale-new-password"
          hint={t(`${P}.hint`)}
          error={errors.password?.message ? t(errors.password.message) : undefined}
          required
        >
          <Controller
            control={form.control}
            name="password"
            render={({ field }) => (
              <PasswordField
                id="wholesale-new-password"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={errors.password ? true : undefined}
              />
            )}
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
