import { Outlet, useRouterState } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { useDocumentTitle } from "@qticaret/admin-ui/hooks/use-document-title"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { SectionNav } from "@qticaret/admin-ui/patterns/section-nav"
import { ReportExportButton } from "@/features/reports/components/report-export"
import { ReportRangePicker } from "@/features/reports/components/report-range-picker"
import { useReport } from "@/features/reports/use-report"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const REPORT_TABS = [
  { to: "/reports", key: "summary" },
  { to: "/reports/products", key: "products" },
  { to: "/reports/categories", key: "categories" },
  { to: "/reports/brands", key: "brands" },
  { to: "/reports/marketing", key: "marketing" },
  { to: "/reports/daily", key: "daily" },
  { to: "/reports/finance", key: "finance" },
  { to: "/reports/stock", key: "stock" },
  { to: "/reports/search", key: "search" },
] as const

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
  const tabs = REPORT_TABS.map((tab) => ({ to: tab.to, label: t(`reports.tabs.${tab.key}`) }))
  const path = useRouterState({ select: (state) => state.location.pathname.replace(/\/$/, "") })
  // The open tab's name before the page's in the browser tab ("Ürünler · Raporlar")
  const open = tabs.find((tab) => tab.to === path)
  useDocumentTitle(open ? `${open.label} · ${t("nav.reports")}` : undefined)
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
      <SectionNav label={t("reports.sections")} keepSearch items={tabs} />
      <Outlet />
      {report.data?.capped ? (
        <p className="text-xs text-muted-foreground">
          {t("dashboard.capped", { count: formatCount(50_000) })}
        </p>
      ) : null}
    </div>
  )
}
