import { Mail, MapPin, Phone, UserRound } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import type { OrderDetail } from "@/features/orders/api/orders"

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

/** Who ordered, and how to reach them. */
export function CustomerCard({ order }: { order: OrderDetail }) {
  const { t } = useTranslation()
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
      <div className="flex flex-col gap-2.5">
        <Line icon={UserRound}>{name || t("orders.noName")}</Line>
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
    </SectionCard>
  )
}

/** Where the parcel goes, and the invoice address when it differs. */
export function AddressCard({ order }: { order: OrderDetail }) {
  const { t } = useTranslation()
  const shipping = order.shipping_address ? addressLines(order.shipping_address) : []
  const billing = order.billing_address ? addressLines(order.billing_address) : []
  const sameBilling = billing.join("|") === shipping.join("|")
  return (
    <SectionCard title={t("orders.detail.delivery")}>
      <div className="flex flex-col gap-4">
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
        {billing.length && !sameBilling ? (
          <div className="flex flex-col gap-1.5 border-t pt-4">
            <span className="text-xs font-medium text-muted-foreground">
              {t("orders.detail.billing")}
            </span>
            {billing.map((line) => (
              <span key={line} className="text-sm">
                {line}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </SectionCard>
  )
}
