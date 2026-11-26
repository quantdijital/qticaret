import { useQuery } from "@tanstack/react-query"
import { MapPin, Pencil } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { orderStateQuery } from "@/features/orders/api/orders"
import type { OrderDetail } from "@/features/orders/api/orders"
import { AddressForm } from "./address-form"
import type { AddressKind } from "./address-form"

type Address = NonNullable<OrderDetail["shipping_address"]>

/** A Turkish address as it is written on a parcel: street, then postcode ilçe / il. */
function addressLines(address: Address): string[] {
  const place = [address.city, address.province].filter(Boolean).join(" / ")
  return [
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.company ?? "",
    [address.address_1, address.address_2].filter(Boolean).join(" "),
    [address.postal_code, place].filter(Boolean).join(" "),
  ].filter((line) => line.trim() !== "")
}

/**
 * Whether the invoice provider holds the order's buyer (issued or issuing,
 * or a waiting invoice it already took): its billing address stays. The
 * server's own rule (`billing_locked`), the one its order update refuses
 * by; locked until it is known.
 */
function useBillingLocked(orderId: string): boolean {
  const state = useQuery(orderStateQuery(orderId))
  return state.data?.billing_locked !== false
}

function Section({
  title,
  editLabel,
  onEdit,
  first = false,
  children,
}: {
  title: string
  editLabel: string
  onEdit: (() => void) | null
  first?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className={first ? "flex flex-col gap-2" : "flex flex-col gap-2 border-t pt-4"}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {onEdit ? (
          <Button size="sm" variant="outline" aria-label={editLabel} onClick={onEdit}>
            <Pencil />
            {t("orders.address.edit")}
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function Lines({ lines }: { lines: string[] }) {
  return (
    <p className="flex min-w-0 items-start gap-2.5 text-sm">
      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 break-words">
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </span>
    </p>
  )
}

/**
 * Where the parcel goes and where the invoice is made out to, each
 * changed in place (docs/06 "Sipariş detay"): the delivery address until
 * the order is packed (`shippingEditable`), the billing address until the
 * invoice provider holds it.
 */
export function AddressSections({
  order,
  shippingEditable,
  editing,
  onEditing,
}: {
  order: OrderDetail
  shippingEditable: boolean
  /** What of the card is open: one part at a time (the e-mail is the card's own). */
  editing: AddressKind | "email" | null
  onEditing: (kind: AddressKind | null) => void
}) {
  const { t } = useTranslation()
  const invoiced = useBillingLocked(order.id)
  const shipping = order.shipping_address ? addressLines(order.shipping_address) : []
  const billing = order.billing_address ? addressLines(order.billing_address) : []
  const sameBilling = billing.length === 0 || billing.join("|") === shipping.join("|")
  const open = order.status !== "canceled"
  const billingEditable = open && !invoiced && (billing.length > 0 || shipping.length > 0)
  const edit = (kind: AddressKind, can: boolean) =>
    can && editing === null
      ? () => {
          onEditing(kind)
        }
      : null
  const close = () => {
    onEditing(null)
  }
  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <Section
        first
        title={t("orders.detail.delivery")}
        editLabel={t("orders.address.editOf.shipping")}
        onEdit={edit("shipping", shippingEditable)}
      >
        {editing === "shipping" ? (
          <AddressForm order={order} kind="shipping" onClose={close} />
        ) : shipping.length ? (
          <Lines lines={shipping} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("orders.detail.noAddress")}</p>
        )}
      </Section>
      {billing.length || billingEditable ? (
        <Section
          title={t("orders.detail.billing")}
          editLabel={t("orders.address.editOf.billing")}
          onEdit={edit("billing", billingEditable)}
        >
          {editing === "billing" ? (
            <AddressForm order={order} kind="billing" onClose={close} />
          ) : sameBilling ? (
            <p className="text-sm text-muted-foreground">{t("orders.address.sameAsDelivery")}</p>
          ) : (
            <Lines lines={billing} />
          )}
          {invoiced && open && editing !== "billing" ? (
            <p className="text-xs text-muted-foreground">{t("orders.address.invoiced")}</p>
          ) : null}
        </Section>
      ) : null}
    </div>
  )
}
