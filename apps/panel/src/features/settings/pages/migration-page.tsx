import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { migrationOverviewQuery } from "@/features/settings/api/migration-overview"
import { AddressesStepCard } from "@/features/settings/components/migration/addresses-step"
import { CompletionsCard } from "@/features/settings/components/migration/completions-card"
import { CutoverCard, InvitesCard } from "@/features/settings/components/migration/cutover-cards"
import { OverviewTiles } from "@/features/settings/components/migration/overview-tiles"
import { RecentRuns } from "@/features/settings/components/migration/runs-card"

/** A part of the page: its name and one sentence of what it is for. */
function PartHeading({ part }: { part: "after" }) {
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
 * Settings > Migration (F14, adr/0042 Ek 2026-11-27), in three parts: what
 * moved, by kind, with what is missing; the completions, each one part of
 * what moved taken again; the steps after the move, numbered in their
 * order (the old addresses, on their own page; the domain's move; the
 * customers' invitations). A new migration is its own wizard
 * (`/settings/migration/new`). The owner's alone.
 */
export function MigrationPage() {
  const { t } = useTranslation()
  const overview = useQuery(migrationOverviewQuery())
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t("settings.migration.title")}
        description={t("settings.migration.subtitle")}
      />
      <OverviewTiles overview={overview.data} />
      <CompletionsCard overview={overview.data} />
      <PartHeading part="after" />
      <div className="grid items-stretch gap-[var(--grid-gap)] md:grid-cols-2 xl:grid-cols-3">
        <AddressesStepCard className="h-full" overview={overview.data} step={1} />
        <CutoverCard className="h-full" step={2} />
        <InvitesCard className="h-full md:col-span-2 xl:col-span-1" step={3} />
      </div>
      <details className="group/history rounded-lg border bg-card px-5 py-3.5 shadow-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open/history:rotate-90"
          />
          {t("settings.migration.afterCards.history")}
        </summary>
        <div className="mt-3">
          <RecentRuns hideTitle />
        </div>
      </details>
    </div>
  )
}
