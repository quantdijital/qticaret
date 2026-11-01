import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { TrustBadgesCard } from "@/features/settings/components/storefront-badges-card"
import { ColorCard } from "@/features/settings/components/storefront-color-card"
import { ContactFormCard } from "@/features/settings/components/storefront-contact-card"
import { FooterGroupsCard } from "@/features/settings/components/storefront-footer-card"
import {
  AnnouncementsCard,
  TopLinksCard,
} from "@/features/settings/components/storefront-header-cards"
import { HeroCard } from "@/features/settings/components/storefront-hero-card"
import { MenuCard } from "@/features/settings/components/storefront-menu-card"
import { WhatsappCard } from "@/features/settings/components/storefront-whatsapp-card"
import { errorText } from "@/lib/errors"

/**
 * Settings > Storefront (F18, docs/19 §4): what the shop writes around every
 * page of its storefront: first its main colour and the home page's opening,
 * then top to bottom the announcement bar, the links above the menu, the
 * menu, the trust badges, the footer's columns, the WhatsApp button and the
 * page the contact form shows on. Each card saves its own part.
 */
export function StorefrontPage() {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<StorefrontSettings>("storefront"))
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.storefront.title")}
        description={t("settings.storefront.subtitle")}
      />
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={8} />
      ) : (
        <>
          <ColorCard saved={query.data.values} />
          <HeroCard saved={query.data.values} />
          <AnnouncementsCard saved={query.data.values} />
          <TopLinksCard saved={query.data.values} />
          <MenuCard saved={query.data.values} />
          <TrustBadgesCard saved={query.data.values} />
          <FooterGroupsCard saved={query.data.values} />
          <WhatsappCard saved={query.data.values} />
          <ContactFormCard saved={query.data.values} />
        </>
      )}
    </div>
  )
}
