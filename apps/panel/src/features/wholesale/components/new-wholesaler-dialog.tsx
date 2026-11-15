import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useState } from "react"
import { Controller, FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { accountSchema, blankAccount, createBodyOf } from "@/features/wholesale/account-form"
import type { AccountValues } from "@/features/wholesale/account-form"
import { UNPROVEN_SIGNUP, useCreateAccount } from "@/features/wholesale/api/accounts"
import { rememberOutcome } from "@/features/wholesale/outcome"
import { errorText } from "@/lib/errors"
import { PasswordField } from "./password-field"
import { PriceSourceFields } from "./price-source-fields"

const F = "wholesale.form"

const codeOf = (error: unknown) => (error as { code?: unknown } | null)?.code

/**
 * A new wholesaler (ADR-0068 §3, Ek 2026-11-15 (2)): the address, the
 * contact, optionally the company and its tax details, the password staff
 * hand over, then where the prices come from. Active at once; no mail
 * goes. An address with an unconfirmed sign-up is refused first, and
 * staff may take it over (its password replaced, its sign-ins ended).
 * What happened is said on the new wholesaler's page.
 */
export function NewWholesalerDialog({
  open,
  onOpenChange,
  lead,
  initialFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Above the fields: "Yeni müşteri"'s Bireysel / Toptancı choice. */
  lead?: ReactNode
  initialFocus?: string | null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const create = useCreateAccount()
  const [failure, setFailure] = useState<string | null>(null)
  // The address had an unconfirmed sign-up: the values to send again with `take_over`
  const [takeOver, setTakeOver] = useState<AccountValues | null>(null)
  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: blankAccount,
  })
  const { errors, isDirty, isSubmitting } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  const send = async (values: AccountValues, takingOver: boolean) => {
    setFailure(null)
    try {
      const made = await create.mutateAsync({
        ...createBodyOf(values),
        ...(takingOver ? { take_over: true } : {}),
      })
      rememberOutcome(made, values.tax_id.trim() !== "")
      form.reset(blankAccount)
      onOpenChange(false)
      void navigate({ to: "/customers/wholesale/$id", params: { id: made.account.id } })
    } catch (error) {
      if (!takingOver && codeOf(error) === UNPROVEN_SIGNUP) {
        setTakeOver(values)
        return
      }
      setFailure(errorText(t, error))
    }
  }
  const submit = form.handleSubmit((values) => send(values, false))
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset(blankAccount)
          setFailure(null)
        }
        onOpenChange(next)
      }}
      title={t(`${F}.newTitle`)}
      description={t(`${F}.newText`)}
      pane
      dirty={isDirty}
      saving={isSubmitting || create.isPending}
      initialFocus={initialFocus ?? null}
      onSubmit={() => {
        void submit()
      }}
      submitLabel={t(`${F}.create`)}
    >
      <FormProvider {...form}>
        <DialogBody>
          {lead}
          <DialogSection title={t(`${F}.who`)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t(`${F}.email`)}
                htmlFor="wholesale-email"
                hint={t(`${F}.emailHint`)}
                error={message(errors.email?.message)}
                required
                className="sm:col-span-2"
              >
                <Input
                  id="wholesale-email"
                  type="email"
                  autoComplete="off"
                  {...form.register("email")}
                />
              </Field>
              <Field
                label={t(`${F}.contact`)}
                htmlFor="wholesale-contact"
                error={message(errors.contact_name?.message)}
                required
              >
                <Input
                  id="wholesale-contact"
                  autoComplete="off"
                  {...form.register("contact_name")}
                />
              </Field>
              <Field
                label={t(`${F}.company`)}
                htmlFor="wholesale-company"
                error={message(errors.company_name?.message)}
              >
                <Input
                  id="wholesale-company"
                  autoComplete="off"
                  {...form.register("company_name")}
                />
              </Field>
              <Field
                label={t(`${F}.taxOffice`)}
                htmlFor="wholesale-tax-office"
                error={message(errors.tax_office?.message)}
              >
                <Input
                  id="wholesale-tax-office"
                  autoComplete="off"
                  {...form.register("tax_office")}
                />
              </Field>
              <Field
                label={t(`${F}.taxId`)}
                htmlFor="wholesale-tax-id"
                hint={t(`${F}.taxHint`)}
                error={message(errors.tax_id?.message)}
              >
                <Input
                  id="wholesale-tax-id"
                  inputMode="numeric"
                  autoComplete="off"
                  {...form.register("tax_id")}
                />
              </Field>
            </div>
          </DialogSection>
          <DialogSection title={t(`${F}.signIn`)}>
            <Field
              label={t(`${F}.password`)}
              htmlFor="wholesale-password"
              hint={t(`${F}.passwordHint`)}
              error={message(errors.password?.message)}
              required
            >
              <Controller
                control={form.control}
                name="password"
                render={({ field }) => (
                  <PasswordField
                    id="wholesale-password"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={errors.password ? true : undefined}
                  />
                )}
              />
            </Field>
          </DialogSection>
          <DialogSection title={t(`${F}.prices`)}>
            <PriceSourceFields />
          </DialogSection>
          {failure ? (
            <p role="alert" className="text-sm text-destructive-text">
              {failure}
            </p>
          ) : null}
        </DialogBody>
      </FormProvider>
      <ConfirmDialog
        open={takeOver !== null}
        onOpenChange={(next) => {
          if (!next) {
            setTakeOver(null)
          }
        }}
        title={t(`${F}.takeOverTitle`)}
        description={t(`${F}.takeOverText`)}
        confirmLabel={t(`${F}.takeOver`)}
        destructive
        onConfirm={() => {
          if (takeOver) {
            void send(takeOver, true)
          }
          setTakeOver(null)
        }}
      />
    </FormDialog>
  )
}
