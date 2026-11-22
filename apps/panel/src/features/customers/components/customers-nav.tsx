import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SectionNav } from "@qticaret/admin-ui/patterns/section-nav"
import { useCan } from "@/features/auth/api/staff"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { featuresQuery } from "@/features/settings/api/features"

/**
 * Müşteriler's screens: the customers, their groups and segments (F10.3),
 * the carts left behind (2026-11-06; not for read-only staff: they name
 * people who did not buy) and what they wrote from the storefront's
 * contact form (adr/0047). The wholesalers are a menu item of their own
 * (the owner, 2026-11-16). With dated sales on, owner and admin also get
 * a traveler's own KVKK request (adr/0076 Ek D6b).
 */
export function CustomersNav() {
  const { t } = useTranslation()
  const carts = useCan("abandonedCarts")
  const travelers = useCan("travelerRequests")
  // The flags are read only for those who may use it
  const flags = useQuery({ ...featuresQuery(), enabled: travelers }).data
  const booking = flags?.some((flag) => flag.key === BOOKING_FLAG && flag.enabled) ?? false
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
        ...(travelers && booking
          ? [{ to: "/customers/travelers", label: t("customers.sectionTravelers") }]
          : []),
      ]}
    />
  )
}
