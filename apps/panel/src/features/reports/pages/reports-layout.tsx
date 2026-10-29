import { Outlet, useRouterState } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { SectionNav } from "@/components/patterns/section-nav"
import { ReportExportButton } from "@/features/reports/components/report-export"
import { ReportRangePicker } from "@/features/reports/components/report-range-picker"
import { useReport } from "@/features/reports/use-report"
import { formatCount } from "@/lib/format"

/**
 * Reports (docs/06 §4, F11.1–F11.4): a preset period or a range of days,
 * reports as tabs (summary, products, categories, brands, promotions and
 * traffic sources, day by day, finance, stock); every
 * table as one Excel file, or a table as CSV, made on the server. The
 * range stays in the address as the tabs change. No personal data.
 */
export function ReportsLayout() {
  const { t } = useTranslation()
  const report = useReport()
  // The finance and stock tabs' files are their own reports; every other tab's, the sales report
  const kind = useRouterState({
    select: (state) =>
      state.location.pathname.endsWith("/reports/finance")
        ? ("finance" as const)
        : state.location.pathname.endsWith("/reports/stock")
          ? ("stock" as const)
          : state.location.pathname.endsWith("/reports/search")
            ? ("search" as const)
            : ("sales" as const),
  })
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t("nav.reports")}
        description={t("reports.description")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ReportRangePicker />
            {/* Searches have no file: their lists are the page */}
            {kind === "search" ? null : <ReportExportButton report={kind} format="xlsx" />}
          </div>
        }
      />
      <SectionNav
        label={t("reports.sections")}
        keepSearch
        items={[
          { to: "/reports", label: t("reports.tabs.summary") },
          { to: "/reports/products", label: t("reports.tabs.products") },
          { to: "/reports/categories", label: t("reports.tabs.categories") },
          { to: "/reports/brands", label: t("reports.tabs.brands") },
          { to: "/reports/marketing", label: t("reports.tabs.marketing") },
          { to: "/reports/daily", label: t("reports.tabs.daily") },
          { to: "/reports/finance", label: t("reports.tabs.finance") },
          { to: "/reports/stock", label: t("reports.tabs.stock") },
          { to: "/reports/search", label: t("reports.tabs.search") },
        ]}
      />
      <Outlet />
      {report.data?.capped ? (
        <p className="text-xs text-muted-foreground">
          {t("dashboard.capped", { count: formatCount(50_000) })}
        </p>
      ) : null}
    </div>
  )
}
