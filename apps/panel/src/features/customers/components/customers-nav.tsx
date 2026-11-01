import { useTranslation } from "react-i18next"
import { SectionNav } from "@/components/patterns/section-nav"

/**
 * Müşteriler's screens: the customers, their groups and segments (F10.3),
 * and what they wrote from the storefront's contact form (adr/0047).
 */
export function CustomersNav() {
  const { t } = useTranslation()
  return (
    <SectionNav
      label={t("customers.sections")}
      items={[
        { to: "/customers", label: t("customers.sectionCustomers") },
        { to: "/customers/groups", label: t("customers.sectionGroups") },
        { to: "/customers/contact-messages", label: t("customers.sectionContact") },
      ]}
    />
  )
}
