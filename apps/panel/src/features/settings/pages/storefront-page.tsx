import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { sectionQuery } from "@/features/settings/api/sections"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { TrustBadgesCard } from "@/features/settings/components/storefront-badges-card"
import { FooterGroupsCard } from "@/features/settings/components/storefront-footer-card"
import {
  AnnouncementsCard,
  TopLinksCard,
} from "@/features/settings/components/storefront-header-cards"
import { WhatsappCard } from "@/features/settings/components/storefront-whatsapp-card"
import { errorText } from "@/lib/errors"

/**
 * Settings > Storefront (F18, docs/19 §4): what the shop writes around every
 * page of its storefront, top to bottom: the announcement bar, the links
 * above the menu, the trust badges, the footer's columns and the WhatsApp
 * button. Each card saves its own part.
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
        <LoadingRows rows={5} />
      ) : (
        <>
          <AnnouncementsCard saved={query.data.values} />
          <TopLinksCard saved={query.data.values} />
          <TrustBadgesCard saved={query.data.values} />
          <FooterGroupsCard saved={query.data.values} />
          <WhatsappCard saved={query.data.values} />
        </>
      )}
    </div>
  )
}
