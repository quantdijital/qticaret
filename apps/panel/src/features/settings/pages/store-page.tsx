import { useQuery } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { PageGrid } from "@qticaret/admin-ui/patterns/page-grid"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { spanOf } from "@qticaret/admin-ui/lib/page-spans"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { appearanceQuery } from "@/features/settings/api/appearance"
import { sectionQuery } from "@/features/settings/api/sections"
import type { LegalSettings, StoreSettings } from "@/features/settings/api/sections"
import { storeQuery } from "@/features/settings/api/store"
import { EtbisQrCard } from "@/features/settings/components/etbis-qr-card"
import { LegalIdentityCard } from "@/features/settings/components/legal-identity-card"
import { OpeningHoursCard } from "@/features/settings/components/opening-hours-card"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { SocialAccountsCard } from "@/features/settings/components/social-accounts-card"
import { StoreBrandCard } from "@/features/settings/components/store-brand-card"
import { StoreContactCard } from "@/features/settings/components/store-contact-card"
import { RegionCard } from "@/features/settings/components/store-region-card"
import type { StoreTab } from "@/features/settings/store-tabs"
import { errorText } from "@/lib/errors"

const S = "settings.store"

/**
 * Settings > Store profile (adr/0048, "mağaza bilgileri tek kaynak"): every
 * detail of the shop in one place, read from here by the storefront, the
 * legal texts, e-mails and Google's structured data. In tabs (the owner:
 * no page of cards running down): the brand (name, logos, site icon) and
 * units; how the shop
 * is reached and when; its legal identity; its social accounts. Each card
 * saves its own part.
 */
export function StorePage() {
  const { t } = useTranslation()
  const store = useQuery(storeQuery())
  const section = useQuery(sectionQuery<StoreSettings>("store"))
  const legal = useQuery(sectionQuery<LegalSettings>("legal"))
  const appearance = useQuery(appearanceQuery())
  const queries = [store, section, legal, appearance]
  const failed = queries.find((query) => query.isError)?.error
  const loaded =
    store.data && section.data && legal.data && appearance.data
      ? {
          store: store.data,
          values: section.data.values,
          legal: legal.data.values,
          appearance: appearance.data.values,
        }
      : null
  const tab = (key: StoreTab, render: (data: NonNullable<typeof loaded>) => ReactNode) => ({
    key,
    label: t(`${S}.tabs.${key}`),
    content: failed ? (
      <ErrorState
        text={errorText(t, failed)}
        onRetry={() => {
          queries.forEach((query) => void query.refetch())
        }}
      />
    ) : loaded ? (
      render(loaded)
    ) : (
      <LoadingRows rows={5} />
    ),
  })
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t(`${S}.title`)} description={t(`${S}.subtitle`)} />
      <SettingsTabs
        label={t(`${S}.title`)}
        tabs={[
          // The brand (name, logos, site icon) wide; the short region and units on the right
          tab("general", (data) => (
            <PageGrid>
              <StoreBrandCard
                storeId={data.store.id}
                name={data.store.name}
                appearance={data.appearance}
                className={spanOf(8)}
              />
              <RegionCard saved={data.values} className={spanOf(4)} />
            </PageGrid>
          )),
          tab("contact", (data) => (
            <>
              <StoreContactCard store={data.values} legal={data.legal} />
              <OpeningHoursCard saved={data.values} />
            </>
          )),
          tab("legal", (data) => (
            <PageGrid>
              <LegalIdentityCard
                saved={data.legal}
                hasContact={Boolean(data.values.contact_email ?? data.values.contact_phone)}
                className={spanOf(8)}
              />
              <EtbisQrCard saved={data.values} className={spanOf(4)} />
            </PageGrid>
          )),
          tab("social", (data) => <SocialAccountsCard saved={data.legal} />),
        ]}
      />
    </div>
  )
}
