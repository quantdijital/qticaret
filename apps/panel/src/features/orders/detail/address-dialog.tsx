import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useUpdateOrderAddress } from "@/features/orders/api/edit"
import type { OrderDetail } from "@/features/orders/api/orders"
import { provincesQuery } from "@/features/tr-address/api"
import { TrAddressFields } from "@/features/tr-address/address-fields"
import { postalCodeFits, trAddressShape } from "@/features/tr-address/schema"
import { errorText } from "@/lib/errors"

const A = "orders.address"

const person = z.string().trim().min(1, `${A}.nameRequired`).max(100, "address.errors.tooLong")
const schema = z.object({ first_name: person, last_name: person, ...trAddressShape })
type AddressForm = z.infer<typeof schema>

/**
 * Where the parcel goes, changed before the order is packed (adr/0033):
 * a Turkish address picked from the reference data, checked again by the
 * server.
 */
export function AddressDialog({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const save = useUpdateOrderAddress(order.id)
  const [failure, setFailure] = useState<string | null>(null)
  const current = order.shipping_address
  const form = useForm<AddressForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: current?.first_name ?? "",
      last_name: current?.last_name ?? "",
      address_1: current?.address_1 ?? "",
      address_2: current?.address_2 ?? "",
      province: current?.province ?? "",
      city: current?.city ?? "",
      postal_code: current?.postal_code ?? "",
      phone: current?.phone ?? "",
    },
  })
  const { errors, isSubmitting } = form.formState
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  const submit = form.handleSubmit(async (values) => {
    setFailure(null)
    try {
      if (!postalCodeFits(values, await client.query(provincesQuery()))) {
        form.setError("postal_code", { message: "address.errors.postalCodeProvince" })
        return
      }
      await save.mutateAsync(values)
      toast.success(t(`${A}.saved`))
      onClose()
    } catch (error) {
      setFailure(errorText(t, error))
    }
  })
  const busy = isSubmitting || save.isPending
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${A}.title`, { number: order.display_id })}</DialogTitle>
          <DialogDescription>{t(`${A}.description`)}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(event) => {
            void submit(event)
          }}
        >
          <DialogBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t(`${A}.firstName`)}
                htmlFor="order-address-first"
                error={message(errors.first_name?.message)}
                required
              >
                <Input id="order-address-first" {...form.register("first_name")} />
              </Field>
              <Field
                label={t(`${A}.lastName`)}
                htmlFor="order-address-last"
                error={message(errors.last_name?.message)}
                required
              >
                <Input id="order-address-last" {...form.register("last_name")} />
              </Field>
            </div>
            <TrAddressFields
              control={form.control}
              idPrefix="order-address"
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
