import { Outlet, getRouteApi, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { PeriodPicker } from "@/components/patterns/period-picker"
import { SectionNav } from "@/components/patterns/section-nav"
import { DEFAULT_PERIOD, PERIODS } from "@/features/dashboard/period"
import { useReport } from "@/features/reports/use-report"
import { formatCount } from "@/lib/format"

const route = getRouteApi("/_auth/reports")

/**
 * Reports (docs/06 §4): one period, four reports as tabs (summary,
 * products, categories, day by day), each table downloadable as CSV. The
 * period stays in the address as the tabs change. No personal data.
 */
export function ReportsLayout() {
  const { t } = useTranslation()
  const { period = DEFAULT_PERIOD } = route.useSearch()
  const navigate = useNavigate()
  const report = useReport()
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t("nav.reports")}
        description={t("reports.description")}
        action={
          <PeriodPicker
            periods={PERIODS}
            value={period}
            onChange={(next) => {
              void navigate({
                to: ".",
                search: { period: next === DEFAULT_PERIOD ? undefined : next },
                replace: true,
              })
            }}
          />
        }
      />
      <SectionNav
        label={t("reports.sections")}
        keepSearch
        items={[
          { to: "/reports", label: t("reports.tabs.summary") },
          { to: "/reports/products", label: t("reports.tabs.products") },
          { to: "/reports/categories", label: t("reports.tabs.categories") },
          { to: "/reports/daily", label: t("reports.tabs.daily") },
        ]}
      />
      <Outlet />
      {report.data?.capped ? (
        <p className="text-xs text-muted-foreground">
          {t("dashboard.capped", { count: formatCount(5000) })}
        </p>
      ) : null}
    </div>
  )
}
