import { useTranslation } from "react-i18next"
import { SectionNav } from "@qticaret/admin-ui/patterns/section-nav"
import { useCan } from "@/features/auth/api/staff"

/**
 * Müşteriler's screens: the customers, their groups and segments (F10.3),
 * the carts left behind (2026-11-06; not for read-only staff: they name
 * people who did not buy) and what they wrote from the storefront's
 * contact form (adr/0047). The wholesalers are a menu item of their own
 * (the owner, 2026-11-16). Owner and admin also get a traveler's own
 * KVKK request (adr/0076 Ek D6b), whatever the dated sales flag says
 * (security review O2): a person's right to their rows outlives it.
 */
export function CustomersNav() {
  const { t } = useTranslation()
  const carts = useCan("abandonedCarts")
  const travelers = useCan("travelerRequests")
  return (
    <SectionNav
      label={t("customers.sections")}
      items={[
        { to: "/customers", label: t("customers.sectionCustomers") },
        { to: "/customers/groups", label: t("customers.sectionGroups") },
        ...(carts
          ? [{ to: "/customers/abandoned-carts", label: t("customers.sectionAbandoned") }]
          : []),
        { to: "/customers/contact-messages", label: t("customers.sectionContact") },
        ...(travelers
          ? [{ to: "/customers/travelers", label: t("customers.sectionTravelers") }]
          : []),
      ]}
    />
  )
}
