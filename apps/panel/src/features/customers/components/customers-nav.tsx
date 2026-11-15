import { useTranslation } from "react-i18next"
import { SectionNav } from "@qticaret/admin-ui/patterns/section-nav"
import { useCan } from "@/features/auth/api/staff"
import { useWholesaleOpen } from "@/features/wholesale/api/access"

/**
 * Müşteriler's screens: the customers, their groups and segments (F10.3),
 * the wholesalers and their levels (ADR-0068: only while the shop sells
 * wholesale, for owner and admin), the carts left behind (2026-11-06; not
 * for read-only staff: they name people who did not buy) and what they
 * wrote from the storefront's contact form (adr/0047).
 */
export function CustomersNav() {
  const { t } = useTranslation()
  const carts = useCan("abandonedCarts")
  const wholesale = useWholesaleOpen()
  return (
    <SectionNav
      label={t("customers.sections")}
      items={[
        { to: "/customers", label: t("customers.sectionCustomers") },
        { to: "/customers/groups", label: t("customers.sectionGroups") },
        ...(wholesale
          ? [
              { to: "/customers/wholesale", label: t("customers.sectionWholesale") },
              { to: "/customers/wholesale/tiers", label: t("customers.sectionWholesaleTiers") },
            ]
          : []),
        ...(carts
          ? [{ to: "/customers/abandoned-carts", label: t("customers.sectionAbandoned") }]
          : []),
        { to: "/customers/contact-messages", label: t("customers.sectionContact") },
      ]}
    />
  )
}
