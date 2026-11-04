import { Mail, MapPin, Pencil, Phone, UserRound } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import type { OrderDetail } from "@/features/orders/api/orders"
import { AddressDialog } from "./address-dialog"

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

function Line({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <p className="flex min-w-0 items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

/** Where the parcel goes, and the invoice address when it differs. */
function Addresses({ order, onEdit }: { order: OrderDetail; onEdit: (() => void) | null }) {
  const { t } = useTranslation()
  const shipping = order.shipping_address ? addressLines(order.shipping_address) : []
  const billing = order.billing_address ? addressLines(order.billing_address) : []
  const sameBilling = billing.join("|") === shipping.join("|")
  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-col gap-2">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("orders.detail.delivery")}
          </h3>
          {onEdit ? (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil />
              {t("orders.address.edit")}
            </Button>
          ) : null}
        </div>
        {shipping.length ? (
          <Line icon={MapPin}>
            {shipping.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </Line>
        ) : (
          <p className="text-sm text-muted-foreground">{t("orders.detail.noAddress")}</p>
        )}
      </div>
      {billing.length && !sameBilling ? (
        <div className="flex flex-col gap-1.5 border-t pt-4">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("orders.detail.billing")}
          </h3>
          {billing.map((line) => (
            <span key={line} className="text-sm">
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Who ordered, how to reach them and where the parcel goes, in one card
 * (docs/06 "Detay sayfası düzeni": the side column). The delivery address
 * changes while nothing is packed (adr/0033); the name opens the
 * customer's page.
 */
export function CustomerCard({
  order,
  editable = false,
}: {
  order: OrderDetail
  editable?: boolean
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const customer = order.customer
  const name =
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    [order.shipping_address?.first_name, order.shipping_address?.last_name]
      .filter(Boolean)
      .join(" ")
  const phone = customer?.phone ?? order.shipping_address?.phone
  const email = order.email ?? customer?.email
  return (
    <SectionCard title={t("orders.detail.customer")}>
      {editing ? (
        <AddressDialog
          order={order}
          onClose={() => {
            setEditing(false)
          }}
        />
      ) : null}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5">
          <Line icon={UserRound}>
            {customer?.id ? (
              <Link
                to="/customers/$id"
                params={{ id: customer.id }}
                className="font-medium hover:underline"
              >
                {name || t("orders.noName")}
              </Link>
            ) : (
              name || t("orders.noName")
            )}
          </Line>
          {email ? (
            <Line icon={Mail}>
              <a href={`mailto:${email}`} className="hover:underline">
                {email}
              </a>
            </Line>
          ) : null}
          {phone ? (
            <Line icon={Phone}>
              <a href={`tel:${phone}`} className="tabular-nums hover:underline">
                {phone}
              </a>
            </Line>
          ) : null}
        </div>
        <Addresses
          order={order}
          onEdit={
            editable
              ? () => {
                  setEditing(true)
                }
              : null
          }
        />
      </div>
    </SectionCard>
  )
}
