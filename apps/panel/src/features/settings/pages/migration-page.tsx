import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { AddressesCard } from "@/features/settings/components/migration/addresses-card"
import { CutoverCard, InvitesCard } from "@/features/settings/components/migration/cutover-cards"
import { RunCard } from "@/features/settings/components/migration/run-card"

/**
 * Settings > Migration (F14, adr/0042): the run from the old platform with
 * its latest runs, the old addresses and their 301s, then the
 * cutover and the customers' invitations. The owner's alone.
 */
export function MigrationPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t("settings.migration.title")}
        description={t("settings.migration.subtitle")}
      />
      <RunCard />
      <AddressesCard />
      <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
        <CutoverCard className="h-full" />
        <InvitesCard className="h-full" />
      </div>
    </div>
  )
}
