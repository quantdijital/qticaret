import { useQuery } from "@tanstack/react-query"
import { Link, getRouteApi } from "@tanstack/react-router"
import { Building2, Mail, MapPin, Phone, ReceiptText } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { AsyncBody } from "@/components/patterns/async-body"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { billingProfileQuery, customerQuery } from "@/features/customers/api/customers"
import type { CustomerDetail } from "@/features/customers/api/customers"
import { customerName } from "@/features/customers/names"
import { GIFT_CARDS_FLAG } from "@/features/gift-cards/api/gift-cards"
import { StoreCreditCard } from "@/features/gift-cards/components/store-credit-card"
import { StageBadge } from "@/features/orders/components/stage-badge"
import { orderBoardQuery } from "@/features/orders/api/orders"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { formatDate, formatMoney } from "@/lib/format"

const route = getRouteApi("/_auth/customers/$id")

function Line({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <p className="flex min-w-0 items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

function OrdersCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  // The order board's own stage rule, so the stages here match the order list
  const query = useQuery(orderBoardQuery({ stage: "all", q: "", page: 0, customerId }))
  return (
    <SectionCard title={t("customers.detail.orders")} flush>
      <AsyncBody query={query} skeleton={<Skeleton className="mx-5 mb-5 h-40" />}>
        {(data) =>
          data.orders.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              {t("customers.detail.noOrders")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {data.orders.map((order) => (
                <li key={order.id} className="border-t">
                  <Link
                    to="/orders/$id"
                    params={{ id: order.id }}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/60"
                  >
                    <span className="w-16 font-medium tabular-nums">#{order.display_id}</span>
                    <span className="flex-1 text-sm text-muted-foreground">
                      {formatDate(order.created_at)}
                    </span>
                    <StageBadge stage={order.stage} />
                    <span className="w-28 text-right text-sm font-medium tabular-nums">
                      {formatMoney(order.total, order.currency_code)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncBody>
    </SectionCard>
  )
}

function ContactCard({ customer }: { customer: CustomerDetail }) {
  const { t } = useTranslation()
  return (
    <SectionCard title={t("customers.detail.contact")}>
      <div className="flex flex-col gap-2.5">
        <Line icon={Mail}>
          <a href={`mailto:${customer.email}`} className="hover:underline">
            {customer.email}
          </a>
        </Line>
        {customer.phone ? (
          <Line icon={Phone}>
            <a href={`tel:${customer.phone}`} className="tabular-nums hover:underline">
              {customer.phone}
            </a>
          </Line>
        ) : null}
        {customer.company_name ? <Line icon={Building2}>{customer.company_name}</Line> : null}
      </div>
    </SectionCard>
  )
}

function AddressesCard({ customer }: { customer: CustomerDetail }) {
  const { t } = useTranslation()
  const addresses = customer.addresses
  return (
    <SectionCard title={t("customers.detail.addresses")}>
      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("customers.detail.noAddresses")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {addresses.map((address) => (
            <li key={address.id}>
              <Line icon={MapPin}>
                {address.address_name ? (
                  <span className="block font-medium">{address.address_name}</span>
                ) : null}
                <span className="block">
                  {[address.address_1, address.address_2].filter(Boolean).join(" ")}
                </span>
                <span className="block text-muted-foreground">
                  {[
                    address.postal_code,
                    [address.city, address.province].filter(Boolean).join(" / "),
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </span>
              </Line>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function BillingCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const query = useQuery(billingProfileQuery(customerId))
  const profile = query.data?.billing_profile
  return (
    <SectionCard
      title={t("customers.detail.billing")}
      description={t("customers.detail.billingHint")}
    >
      {query.isPending ? (
        <Skeleton className="h-16" />
      ) : profile ? (
        <div className="flex flex-col gap-2.5">
          <Line icon={ReceiptText}>
            <span className="block font-medium">{profile.legal_name}</span>
            <span className="block text-muted-foreground">
              {t(`customers.billing.${profile.type}`)} · {profile.tax_id_kind.toUpperCase()}{" "}
              <span className="font-mono">{profile.tax_id_masked}</span>
            </span>
            {profile.tax_office ? (
              <span className="block text-muted-foreground">
                {t("customers.billing.taxOffice", { office: profile.tax_office })}
              </span>
            ) : null}
          </Line>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("customers.detail.noBilling")}</p>
      )}
    </SectionCard>
  )
}

/** One customer (docs/06 §4): their orders on the left, how to reach and bill them on the right. */
export function CustomerDetailPage() {
  const { t } = useTranslation()
  const storeCredit = useFeature(GIFT_CARDS_FLAG)
  const { id } = route.useParams()
  const query = useQuery(customerQuery(id))
  const customer = query.data
  const back = { to: "/customers", label: t("nav.customers") }

  if (query.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("customers.detail.title")} back={back} />
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      </div>
    )
  }
  if (!customer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t("common.loading")} back={back} />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={customerName(customer) ?? customer.email}
        description={
          customer.created_at
            ? t("customers.detail.since", { date: formatDate(customer.created_at) })
            : undefined
        }
        badge={
          <StatusBadge tone={customer.has_account ? "info" : "neutral"}>
            {t(customer.has_account ? "customers.kind.registered" : "customers.kind.guest")}
          </StatusBadge>
        }
        back={back}
      />
      <div className="grid items-start gap-[var(--grid-gap)] xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-[var(--grid-gap)] xl:col-span-8">
          <OrdersCard customerId={customer.id} />
        </div>
        <div className="flex min-w-0 flex-col gap-[var(--grid-gap)] xl:col-span-4">
          <ContactCard customer={customer} />
          <AddressesCard customer={customer} />
          <BillingCard customerId={customer.id} />
          {/* Store credit is for members: a guest cannot sign in to spend it */}
          {storeCredit && customer.has_account ? (
            <StoreCreditCard customerId={customer.id} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
