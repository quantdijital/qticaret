import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/patterns/section-card"
import type { PaymentLink } from "@/features/payment-links/api/types"
import { shownStatus } from "@/features/payment-links/components/link-state"
import { useCreatorName } from "@/features/payment-links/components/use-creator-name"
import { formatCount, formatDateTime } from "@/lib/format"

const F = "paymentLinks.facts"

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

/**
 * The link's story: who made it and when, how long it opens (and the
 * furthest it can be extended), how often it was opened and sent, the
 * order it became, and the team's note.
 */
export function FactsCard({ link }: { link: PaymentLink }) {
  const { t } = useTranslation()
  const creator = useCreatorName()
  const open = shownStatus(link) === "open"
  return (
    <SectionCard title={t(`${F}.title`)}>
      <dl className="flex flex-col gap-3">
        <Fact label={t(`${F}.created`)}>
          {t(`${F}.createdBy`, {
            who: creator(link.created_by, link.created_by_name),
            date: formatDateTime(link.created_at),
          })}
        </Fact>
        <Fact label={t(open ? `${F}.expires` : `${F}.expired`)}>
          {formatDateTime(link.expires_at)}
          {open ? (
            <span className="block text-xs text-muted-foreground">
              {t(`${F}.cap`, { date: formatDateTime(link.token_ends_at) })}
            </span>
          ) : null}
        </Fact>
        <Fact label={t(`${F}.opened`)}>
          {link.last_opened_at
            ? t(`${F}.openedCount`, {
                count: link.opened_count,
                total: formatCount(link.opened_count),
                date: formatDateTime(link.last_opened_at),
              })
            : t(`${F}.never`)}
        </Fact>
        <Fact label={t(`${F}.sent`)}>
          {link.last_sent_at
            ? t(`${F}.sentCount`, {
                count: link.sent_count,
                total: formatCount(link.sent_count),
                date: formatDateTime(link.last_sent_at),
              })
            : t(`${F}.notSent`)}
        </Fact>
        {link.order_id ? (
          <Fact label={t(`${F}.order`)}>
            <Link
              to="/orders/$id"
              params={{ id: link.order_id }}
              className="font-medium hover:underline"
            >
              {link.paid_at
                ? t(`${F}.paidAt`, { date: formatDateTime(link.paid_at) })
                : t(`${F}.openOrder`)}
            </Link>
          </Fact>
        ) : null}
        {link.status === "canceled" && link.closed_at ? (
          <Fact label={t(`${F}.canceled`)}>
            {link.canceled_by || link.canceled_by_name
              ? t(`${F}.canceledBy`, {
                  who: creator(link.canceled_by ?? "", link.canceled_by_name),
                  date: formatDateTime(link.closed_at),
                })
              : formatDateTime(link.closed_at)}
          </Fact>
        ) : null}
        <Fact label={t(`${F}.note`)}>
          {link.note ? (
            <span className="whitespace-pre-line">{link.note}</span>
          ) : (
            <span className="text-muted-foreground">{t(`${F}.noNote`)}</span>
          )}
        </Fact>
      </dl>
    </SectionCard>
  )
}
