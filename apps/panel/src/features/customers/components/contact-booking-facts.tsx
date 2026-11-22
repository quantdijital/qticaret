import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { formatDateTime, formatLongDate } from "@qticaret/admin-ui/lib/format"
import type { ContactMessage } from "@/features/customers/api/contact-messages"

const M = "customers.contactMessages"

/** One line of the message dialog's facts. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

const monthText = (month: string): string =>
  new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`)
  )

/**
 * When a booking request is for: the departure (its time, while it
 * exists), a day, a month, or open dates.
 */
function useWhen(message: ContactMessage): string {
  const { t } = useTranslation()
  const details = message.details
  if (message.slot_starts_at) {
    return formatDateTime(message.slot_starts_at)
  }
  if (details?.date) {
    return formatLongDate(`${details.date}T12:00:00Z`)
  }
  if (details?.month) {
    return monthText(details.month)
  }
  return t(`${M}.detail.flexible`)
}

/**
 * A booking request's own facts in the message dialog (adr/0076 Ek
 * 2026-11-23): the product (opens it), when, and how many people. Nothing
 * for any other message.
 */
export function ContactBookingFacts({ message }: { message: ContactMessage }) {
  const { t } = useTranslation()
  const when = useWhen(message)
  const details = message.details
  if (message.subject !== "booking" || !details) {
    return null
  }
  const people = [
    t(`${M}.detail.adults`, { count: details.adults }),
    ...(details.children ? [t(`${M}.detail.children`, { count: details.children })] : []),
  ].join(", ")
  return (
    <>
      <Fact label={t(`${M}.detail.product`)}>
        {message.product_id ? (
          <Link
            to="/products/$id"
            params={{ id: message.product_id }}
            className="text-primary-text hover:underline"
          >
            {message.product_title ?? message.product_id}
          </Link>
        ) : (
          "—"
        )}
      </Fact>
      <Fact label={t(`${M}.detail.when`)}>{when}</Fact>
      <Fact label={t(`${M}.detail.people`)}>{people}</Fact>
    </>
  )
}
