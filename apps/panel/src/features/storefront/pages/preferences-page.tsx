import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Paintbrush } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { TrustBadgesCard } from "@/features/settings/components/storefront-badges-card"
import { ContactFormCard } from "@/features/settings/components/storefront-contact-card"
import { InfoPagesCard } from "@/features/settings/components/storefront-info-pages-card"
import { LowStockBadgeCard } from "@/features/settings/components/storefront-stock-card"
import { SwatchesCard } from "@/features/settings/components/storefront-swatches-card"
import { maintenanceQuery } from "@/features/storefront/api/maintenance"
import { MaintenanceTab } from "@/features/storefront/components/maintenance-tab"
import type { PreferencesTab } from "@/features/storefront/preferences-tabs"
import { errorText } from "@/lib/errors"

const P = "storefront.preferences"

/**
 * Storefront > Preferences (adr/0049): what the storefront says and does
 * that is not drawn in the theme editor: the trust badges' words, the page
 * the contact form shows on, the payment and shipping pages (adr/0046 Ek
 * 2026-11-05), the colour names that show as swatches, when
 * a product card says "Az kaldı". One
 * card per tab (the owner: no page of cards running down); each saves its
 * own part. The design itself (the home page, the announcement bar, the
 * theme's settings) is the theme editor's. Maintenance (adr/0053) is a tab
 * of its own, its state beside the title.
 */
export function PreferencesPage() {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<StorefrontSettings>("storefront"))
  const dark = useQuery(maintenanceQuery()).data?.values.enabled === true
  const tab = (key: PreferencesTab, render: (saved: StorefrontSettings) => ReactNode) => ({
    key,
    label: t(`${P}.tabs.${key}`),
    content: query.isError ? (
      <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
    ) : query.data ? (
      render(query.data.values)
    ) : (
      <LoadingRows rows={5} />
    ),
  })
  const editor = (
    <Button asChild variant="outline">
      <Link to="/storefront/editor">
        <Paintbrush />
        {t(`${P}.editor`)}
      </Link>
    </Button>
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.storefrontPreferences")}
        description={t(`${P}.description`)}
        action={editor}
        badge={dark ? <StatusBadge tone="warning">{t(`${P}.dark`)}</StatusBadge> : null}
      />
      <SettingsTabs
        label={t("nav.storefrontPreferences")}
        tabs={[
          tab("badges", (saved) => <TrustBadgesCard saved={saved} />),
          tab("contact", (saved) => <ContactFormCard saved={saved} />),
          tab("infoPages", (saved) => <InfoPagesCard saved={saved} />),
          tab("swatches", (saved) => <SwatchesCard saved={saved} />),
          tab("stock", (saved) => <LowStockBadgeCard saved={saved} />),
          { key: "maintenance", label: t(`${P}.tabs.maintenance`), content: <MaintenanceTab /> },
        ]}
      />
    </div>
  )
}
