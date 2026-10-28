import { useTranslation } from "react-i18next"
import { SectionNav } from "@/components/patterns/section-nav"

/** Müşteriler's screens: the customers, and their groups and segments (F10.3). */
export function CustomersNav() {
  const { t } = useTranslation()
  return (
    <SectionNav
      label={t("customers.sections")}
      items={[
        { to: "/customers", label: t("customers.sectionCustomers") },
        { to: "/customers/groups", label: t("customers.sectionGroups") },
      ]}
    />
  )
}
