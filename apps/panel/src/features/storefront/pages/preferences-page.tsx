import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Paintbrush } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { ContactFormCard } from "@/features/settings/components/storefront-contact-card"
import { InfoPagesCard } from "@/features/settings/components/storefront-info-pages-card"
import { maintenanceQuery } from "@/features/storefront/api/maintenance"
import { MaintenanceTab } from "@/features/storefront/components/maintenance-tab"
import type { PreferencesTab } from "@/features/storefront/preferences-tabs"
import { errorText } from "@/lib/errors"

const P = "storefront.preferences"

/**
 * Storefront > Preferences (adr/0049): how the store behaves, not how it
 * looks: the page the contact form shows on, the payment and shipping
 * pages (adr/0046 Ek 2026-11-05), maintenance (adr/0053, its state beside
 * the title). One card per tab (the owner: no page of cards running down);
 * each saves its own part. Everything drawn (the trust badges, the colour
 * swatches, "Az kaldı", adr/0049 Ek 2026-11-06) is the theme editor's.
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
          tab("contact", (saved) => <ContactFormCard saved={saved} />),
          tab("infoPages", (saved) => <InfoPagesCard saved={saved} />),
          { key: "maintenance", label: t(`${P}.tabs.maintenance`), content: <MaintenanceTab /> },
        ]}
      />
    </div>
  )
}
