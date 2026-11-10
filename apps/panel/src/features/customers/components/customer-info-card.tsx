import { useQuery } from "@tanstack/react-query"
import { Building2, Mail, MapPin, Pencil, Phone, Plus, ReceiptText, StickyNote } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { useCan } from "@/features/auth/api/staff"
import { customerNoteQuery } from "@/features/customers/api/customer-edit"
import { billingProfileQuery, useRevealTaxId } from "@/features/customers/api/customers"
import type { CustomerDetail } from "@/features/customers/api/customers"
import { CustomerAddressDialog } from "@/features/customers/components/customer-address-dialog"
import { CustomerDialog } from "@/features/customers/components/customer-dialog"
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
function Part({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string
  /** Right of the heading: the part's one change ("Düzenle", "Adres ekle"). */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[15px] leading-6 font-semibold">{title}</h2>
          {hint ? <p className="text-[13px] leading-5 text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Contact({ customer, onEdit }: { customer: CustomerDetail; onEdit?: () => void }) {
  const { t } = useTranslation()
  const note = useQuery(customerNoteQuery(customer.id))
  return (
    <Part
      title={t(`${D}.contact`)}
      action={
        onEdit ? (
          <Button variant="ghost" size="sm" className="-mt-1 -mr-2" onClick={onEdit}>
            <Pencil />
            {t("common.edit")}
          </Button>
        ) : undefined
      }
    >
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
        {note.data?.body ? (
          <Line icon={StickyNote}>
            <span className="whitespace-pre-line text-muted-foreground">{note.data.body}</span>
          </Line>
        ) : null}
      </div>
    </Part>
  )
}

type Address = CustomerDetail["addresses"][number]

function AddressLines({ address }: { address: Address }) {
  return (
    <Line icon={MapPin}>
      {address.address_name ? (
        <span className="block font-medium">{address.address_name}</span>
      ) : null}
      <span className="block">
        {[address.address_1, address.address_2].filter(Boolean).join(" ")}
      </span>
      <span className="block text-muted-foreground">
        {[address.postal_code, [address.city, address.province].filter(Boolean).join(" / ")]
          .filter(Boolean)
          .join(" ")}
      </span>
    </Line>
  )
}

function Addresses({
  customer,
  onOpen,
}: {
  customer: CustomerDetail
  /** Opens an address's window (null: a new one); none for a role that cannot change them. */
  onOpen?: (address: Address | null) => void
}) {
  const { t } = useTranslation()
  const addresses = customer.addresses
  return (
    <Part
      title={t(`${D}.addresses`)}
      action={
        onOpen ? (
          <Button
            variant="ghost"
            size="sm"
            className="-mt-1 -mr-2"
            onClick={() => {
              onOpen(null)
            }}
          >
            <Plus />
            {t("customers.addressForm.add")}
          </Button>
        ) : undefined
      }
    >
      {addresses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(`${D}.noAddresses`)}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {addresses.map((address) => (
            <li key={address.id}>
              {onOpen ? (
                // The address is its own way in: one window to change or delete it
                <button
                  type="button"
                  className="-mx-2 w-[calc(100%+1rem)] rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
                  aria-label={t("customers.addressForm.editTitle")}
                  onClick={() => {
                    onOpen(address)
                  }}
                >
                  <AddressLines address={address} />
                </button>
              ) : (
                <div className="py-1.5">
                  <AddressLines address={address} />
                </div>
              )}
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
  const mayEdit = useCan("customers")
  const [editing, setEditing] = useState(false)
  const [address, setAddress] = useState<{ open: boolean; address: Address | null }>({
    open: false,
    address: null,
  })
  return (
    <>
      <section className="grid min-w-0 grid-cols-1 divide-y rounded-lg border bg-card text-card-foreground shadow-card md:grid-cols-3 md:divide-x md:divide-y-0">
        <Contact
          customer={customer}
          {...(mayEdit
            ? {
                onEdit: () => {
                  setEditing(true)
                },
              }
            : {})}
        />
        <Addresses
          customer={customer}
          {...(mayEdit
            ? {
                onOpen: (picked: Address | null) => {
                  setAddress({ open: true, address: picked })
                },
              }
            : {})}
        />
        <Billing customerId={customer.id} />
      </section>
      {mayEdit ? (
        <>
          <CustomerDialog customer={customer} open={editing} onOpenChange={setEditing} />
          <CustomerAddressDialog
            customer={customer}
            address={address.address}
            open={address.open}
            onOpenChange={(open) => {
              setAddress((current) => ({ ...current, open }))
            }}
          />
        </>
      ) : null}
    </>
  )
}
