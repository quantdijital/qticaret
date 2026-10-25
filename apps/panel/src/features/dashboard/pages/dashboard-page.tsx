import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { StatCard } from "@/components/patterns/stat-card"
import { EmptyState, ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/features/auth/api/me"
import { productCountsQuery, summaryQuery } from "@/features/dashboard/api/summary"
import type { HomeSummary } from "@/features/dashboard/api/summary"
import { SetupProgress } from "@/features/dashboard/components/setup-progress"
import { advancedPanelUrl } from "@/lib/advanced-panel"
import { errorText } from "@/lib/errors"
import { formatCount, formatMoney } from "@/lib/format"

export function DashboardPage() {
  const { t } = useTranslation()
  const user = useCurrentUser()
  const name = user?.first_name?.trim()
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={name ? t("dashboard.greeting", { name }) : t("dashboard.greetingNoName")}
      />
      <SetupProgress />
      <TodaySection />
      <ProductsSection />
    </div>
  )
}

function TodaySection() {
  const { t } = useTranslation()
  const { data, isPending, isError, error, refetch } = useQuery(summaryQuery())
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("dashboard.today.title")}</h2>
      {isPending ? (
        <LoadingRows rows={2} />
      ) : isError ? (
        <ErrorState text={errorText(t, error)} onRetry={() => void refetch()} />
      ) : (
        <TodayCards summary={data} />
      )}
    </section>
  )
}

function TodayCards({ summary }: { summary: HomeSummary }) {
  const { t } = useTranslation()
  const sales = summary.today.sales.length
    ? summary.today.sales.map((sale) => formatMoney(sale.amount, sale.currency_code)).join(" · ")
    : formatMoney("0", "try")
  const more = (capped: boolean) => (capped ? "+" : "")
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t("dashboard.today.awaiting")}
        value={`${formatCount(summary.awaiting_shipment)}${more(summary.capped)}`}
        hint={t("dashboard.today.awaitingHint")}
      />
      <StatCard
        label={t("dashboard.today.orders")}
        value={`${formatCount(summary.today.orders)}${more(summary.today.capped)}`}
        hint={t("dashboard.today.ordersHint")}
      />
      <StatCard
        label={t("dashboard.today.sales")}
        value={`${sales}${more(summary.today.capped)}`}
        hint={t("dashboard.today.salesHint")}
      />
      <StatCard
        label={t("dashboard.today.open")}
        value={formatCount(summary.open_orders)}
        hint={t("dashboard.today.openHint")}
      />
    </dl>
  )
}

function ProductsSection() {
  const { t } = useTranslation()
  const { data, isPending, isError, error, refetch } = useQuery(productCountsQuery())
  const addProduct = (
    <Button asChild size="sm" variant="outline">
      <a href={advancedPanelUrl("/products/create")} target="_blank" rel="noreferrer">
        {t("dashboard.setup.openInAdvanced")}
      </a>
    </Button>
  )
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t("dashboard.products.title")}</h2>
        <Button asChild size="sm" variant="ghost">
          <a href={advancedPanelUrl("/products")} target="_blank" rel="noreferrer">
            {t("dashboard.products.viewAll")}
          </a>
        </Button>
      </div>
      {isPending ? (
        <LoadingRows rows={1} />
      ) : isError ? (
        <ErrorState text={errorText(t, error)} onRetry={() => void refetch()} />
      ) : data.published + data.draft === 0 ? (
        <EmptyState text={t("dashboard.products.empty")} action={addProduct} />
      ) : (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label={t("dashboard.products.published")} value={formatCount(data.published)} />
          <StatCard label={t("dashboard.products.draft")} value={formatCount(data.draft)} />
        </dl>
      )}
    </section>
  )
}
