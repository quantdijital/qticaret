import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useSaveCustomerAddress } from "@/features/customers/api/customer-edit"
import type { CustomerDetail } from "@/features/customers/api/customers"
import { provincesQuery } from "@/features/tr-address/api"
import { TrAddressFields } from "@/features/tr-address/address-fields"
import { postalCodeFits, trAddressShape } from "@/features/tr-address/schema"
import { errorText } from "@/lib/errors"

const A = "customers.addressForm"

const person = z.string().trim().min(1, `${A}.nameRequired`).max(100, "address.errors.tooLong")
const schema = z.object({
  address_name: z.string().trim().max(60, "address.errors.tooLong"),
  first_name: person,
  last_name: person,
  ...trAddressShape,
})
type AddressForm = z.infer<typeof schema>

type Address = NonNullable<CustomerDetail["addresses"]>[number]

/**
 * A customer's saved address added, changed or deleted (2026-11-06), in
 * one window: a Turkish address picked from the reference data (il, ilçe,
 * mahalle), checked again by the server.
 */
export function CustomerAddressDialog({
  customer,
  address,
  open,
  onOpenChange,
}: {
  customer: CustomerDetail
  /** Null: a new address. */
  address: Address | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const save = useSaveCustomerAddress(customer.id)
  const [failure, setFailure] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const form = useForm<AddressForm>({
    resolver: zodResolver(schema),
    values: {
      address_name: address?.address_name ?? "",
      first_name: address?.first_name ?? customer.first_name ?? "",
      last_name: address?.last_name ?? customer.last_name ?? "",
      address_1: address?.address_1 ?? "",
      address_2: address?.address_2 ?? "",
      province: address?.province ?? "",
      city: address?.city ?? "",
      postal_code: address?.postal_code ?? "",
      phone: address?.phone ?? customer.phone ?? "",
    },
  })
  const { errors, isDirty, isSubmitting } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  const close = () => {
    form.reset()
    setFailure(null)
    onOpenChange(false)
  }
  const submit = form.handleSubmit(async (values) => {
    setFailure(null)
    try {
      if (!postalCodeFits(values, await client.query(provincesQuery()))) {
        form.setError("postal_code", { message: "address.errors.postalCodeProvince" })
        return
      }
      await save.mutateAsync({
        ...(address ? { addressId: address.id } : {}),
        fields: {
          ...values,
          address_name: values.address_name.trim() || null,
          country_code: "tr",
        },
      })
      toast.success(t(address ? `${A}.saved` : `${A}.added`))
      close()
    } catch (error) {
      setFailure(errorText(t, error))
    }
  })
  const remove = () => {
    if (!address) {
      return
    }
    save.mutate(
      { addressId: address.id, remove: true },
      {
        onSuccess: () => {
          toast.success(t(`${A}.deleted`))
          close()
        },
        onError: (error) => {
          setFailure(errorText(t, error))
        },
      }
    )
  }
  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            onOpenChange(true)
          } else {
            close()
          }
        }}
        title={t(address ? `${A}.editTitle` : `${A}.newTitle`)}
        description={t(`${A}.text`)}
        dirty={isDirty}
        saving={isSubmitting || save.isPending}
        onSubmit={() => {
          void submit()
        }}
        footerStart={
          address ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive-text"
              disabled={save.isPending}
              onClick={() => {
                setConfirming(true)
              }}
            >
              <Trash2 />
              {t(`${A}.delete`)}
            </Button>
          ) : undefined
        }
      >
        <DialogBody>
          <Field
            label={t(`${A}.name`)}
            htmlFor="customer-address-name"
            hint={t(`${A}.nameHint`)}
            error={message(errors.address_name?.message)}
          >
            <Input id="customer-address-name" maxLength={60} {...form.register("address_name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t(`${A}.firstName`)}
              htmlFor="customer-address-first"
              error={message(errors.first_name?.message)}
              required
            >
              <Input id="customer-address-first" {...form.register("first_name")} />
            </Field>
            <Field
              label={t(`${A}.lastName`)}
              htmlFor="customer-address-last"
              error={message(errors.last_name?.message)}
              required
            >
              <Input id="customer-address-last" {...form.register("last_name")} />
            </Field>
          </div>
          <TrAddressFields
            control={form.control}
            idPrefix="customer-address"
            errors={{
              address_1: message(errors.address_1?.message),
              address_2: message(errors.address_2?.message),
              province: message(errors.province?.message),
              city: message(errors.city?.message),
              postal_code: message(errors.postal_code?.message),
              phone: message(errors.phone?.message),
            }}
          />
          {failure ? (
            <p role="alert" className="text-sm text-destructive-text">
              {failure}
            </p>
          ) : null}
        </DialogBody>
      </FormDialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(`${A}.deleteTitle`)}
        description={t(`${A}.deleteText`)}
        confirmLabel={t(`${A}.delete`)}
        destructive
        onConfirm={remove}
      />
    </>
  )
}
