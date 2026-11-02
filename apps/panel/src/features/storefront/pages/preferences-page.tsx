import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Paintbrush } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { TrustBadgesCard } from "@/features/settings/components/storefront-badges-card"
import { ContactFormCard } from "@/features/settings/components/storefront-contact-card"
import { SwatchesCard } from "@/features/settings/components/storefront-swatches-card"
import type { PreferencesTab } from "@/features/storefront/preferences-tabs"
import { errorText } from "@/lib/errors"

const P = "storefront.preferences"

/**
 * Storefront > Preferences (adr/0049): what the storefront says and does
 * that is not drawn in the theme editor: the trust badges' words, the page
 * the contact form shows on, the colour names that show as swatches. One
 * card per tab (the owner: no page of cards running down); each saves its
 * own part. The design itself (the home page, the announcement bar, the
 * main colour) is the theme editor's.
 */
export function PreferencesPage() {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<StorefrontSettings>("storefront"))
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
      />
      <SettingsTabs
        label={t("nav.storefrontPreferences")}
        tabs={[
          tab("badges", (saved) => <TrustBadgesCard saved={saved} />),
          tab("contact", (saved) => <ContactFormCard saved={saved} />),
          tab("swatches", (saved) => <SwatchesCard saved={saved} />),
        ]}
      />
    </div>
  )
}
