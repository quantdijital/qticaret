import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useUpdateOrder } from "@/features/orders/api/edit"
import type { OrderDetail } from "@/features/orders/api/orders"
import { SideForm } from "@/features/products/detail/side-form"
import { provincesQuery } from "@/features/tr-address/api"
import { TrAddressFields } from "@/features/tr-address/address-fields"
import { postalCodeFits, trAddressShape } from "@/features/tr-address/schema"
import { errorText } from "@/lib/errors"

const A = "orders.address"

const person = z.string().trim().min(1, `${A}.nameRequired`).max(100, "address.errors.tooLong")
const schema = z.object({
  first_name: person,
  last_name: person,
  company: z.string().trim().max(200, "address.errors.tooLong"),
  ...trAddressShape,
})
type AddressValues = z.infer<typeof schema>

export type AddressKind = "shipping" | "billing"

/**
 * An order's delivery or billing address, changed in its card (docs/06
 * "Sipariş detay"): the delivery address until the order is packed, the
 * billing address until its invoice is issued (adr/0033). A Turkish
 * address picked from the reference data, checked again by the server;
 * a new billing address starts from the delivery one.
 */
export function AddressForm({
  order,
  kind,
  onClose,
}: {
  order: OrderDetail
  kind: AddressKind
  onClose: () => void
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const save = useUpdateOrder(order.id)
  const [failure, setFailure] = useState<string | null>(null)
  const current =
    kind === "billing" ? (order.billing_address ?? order.shipping_address) : order.shipping_address
  const form = useForm<AddressValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: current?.first_name ?? "",
      last_name: current?.last_name ?? "",
      company: (kind === "billing" ? current?.company : null) ?? "",
      address_1: current?.address_1 ?? "",
      address_2: current?.address_2 ?? "",
      province: current?.province ?? "",
      city: current?.city ?? "",
      postal_code: current?.postal_code ?? "",
      phone: current?.phone ?? "",
    },
  })
  const { errors, isDirty, isSubmitting } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  const submit = form.handleSubmit(async ({ company, ...values }) => {
    setFailure(null)
    try {
      if (!postalCodeFits(values, await client.query(provincesQuery()))) {
        form.setError("postal_code", { message: "address.errors.postalCodeProvince" })
        return
      }
      await save.mutateAsync(
        kind === "billing"
          ? { billing_address: { ...values, company } }
          : { shipping_address: values }
      )
      toast.success(t(`${A}.saved.${kind}`))
      onClose()
    } catch (error) {
      setFailure(errorText(t, error))
    }
  })
  const id = (key: string) => `order-${kind}-${key}`
  return (
    <SideForm
      label={t(`${A}.title.${kind}`)}
      hint={t(`${A}.hint.${kind}`)}
      dirty={isDirty}
      saving={isSubmitting || save.isPending}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <Field
        label={t(`${A}.firstName`)}
        htmlFor={id("first")}
        error={message(errors.first_name?.message)}
        required
      >
        <Input
          placeholder={t("common.placeholder.firstName")}
          id={id("first")}
          {...form.register("first_name")}
        />
      </Field>
      <Field
        label={t(`${A}.lastName`)}
        htmlFor={id("last")}
        error={message(errors.last_name?.message)}
        required
      >
        <Input
          placeholder={t("common.placeholder.lastName")}
          id={id("last")}
          {...form.register("last_name")}
        />
      </Field>
      {kind === "billing" ? (
        <Field
          label={t(`${A}.company`)}
          htmlFor={id("company")}
          error={message(errors.company?.message)}
        >
          <Input
            placeholder={t("common.placeholder.company")}
            id={id("company")}
            maxLength={200}
            {...form.register("company")}
          />
        </Field>
      ) : null}
      <TrAddressFields
        control={form.control}
        idPrefix={`order-${kind}`}
        stacked
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
    </SideForm>
  )
}
