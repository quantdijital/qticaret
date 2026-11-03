import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import type { PaymentLink } from "@/features/payment-links/api/types"
import { formatPhone } from "@/lib/format"

const C = "paymentLinks.detail"

function Line({ children }: { children: ReactNode }) {
  return <p className="text-sm break-words">{children}</p>
}

/**
 * Who the link is for and where it goes, side by side and of one height;
 * the contact in full here (the page is a recorded read).
 */
export function PeopleCards({ link }: { link: PaymentLink }) {
  const { t } = useTranslation()
  const { contact, address } = link
  return (
    <div className="grid items-stretch gap-[var(--grid-gap)] md:grid-cols-2">
      <SectionCard
        title={t(`${C}.contact`)}
        action={
          link.customer.id ? (
            <Link
              to="/customers/$id"
              params={{ id: link.customer.id }}
              className="text-[13px] text-muted-foreground hover:text-foreground hover:underline"
            >
              {t(`${C}.openCustomer`)}
            </Link>
          ) : (
            <span className="text-[13px] text-muted-foreground">{t(`${C}.guest`)}</span>
          )
        }
      >
        {contact ? (
          <div className="flex flex-col gap-1">
            <Line>{`${contact.first_name} ${contact.last_name}`.trim()}</Line>
            <Line>{contact.email}</Line>
            {contact.phone ? <Line>{formatPhone(contact.phone)}</Line> : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t(`${C}.erased`)}</p>
        )}
      </SectionCard>
      <SectionCard title={t(`${C}.address`)}>
        {address ? (
          <div className="flex flex-col gap-1">
            <Line>{`${address.first_name} ${address.last_name}`.trim()}</Line>
            <Line>{[address.address_2, address.address_1].filter(Boolean).join(", ")}</Line>
            <Line>
              {[address.postal_code, `${address.city} / ${address.province}`]
                .filter(Boolean)
                .join(" ")}
            </Line>
            {address.phone ? <Line>{formatPhone(address.phone)}</Line> : null}
            <p className="pt-1 text-xs text-muted-foreground">
              {t(link.shipping_option_id ? `${C}.shippingSet` : `${C}.shippingOpen`)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t(`${C}.noAddress`)}</p>
        )}
      </SectionCard>
    </div>
  )
}
