import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { sectionQuery } from "@/features/settings/api/sections"
import type { InvoicingSettings } from "@/features/settings/api/einvoice"
import { EinvoiceCarriersCard } from "@/features/settings/components/einvoice-carriers-card"
import { EinvoiceProgramCard } from "@/features/settings/components/einvoice-program-card"
import { EinvoiceConnectionCard } from "@/features/settings/components/parasut-card"

/**
 * Settings > E-invoice (F8, adr/0034): who issues the invoices and when,
 * the program's connection beside it, and the carriers an e-Arşiv names.
 */
export function EinvoicePage() {
  const { t } = useTranslation()
  const query = useQuery(sectionQuery<InvoicingSettings>("invoicing"))
  const saved = query.data?.values
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t("settings.einvoice.title")}
        description={t("settings.einvoice.subtitle")}
      />
      {!saved ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : (
        <>
          <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
            <EinvoiceProgramCard saved={saved} className="h-full" />
            <EinvoiceConnectionCard provider={saved.provider} className="h-full" />
          </div>
          <EinvoiceCarriersCard saved={saved} />
        </>
      )}
    </div>
  )
}
