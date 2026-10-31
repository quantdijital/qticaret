import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { sectionQuery } from "@/features/settings/api/sections"
import type { InvoicingSettings } from "@/features/settings/api/einvoice"
import { AccountingPackageCard } from "@/features/settings/components/accounting-package-card"
import { AccountingProgramCard } from "@/features/settings/components/accounting-program-card"
import { EinvoiceCarriersCard } from "@/features/settings/components/einvoice-carriers-card"
import { EinvoiceProgramCard } from "@/features/settings/components/einvoice-program-card"
import { EinvoiceConnectionCard } from "@/features/settings/components/parasut-card"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"

const E = "settings.einvoice"

/**
 * Settings > Invoices and accounting (F8, F11.5; the owner, 2026-10-31:
 * one page for everything about invoices): who issues the invoices, when
 * and in which series, with the program's connection beside it; the
 * carriers an e-Arşiv names; and the accountant's monthly package and
 * program.
 */
export function EinvoicePage() {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<InvoicingSettings>("invoicing"))
  const saved = query.data?.values
  const loading = <Skeleton className="h-72 rounded-lg" />
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader title={t(`${E}.title`)} description={t(`${E}.subtitle`)} />
      <SettingsTabs
        label={t(`${E}.title`)}
        tabs={[
          {
            key: "program",
            label: t(`${E}.tabs.program`),
            content: saved ? (
              <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
                <EinvoiceProgramCard saved={saved} className="h-full" />
                <EinvoiceConnectionCard provider={saved.provider} className="h-full" />
              </div>
            ) : (
              loading
            ),
          },
          {
            key: "carriers",
            label: t(`${E}.tabs.carriers`),
            content: saved ? <EinvoiceCarriersCard saved={saved} /> : loading,
          },
          {
            key: "accounting",
            label: t(`${E}.tabs.accounting`),
            content: (
              <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
                <AccountingPackageCard className="h-full" />
                <AccountingProgramCard className="h-full" />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
