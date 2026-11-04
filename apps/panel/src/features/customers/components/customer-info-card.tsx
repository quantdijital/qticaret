import { useQuery } from "@tanstack/react-query"
import { Building2, Mail, MapPin, Phone, ReceiptText } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/features/auth/api/staff"
import { billingProfileQuery, useRevealTaxId } from "@/features/customers/api/customers"
import type { CustomerDetail } from "@/features/customers/api/customers"
import { errorText } from "@/lib/errors"

const D = "customers.detail"

function Line({ icon: Icon, children }: { icon: typeof Mail; children: ReactNode }) {
  return (
    <p className="flex min-w-0 items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  )
}

/** One of the card's three parts: its heading, a line under it when needed, its lines. */
function Part({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 px-5 py-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] leading-6 font-semibold">{title}</h2>
        {hint ? <p className="text-[13px] leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

function Contact({ customer }: { customer: CustomerDetail }) {
  const { t } = useTranslation()
  return (
    <Part title={t(`${D}.contact`)}>
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
    </Part>
  )
}

function Addresses({ customer }: { customer: CustomerDetail }) {
  const { t } = useTranslation()
  const addresses = customer.addresses
  return (
    <Part title={t(`${D}.addresses`)}>
      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(`${D}.noAddresses`)}</p>
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
    </Part>
  )
}

function Billing({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const query = useQuery(billingProfileQuery(customerId))
  const profile = query.data?.billing_profile
  const mayReveal = useCan("taxId")
  const reveal = useRevealTaxId(customerId)
  return (
    <Part title={t(`${D}.billing`)} hint={t(`${D}.billingHint`)}>
      {query.isPending ? (
        <Skeleton className="h-16" />
      ) : profile ? (
        <Line icon={ReceiptText}>
          <span className="block font-medium">{profile.legal_name}</span>
          <span className="block text-muted-foreground">
            {t(`customers.billing.${profile.type}`)} · {profile.tax_id_kind.toUpperCase()}{" "}
            <span className="font-mono">{reveal.data?.tax_id ?? profile.tax_id_masked}</span>
            {mayReveal ? (
              <Button
                variant="link"
                size="sm"
                className="ml-2 h-auto px-0"
                disabled={reveal.isPending}
                onClick={() => {
                  if (reveal.data) {
                    reveal.reset()
                  } else {
                    reveal.mutate(undefined, {
                      onError: (failure) => toast.error(errorText(t, failure)),
                    })
                  }
                }}
              >
                {t(reveal.data ? "customers.billing.hide" : "customers.billing.reveal")}
              </Button>
            ) : null}
          </span>
          {profile.tax_office ? (
            <span className="block text-muted-foreground">
              {t("customers.billing.taxOffice", { office: profile.tax_office })}
            </span>
          ) : null}
        </Line>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${D}.noBilling`)}</p>
      )}
    </Part>
  )
}

/**
 * How to reach and bill the customer, in one card of three parts side by
 * side (docs/06 "Detay sayfası düzeni"): contact, saved addresses, billing
 * details with the tax number masked until a permitted role reveals it.
 */
export function CustomerInfoCard({ customer }: { customer: CustomerDetail }) {
  return (
    <section className="grid min-w-0 grid-cols-1 divide-y rounded-lg border bg-card text-card-foreground shadow-card md:grid-cols-3 md:divide-x md:divide-y-0">
      <Contact customer={customer} />
      <Addresses customer={customer} />
      <Billing customerId={customer.id} />
    </section>
  )
}
