import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import type { WholesaleAccount } from "@/features/wholesale/api/types"
import { ratePercent } from "@/features/wholesale/format"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { AccountBadge } from "./account-badge"

const D = "wholesale.detail"

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Who the wholesaler is and the terms they buy on (their own rate, the minimum). */
export function AccountInfoCard({ account }: { account: WholesaleAccount }) {
  const { t } = useTranslation()
  const none = <span className="text-muted-foreground">—</span>
  return (
    <SectionCard title={t(`${D}.info`)}>
      <Facts
        rows={[
          [t("wholesale.form.email"), account.email ?? none],
          [t("wholesale.form.contact"), account.contact_name ?? none],
          [t("wholesale.form.company"), account.company_name ?? none],
          [
            t(`${D}.customer`),
            account.customer ? (
              <Link
                to="/customers/$id"
                params={{ id: account.customer.id }}
                className="font-medium hover:underline"
              >
                {t(`${D}.openCustomer`)}
              </Link>
            ) : (
              <span className="text-muted-foreground">{t(`${D}.noCustomer`)}</span>
            ),
          ],
          [
            t("wholesale.ownPrices"),
            account.own_prices
              ? account.percent === null
                ? t(`${D}.ownManual`)
                : t(`${D}.ownRate`, { percent: ratePercent(account.percent) })
              : t(`${D}.ownOff`),
          ],
          [
            t("wholesale.form.minimum"),
            account.min_quantity === null
              ? t(`${D}.minimumFromTier`)
              : t("wholesale.units", { count: account.min_quantity }),
          ],
        ]}
      />
    </SectionCard>
  )
}

/** The short facts on the right: the state, the invitation, the level. */
export function AccountStatusCard({ account }: { account: WholesaleAccount }) {
  const { t } = useTranslation()
  const date = (value: string | null) => (value ? formatDate(value) : "—")
  const rows: [string, ReactNode][] = [[t(`${D}.status`), <AccountBadge status={account.status} />]]
  if (account.status === "pending") {
    rows.push(
      [t(`${D}.invitedAt`), date(account.invited_at)],
      [t(`${D}.invitationsSent`), t(`${D}.times`, { count: account.invitations_sent ?? 1 })],
      [t(`${D}.expiresAt`), date(account.invitation_expires_at)]
    )
  } else {
    rows.push([t(`${D}.activatedAt`), date(account.activated_at)])
  }
  if (account.status === "inactive") {
    rows.push([t(`${D}.deactivatedAt`), date(account.deactivated_at)])
  }
  rows.push([
    t(`${D}.tier`),
    account.tier ? (
      <Link
        to="/customers/wholesale/tiers/$id"
        params={{ id: account.tier.id }}
        className="font-medium hover:underline"
      >
        {account.tier.name}
      </Link>
    ) : (
      <span className="text-muted-foreground">{t("wholesale.form.noTier")}</span>
    ),
  ])
  return (
    <SectionCard title={t(`${D}.state`)}>
      <Facts rows={rows} />
    </SectionCard>
  )
}
