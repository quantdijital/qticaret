import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { AccountingPackageCard } from "@/features/settings/components/accounting-package-card"
import { AccountingProgramCard } from "@/features/settings/components/accounting-program-card"

/**
 * Settings > Accounting (F11.5, adr/0039 §5): the month's package for the
 * accountant, and the program the shop's records go to.
 */
export function AccountingPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
      <PageHeader
        title={t("settings.accounting.title")}
        description={t("settings.accounting.subtitle")}
      />
      <div className="grid gap-[var(--grid-gap)] lg:grid-cols-2 lg:items-stretch">
        <AccountingPackageCard className="h-full" />
        <AccountingProgramCard className="h-full" />
      </div>
    </div>
  )
}
