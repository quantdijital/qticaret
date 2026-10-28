import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/patterns/page-header"
import { CustomersNav } from "@/features/customers/components/customers-nav"
import { GroupsCard } from "@/features/customers/components/groups-card"
import { SegmentsCard } from "@/features/customers/components/segments-card"

/**
 * Müşteriler > Gruplar ve segmentler (F10.3, adr/0037 §6): the groups
 * promotions and price lists target, by rule or by hand.
 */
export function CustomerGroupsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("customers.groupsPage.title")}
        description={t("customers.groupsPage.description")}
      />
      <CustomersNav />
      <SegmentsCard />
      <GroupsCard />
    </div>
  )
}
