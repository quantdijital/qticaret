import { ListOrdered, Mail, Pencil, Phone, UserRound } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { OrderDetail } from "@/features/orders/api/orders"
import { AddressSections } from "./address-sections"
import type { AddressKind } from "./address-form"
import { EmailForm } from "./email-form"

function Line({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <p className="flex min-w-0 items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

/**
 * Who ordered, how to reach them and where the parcel goes, in one card
 * (docs/06 "Detay sayfası düzeni": the side column). Each part changes in
 * place, one at a time: the e-mail while the order is open, the delivery
 * address while nothing is packed (adr/0033, `editable`), the billing
 * address until its invoice. The name opens the customer's page, and a
 * link under it their other orders.
 */
export function CustomerCard({
  order,
  editable = false,
}: {
  order: OrderDetail
  editable?: boolean
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<AddressKind | "email" | null>(null)
  const customer = order.customer
  const name =
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    [order.shipping_address?.first_name, order.shipping_address?.last_name]
      .filter(Boolean)
      .join(" ")
  const phone = customer?.phone ?? order.shipping_address?.phone
  const email = order.email ?? customer?.email
  const emailEditable = order.status !== "canceled" && editing === null
  return (
    <SectionCard title={t("orders.detail.customer")}>
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
          {editing === "email" ? (
            <EmailForm
              orderId={order.id}
              email={email ?? ""}
              onClose={() => {
                setEditing(null)
              }}
            />
          ) : email || emailEditable ? (
            <div className="flex min-w-0 items-start justify-between gap-2">
              <Line icon={Mail}>
                {email ? (
                  <a href={`mailto:${email}`} className="hover:underline">
                    {email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{t("orders.address.noEmail")}</span>
                )}
              </Line>
              {emailEditable ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="-mt-1 shrink-0"
                  aria-label={t("orders.address.editEmail")}
                  title={t("orders.address.editEmail")}
                  onClick={() => {
                    setEditing("email")
                  }}
                >
                  <Pencil />
                </Button>
              ) : null}
            </div>
          ) : null}
          {phone ? (
            <Line icon={Phone}>
              <a href={`tel:${phone}`} className="tabular-nums hover:underline">
                {phone}
              </a>
            </Line>
          ) : null}
          {customer?.id ? (
            <Line icon={ListOrdered}>
              <Link
                to="/orders"
                search={{ customer: customer.id }}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                {t("orders.filters.customerOrders")}
              </Link>
            </Line>
          ) : null}
        </div>
        <AddressSections
          order={order}
          shippingEditable={editable}
          editing={editing}
          onEditing={(kind) => {
            setEditing(kind)
          }}
        />
      </div>
    </SectionCard>
  )
}
