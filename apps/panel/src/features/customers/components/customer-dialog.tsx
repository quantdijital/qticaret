import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import {
  createCustomer,
  customerNoteQuery,
  useSaveCustomer,
} from "@/features/customers/api/customer-edit"
import type { CustomerDetail } from "@/features/customers/api/customers"
import { customerConsentsQuery } from "@/features/customers/api/customers"
import { customerFieldsOf, customerSchema } from "@/features/customers/customer-form"
import type { CustomerForm } from "@/features/customers/customer-form"
import { errorText } from "@/lib/errors"

const F = "customers.form"

/** The customer's message permissions, as they gave them: shown, never set here. */
function ConsentLines({ customerId }: { customerId: string | null }) {
  const { t } = useTranslation()
  const consents = useQuery({
    ...customerConsentsQuery(customerId ?? ""),
    enabled: customerId !== null,
  })
  const state = (channel: "email" | "sms") => {
    const consent = consents.data?.[channel].consent
    return t(consent?.status === "granted" ? `${F}.consentGranted` : `${F}.consentNone`)
  }
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/40 px-4 py-3 text-[13px]">
      <span className="font-medium">{t(`${F}.consentTitle`)}</span>
      {customerId ? (
        <span className="text-muted-foreground">
          {t(`${F}.consentState`, { email: state("email"), sms: state("sms") })}
        </span>
      ) : null}
      <span className="text-muted-foreground">{t(`${F}.consentHint`)}</span>
    </div>
  )
}

const blank: CustomerForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company_name: "",
  note: "",
}

/**
 * One window for a customer (2026-11-06): name, e-mail, phone, company and
 * the team's note. New, it adds a guest (no account, no invitation). A
 * member's e-mail is their sign-in: shown, not editable. Message consent is
 * the person's own: shown, never set here.
 */
export function CustomerDialog({
  customer,
  open,
  onOpenChange,
}: {
  /** Null: "Yeni müşteri". */
  customer: CustomerDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const note = useQuery({ ...customerNoteQuery(customer?.id ?? ""), enabled: customer !== null })
  const save = useSaveCustomer(customer?.id ?? "")
  const [failure, setFailure] = useState<string | null>(null)
  const guest = !customer?.has_account
  const form = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    values: customer
      ? {
          first_name: customer.first_name ?? "",
          last_name: customer.last_name ?? "",
          email: customer.email,
          phone: customer.phone ?? "",
          company_name: customer.company_name ?? "",
          note: note.data?.body ?? "",
        }
      : blank,
    resetOptions: { keepDirtyValues: true },
  })
  const { errors, isDirty, isSubmitting, dirtyFields } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  const submit = form.handleSubmit(async (values) => {
    setFailure(null)
    try {
      if (!customer) {
        const fields = customerFieldsOf(values, true)
        const { customer: made } = await createCustomer({ ...fields, email: values.email.trim() })
        toast.success(t(`${F}.created`))
        onOpenChange(false)
        void navigate({ to: "/customers/$id", params: { id: made.id } })
        return
      }
      const { note: noteChanged, ...rest } = dirtyFields
      await save.mutateAsync({
        ...(Object.keys(rest).length > 0 ? { fields: customerFieldsOf(values, guest) } : {}),
        ...(noteChanged ? { note: values.note.trim() } : {}),
      })
      toast.success(t(`${F}.saved`))
      onOpenChange(false)
    } catch (error) {
      setFailure(errorText(t, error))
    }
  })
  const id = (key: string) => `customer-${key}`
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
      title={t(customer ? `${F}.editTitle` : `${F}.newTitle`)}
      description={t(customer ? `${F}.editText` : `${F}.newText`)}
      dirty={isDirty}
      saving={isSubmitting || save.isPending}
      onSubmit={() => {
        void submit()
      }}
      submitLabel={customer ? t("common.save") : t(`${F}.create`)}
    >
      <DialogBody>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t(`${F}.firstName`)}
            htmlFor={id("first")}
            error={message(errors.first_name?.message)}
          >
            <Input id={id("first")} autoComplete="off" {...form.register("first_name")} />
          </Field>
          <Field
            label={t(`${F}.lastName`)}
            htmlFor={id("last")}
            error={message(errors.last_name?.message)}
          >
            <Input id={id("last")} autoComplete="off" {...form.register("last_name")} />
          </Field>
          <Field
            label={t(`${F}.email`)}
            htmlFor={id("email")}
            error={message(errors.email?.message)}
            hint={guest ? undefined : t(`${F}.emailIsLogin`)}
            required={guest}
          >
            <Input
              id={id("email")}
              type="email"
              autoComplete="off"
              readOnly={!guest}
              aria-readonly={!guest}
              className={guest ? undefined : "bg-muted text-muted-foreground"}
              {...form.register("email")}
            />
          </Field>
          <Field
            label={t(`${F}.phone`)}
            htmlFor={id("phone")}
            error={message(errors.phone?.message)}
            hint={t(`${F}.phoneHint`)}
          >
            <Input id={id("phone")} type="tel" autoComplete="off" {...form.register("phone")} />
          </Field>
          <Field
            label={t(`${F}.company`)}
            htmlFor={id("company")}
            error={message(errors.company_name?.message)}
            className="sm:col-span-2"
          >
            <Input id={id("company")} autoComplete="off" {...form.register("company_name")} />
          </Field>
          {customer ? (
            <Field
              label={t(`${F}.note`)}
              htmlFor={id("note")}
              error={message(errors.note?.message)}
              hint={t(`${F}.noteHint`)}
              className="sm:col-span-2"
            >
              <Textarea id={id("note")} rows={3} maxLength={2000} {...form.register("note")} />
            </Field>
          ) : null}
        </div>
        <ConsentLines customerId={customer?.id ?? null} />
        {failure ? (
          <p role="alert" className="text-sm text-destructive-text">
            {failure}
          </p>
        ) : null}
      </DialogBody>
    </FormDialog>
  )
}
