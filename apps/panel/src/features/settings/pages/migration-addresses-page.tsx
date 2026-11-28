import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { AddressesCard } from "@/features/settings/components/migration/addresses-card"

const P = "settings.migration.addressesPage"

/**
 * Settings > Migration > Old addresses (F14.7): the old site's addresses,
 * what each answers here and the owner's decisions, on a page of their own
 * so the migration page stays a summary.
 */
export function MigrationAddressesPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t(`${P}.title`)}
        description={t(`${P}.description`)}
        back={{ to: "/settings/migration", label: t(`${P}.back`) }}
      />
      <AddressesCard />
    </div>
  )
}
