import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { DialogBody, DialogSection } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { editSchema, editValuesOf, updateBodyOf } from "@/features/wholesale/account-form"
import type { EditValues } from "@/features/wholesale/account-form"
import { useUpdateAccount } from "@/features/wholesale/api/accounts"
import type { WholesaleAccount } from "@/features/wholesale/api/types"
import { errorText } from "@/lib/errors"
import { PriceSourceFields } from "./price-source-fields"

const F = "wholesale.form"

/**
 * A wholesaler changed (ADR-0068 §3): the company and contact (the
 * customer record's once bound), the level, the own list opened and its
 * rate, the minimum. The address and the tax details are not here: the
 * address is the sign-in, the tax details the customer's invoice identity.
 */
export function AccountEditDialog({
  account,
  open,
  onOpenChange,
}: {
  account: WholesaleAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const update = useUpdateAccount(account.id)
  const [failure, setFailure] = useState<string | null>(null)
  const before = editValuesOf(account)
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: before,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isDirty, isSubmitting } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  const submit = form.handleSubmit(async (values) => {
    setFailure(null)
    const body = updateBodyOf(values, before)
    if (Object.keys(body).length === 0) {
      onOpenChange(false)
      return
    }
    try {
      await update.mutateAsync(body)
      toast.success(t(`${F}.saved`))
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
          form.reset()
          setFailure(null)
        }
        onOpenChange(next)
      }}
      title={t(`${F}.editTitle`)}
      description={account.email ?? undefined}
      pane
      dirty={isDirty}
      saving={isSubmitting || update.isPending}
      onSubmit={() => {
        void submit()
      }}
    >
      <FormProvider {...form}>
        <DialogBody>
          <DialogSection title={t(`${F}.who`)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t(`${F}.contact`)}
                htmlFor="wholesale-edit-contact"
                error={message(errors.contact_name?.message)}
              >
                <Input
                  id="wholesale-edit-contact"
                  autoComplete="off"
                  {...form.register("contact_name")}
                />
              </Field>
              <Field
                label={t(`${F}.company`)}
                htmlFor="wholesale-edit-company"
                error={message(errors.company_name?.message)}
              >
                <Input
                  id="wholesale-edit-company"
                  autoComplete="off"
                  {...form.register("company_name")}
                />
              </Field>
            </div>
          </DialogSection>
          <DialogSection title={t(`${F}.prices`)}>
            <PriceSourceFields ownLocked={account.own_prices} />
          </DialogSection>
          {failure ? (
            <p role="alert" className="text-sm text-destructive-text">
              {failure}
            </p>
          ) : null}
        </DialogBody>
      </FormProvider>
    </FormDialog>
  )
}
