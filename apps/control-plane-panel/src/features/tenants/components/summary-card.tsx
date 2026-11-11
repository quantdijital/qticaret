import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { formatDate } from "@qticaret/admin-ui/lib/format"
import { priceText } from "@/features/packages/format"
import type { TenantDetail } from "@/features/tenants/api"
import { TenantStatusBadge } from "./tenant-status"

/**
 * The shop's short facts in the right column (docs/06): where it stands,
 * its package and price, its address, when and by whom it was opened, its
 * next payment (with billing, C16).
 */
export function SummaryCard({ shop }: { shop: TenantDetail }) {
  const { t } = useTranslation()
  const primary = shop.domains.find((domain) => domain.is_primary)
  const rows: [string, React.ReactNode][] = [
    [t("summary.status"), <TenantStatusBadge key="status" status={shop.tenant.status} />],
    [
      t("summary.package"),
      shop.package
        ? `${shop.package.name} · ${priceText(t, shop.package)}`
        : t("tenants.noPackage"),
    ],
    [t("summary.address"), primary?.hostname ?? "—"],
    [
      t("summary.nextPayment"),
      shop.tenant.next_payment_on ? formatDate(shop.tenant.next_payment_on) : "—",
    ],
    [t("summary.created"), formatDate(shop.tenant.created_at)],
    [t("summary.createdBy"), shop.tenant.created_by ?? t("activity.system")],
  ]
  return (
    <SectionCard title={t("summary.title")}>
      <dl className="flex flex-col gap-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right wrap-break-word">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
