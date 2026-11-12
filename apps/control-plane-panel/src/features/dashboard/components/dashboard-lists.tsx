import { Link } from "@tanstack/react-router"
import { GitBranch } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { formatDate, formatRelative } from "@qticaret/admin-ui/lib/format"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { EmptyState } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { money } from "@/features/billing/words"
import type { AttentionRow, Dashboard, DuePayment, ListedShop } from "@/features/dashboard/api"

type Part = "subscription" | "usage"

/** A shop's name as a link to its page's tab; its id when the record is gone. */
function ShopLink({ shop, part }: { shop: ListedShop; part: Part }) {
  return (
    <Link
      to="/tenants/$id"
      params={{ id: shop.id }}
      search={{ part }}
      className="truncate font-medium hover:underline"
    >
      {shop.name ?? shop.id}
    </Link>
  )
}

/** One row: the shop and a line under it, a value on the right. */
function Row({ title, line, end }: { title: ReactNode; line: ReactNode; end?: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col">
        {title}
        <span className="truncate text-xs text-muted-foreground">{line}</span>
      </div>
      {end ? <div className="flex shrink-0 items-center gap-2 tabular-nums">{end}</div> : null}
    </li>
  )
}

function SeeAll({ view }: { view: "overdue" | "upcoming" }) {
  const { t } = useTranslation()
  return (
    <Link to="/payments" search={{ view }} className="text-sm font-medium hover:underline">
      {view === "overdue" ? t("dashboard.overdue.all") : t("dashboard.renewals.all")}
    </Link>
  )
}

function Payments({ rows, empty }: { rows: DuePayment[]; empty: string }) {
  const { t } = useTranslation()
  if (rows.length === 0) {
    return <EmptyState text={empty} />
  }
  return (
    <ul className="flex flex-col divide-y">
      {rows.map((row) => (
        <Row
          key={`${row.tenant.id}-${row.due_on}-${row.charge_id ?? "next"}`}
          title={<ShopLink shop={row.tenant} part="subscription" />}
          line={formatDate(row.due_on)}
          end={
            <>
              {row.projected ? (
                <StatusBadge tone="neutral">{t("dashboard.renewals.projected")}</StatusBadge>
              ) : null}
              <span className="text-sm">{money(row.amount)}</span>
            </>
          }
        />
      ))}
    </ul>
  )
}

/** The oldest overdue payments, as the payments screen's "Geciken" list has them. */
export function OverdueCard({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  return (
    <SectionCard
      title={t("dashboard.overdue.title")}
      description={t("dashboard.overdue.text")}
      action={<SeeAll view="overdue" />}
      className="h-full"
    >
      <Payments rows={data.overdue.oldest} empty={t("dashboard.overdue.empty")} />
    </SectionCard>
  )
}

/** The next payments in the renewal window: open charges and periods whose charge opens later. */
export function RenewalsCard({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const days = data.renewals.days
  return (
    <SectionCard
      title={t("dashboard.renewals.title")}
      description={t("dashboard.renewals.text", { days })}
      action={<SeeAll view="upcoming" />}
      className="h-full"
    >
      <Payments rows={data.renewals.next} empty={t("dashboard.renewals.empty", { days })} />
    </SectionCard>
  )
}

function attentionLine(t: ReturnType<typeof useTranslation>["t"], row: AttentionRow) {
  const since = formatRelative(row.since)
  return row.problem === "unhealthy"
    ? t("dashboard.attention.unhealthy", {
        target: t(`health.targets.${row.target ?? "backend"}`),
        since,
      })
    : t("dashboard.attention.stale", { since })
}

/** Unhealthy shops, then silent ones; the count of shops off their target release. */
export function AttentionCard({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const { shops, stale_after_hours: hours, drift } = data.health
  return (
    <SectionCard
      title={t("dashboard.attention.title")}
      description={t("dashboard.attention.text", { hours })}
      className="h-full"
    >
      <div className="flex flex-1 flex-col gap-4">
        {shops.length === 0 ? (
          <EmptyState text={t("dashboard.attention.empty")} />
        ) : (
          <ul className="flex flex-col divide-y">
            {shops.map((row) => (
              <Row
                key={`${row.tenant.id}-${row.problem}`}
                title={<ShopLink shop={row.tenant} part="usage" />}
                line={attentionLine(t, row)}
                end={
                  <StatusBadge tone={row.problem === "unhealthy" ? "danger" : "warning"}>
                    {row.problem === "unhealthy"
                      ? t("health.state.unhealthy")
                      : t("dashboard.attention.staleBadge")}
                  </StatusBadge>
                }
              />
            ))}
          </ul>
        )}
        {drift > 0 ? (
          <p className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4 text-sm">
            <GitBranch className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>{t("dashboard.attention.drift", { count: drift })}</span>
            <Link to="/releases" className="font-medium hover:underline">
              {t("dashboard.attention.driftLink")}
            </Link>
          </p>
        ) : null}
      </div>
    </SectionCard>
  )
}
