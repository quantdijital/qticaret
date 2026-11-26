import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@qticaret/admin-ui/patterns/page-header"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { sectionQuery } from "@/features/settings/api/sections"
import { invoicingProviderOf } from "@/features/settings/api/einvoice"
import type { InvoicingSettings } from "@/features/settings/api/einvoice"
import { AccountingPackageCard } from "@/features/settings/components/accounting-package-card"
import { EinvoiceProgramCard } from "@/features/settings/components/einvoice-program-card"
import { EinvoiceConnectionCard } from "@/features/settings/components/parasut-card"
import { SettingsTabs } from "@/features/settings/components/settings-tabs"
import { VatRatesCard } from "@/features/settings/components/vat-rates-card"

const E = "settings.einvoice"

/**
 * Settings > Invoices and accounting (F8, F11.5; the owner, 2026-10-31:
 * one page for everything about invoices): who issues the invoices, when
 * and in which series, with the program's connection beside it, and a line
 * to where the carriers an e-Arşiv names are entered (each carrier's page
 * under Shipping since 2026-11-26; an old `?part=carriers` link goes
 * there); the KDV rates (adr/0007 Ek 2026-11-04); and
 * the accountant's monthly package (no accounting program is offered until
 * one is written, adr/0039 §5).
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
              <>
                <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
                  <EinvoiceProgramCard saved={saved} className="h-full" />
                  <EinvoiceConnectionCard
                    provider={invoicingProviderOf(saved.provider)}
                    className="h-full"
                  />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {t(`${E}.carriersMoved`)}{" "}
                  <Link
                    to="/settings/shipping"
                    search={{ part: "carriers" }}
                    className="font-medium text-foreground underline"
                  >
                    {t(`${E}.carriersLink`)}
                  </Link>
                </p>
              </>
            ) : (
              loading
            ),
          },
          {
            key: "vat",
            label: t(`${E}.tabs.vat`),
            content: <VatRatesCard />,
          },
          {
            key: "accounting",
            label: t(`${E}.tabs.accounting`),
            content: <AccountingPackageCard />,
          },
        ]}
      />
    </div>
  )
}
