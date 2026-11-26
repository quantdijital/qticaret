import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { NOT_A_LOGIN } from "@/features/settings/account-actions"
import type { AccountActions } from "@/features/settings/account-actions"
import type { SmtpAccount, SmtpSecurity } from "@/features/settings/api/payments"
import { SecretField } from "@/features/settings/components/account-form"
import { nothingStored } from "@/features/settings/payments"
import { PORT_OF, smtpFormSchema, smtpFormValues, smtpSaveBody } from "@/features/settings/smtp"
import type { SmtpFormValues } from "@/features/settings/smtp"

const S = "settings.notifications.smtp"
const SECURITIES: SmtpSecurity[] = ["starttls", "tls", "none"]

/**
 * The shop's own mail server in one standard dialog (adr/0036 Ek
 * 2026-11-10): the server and its security, the login, the sender, the
 * campaign pace. Saving signs in to the server first; a refusal stays in
 * the dialog, by the buttons. The owner's alone (`accounts`).
 */
export function SmtpDialog({
  account,
  actions,
  name,
  onClose,
}: {
  account: SmtpAccount | undefined
  actions: AccountActions
  name: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const form = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpFormSchema(account)),
    defaultValues: smtpFormValues(account),
  })
  const [confirmRemove, setConfirmRemove] = useState(false)
  const { errors, isDirty } = form.formState
  const stored = !nothingStored(account)
  const message = (key: string | undefined) => (key ? t(key, { name }) : undefined)

  return (
    <>
      <FormDialog
        open
        onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}
        title={t(`${S}.dialogTitle`)}
        description={t(`${S}.dialogDescription`)}
        dirty={isDirty}
        saving={actions.save.isPending}
        submitLabel={t(`${S}.save`)}
        onSubmit={() => {
          void form.handleSubmit(async (values) => {
            if (await actions.submit(smtpSaveBody(values))) {
              onClose()
            }
          })()
        }}
        footerStart={
          stored ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive-text"
              disabled={actions.busy}
              onClick={() => {
                setConfirmRemove(true)
              }}
            >
              {t(`${S}.remove`)}
            </Button>
          ) : null
        }
      >
        <DialogBody>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Field
              label={t(`${S}.host`)}
              htmlFor="smtp-host"
              hint={t(`${S}.hostHint`)}
              error={message(errors.host?.message)}
              required
            >
              <Input
                id="smtp-host"
                placeholder="mail.magaza.com.tr"
                spellCheck={false}
                {...NOT_A_LOGIN}
                {...form.register("host")}
              />
            </Field>
            <Field
              label={t(`${S}.port`)}
              htmlFor="smtp-port"
              error={message(errors.port?.message)}
              required
            >
              <Input
                placeholder={t("settings.placeholders.smtpPort")}
                id="smtp-port"
                inputMode="numeric"
                maxLength={5}
                {...form.register("port")}
              />
            </Field>
          </div>
          <Field
            label={t(`${S}.security`)}
            htmlFor="smtp-security"
            hint={t(`${S}.securityHint`)}
            error={message(errors.security?.message)}
            required
          >
            <Controller
              control={form.control}
              name="security"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    const security = value as SmtpSecurity
                    field.onChange(security)
                    // The port that goes with it, unless the shop typed another
                    if (Number(form.getValues("port")) === PORT_OF[field.value]) {
                      form.setValue("port", String(PORT_OF[security]), { shouldDirty: true })
                    }
                  }}
                >
                  <SelectTrigger id="smtp-security" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECURITIES.map((security) => (
                      <SelectItem key={security} value={security}>
                        {t(`${S}.securities.${security}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t(`${S}.username`)}
              htmlFor="smtp-username"
              hint={t(`${S}.usernameHint`)}
              error={message(errors.username?.message)}
            >
              <Input
                placeholder={t("common.placeholder.email")}
                id="smtp-username"
                spellCheck={false}
                {...NOT_A_LOGIN}
                {...form.register("username")}
              />
            </Field>
            <SecretField
              id="smtp-password"
              label={t(`${S}.password`)}
              name={name}
              kept={stored && account?.secrets["password"] === true}
              optional
              error={message(errors.password?.message)}
              registration={form.register("password")}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t(`${S}.fromEmail`)}
              htmlFor="smtp-from-email"
              hint={t(`${S}.fromEmailHint`)}
              error={message(errors.fromEmail?.message)}
              required
            >
              <Input
                id="smtp-from-email"
                type="email"
                placeholder="bildirim@magaza.com.tr"
                {...NOT_A_LOGIN}
                {...form.register("fromEmail")}
              />
            </Field>
            <Field
              label={t(`${S}.fromName`)}
              htmlFor="smtp-from-name"
              hint={t(`${S}.fromNameHint`)}
              error={message(errors.fromName?.message)}
            >
              <Input
                placeholder={t("settings.placeholders.fromName")}
                id="smtp-from-name"
                maxLength={100}
                {...form.register("fromName")}
              />
            </Field>
          </div>
          <Field
            label={t(`${S}.rate`)}
            htmlFor="smtp-rate"
            hint={t(`${S}.rateHint`)}
            error={message(errors.rate?.message)}
            required
          >
            <Input
              placeholder={t("settings.placeholders.smtpRate")}
              id="smtp-rate"
              inputMode="numeric"
              maxLength={3}
              className="sm:w-32"
              {...form.register("rate")}
            />
          </Field>
          {actions.failure ? (
            <Alert variant="destructive">
              <AlertDescription>{actions.failure}</AlertDescription>
            </Alert>
          ) : null}
        </DialogBody>
      </FormDialog>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t(`${S}.removeTitle`)}
        description={t(`${S}.removeDescription`)}
        confirmLabel={t(`${S}.remove`)}
        destructive
        onConfirm={() => {
          actions.disconnect()
          onClose()
        }}
      />
    </>
  )
}
