import { getRouteApi } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { AddressesCard } from "@/features/settings/components/migration/addresses-card"
import { CutoverCard, InvitesCard } from "@/features/settings/components/migration/cutover-cards"
import { DescriptionRefreshCard } from "@/features/settings/components/migration/description-refresh-card"
import { LinksCard } from "@/features/settings/components/migration/links-card"
import { RunCard } from "@/features/settings/components/migration/run-card"

const route = getRouteApi("/_auth/settings/migration")

/** A part of the page: its name and one sentence of what it is for. */
function PartHeading({ part }: { part: "fix" | "after" }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-0.5 pt-2">
      <h2 className="text-base font-semibold">{t(`settings.migration.${part}.title`)}</h2>
      <p className="text-[13px] text-muted-foreground">
        {t(`settings.migration.${part}.description`)}
      </p>
    </div>
  )
}

/**
 * Settings > Migration (F14, adr/0042): the run from the old platform with
 * its latest runs; the two that redo one part of what moved (the
 * descriptions, ADR-0055; the texts' links to the old site, adr/0042 Ek
 * 2026-11-05); then the steps after the move, numbered in their order:
 * the old addresses and their redirects, the domain's move, the
 * customers' invitations. The owner's alone.
 */
export function MigrationPage() {
  const { t } = useTranslation()
  const { kaynak } = route.useSearch()
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t("settings.migration.title")}
        description={t("settings.migration.subtitle")}
      />
      <RunCard withBundle={kaynak === "paket"} />
      <PartHeading part="fix" />
      <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
        <DescriptionRefreshCard className="h-full" />
        <LinksCard className="h-full" />
      </div>
      <PartHeading part="after" />
      <AddressesCard step={1} />
      <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
        <CutoverCard className="h-full" step={2} />
        <InvitesCard className="h-full" step={3} />
      </div>
    </div>
  )
}
