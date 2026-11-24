import { useNavigate } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { useCapabilities } from "@/features/auth/api/staff"
import { AdvisorSummaryCard } from "@/features/seo/advisor/summary-card"
import { AuditCard } from "@/features/seo/audit/audit-card"
import { SeoHomeSummary } from "@/features/seo/components/seo-home-summary"
import { useSeoPartCounts } from "@/features/seo/part-counts"
import { RedirectsTab } from "@/features/seo/pages/redirects-page"
import { SeoOverview } from "@/features/seo/pages/seo-page"
import { SiteSearchTab } from "@/features/seo/pages/site-search-page"
import { visibleSeoParts } from "@/features/seo/parts"
import type { SeoPart } from "@/features/seo/parts"
import {
  SeoAddressesPart,
  SeoPagesPart,
  SeoSearchPart,
} from "@/features/settings/components/seo-settings-cards"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"

/**
 * Settings > SEO, the shop's one SEO home (the owner, 2026-11-23: "SEO
 * işleri buradan yürümeli"; docs/13, docs/14): the overview, the advisor's
 * suggestions, the store-wide audit, redirects and site search for every
 * role that saw them under Pazarlama, then the SEO settings for those who
 * may change them. The score in the header and the counts on the tabs
 * show the day's work on arrival.
 */
export function SeoPage() {
  const { t } = useTranslation()
  const can = useCapabilities()
  const navigate = useNavigate()
  const counts = useSeoPartCounts()
  const content: Record<SeoPart, ReactNode> = {
    overview: <SeoOverview />,
    advisor: <AdvisorSummaryCard />,
    audit: <AuditCard />,
    redirects: <RedirectsTab />,
    "site-search": <SiteSearchTab />,
    addresses: <SeoAddressesPart />,
    pages: <SeoPagesPart />,
    search: <SeoSearchPart />,
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.seo.title")}
        description={t("settings.seo.subtitle")}
        action={<SeoHomeSummary />}
      />
      <SettingsTabs
        label={t("settings.seo.title")}
        // A tab's filters (a search, a page) stay behind with it
        onOpen={(part) => {
          void navigate({
            to: "/settings/seo",
            search: { part },
            replace: true,
            resetScroll: false,
          })
        }}
        tabs={visibleSeoParts(can).map((item) => ({
          key: item.part,
          label: t(`settings.seo.tabs.${item.label}`),
          count: counts[item.part],
          content: content[item.part],
        }))}
      />
    </div>
  )
}
