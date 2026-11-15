import { useTranslation } from "react-i18next"
import { SectionNav } from "@qticaret/admin-ui/patterns/section-nav"
import { useWholesaleOpen } from "@/features/wholesale/api/access"

/**
 * Toptancılar's own tabs (ADR-0068 Ek 2026-11-15 (2)): the wholesalers,
 * their levels and their orders, each at its own address. Reached from
 * Müşteriler's single "Toptancılar" entry; not drawn while they are closed.
 */
export function WholesaleNav() {
  const { t } = useTranslation()
  const open = useWholesaleOpen()
  if (!open) {
    return null
  }
  return (
    <SectionNav
      label={t("wholesale.nav.label")}
      items={[
        { to: "/customers/wholesale", label: t("wholesale.nav.accounts") },
        { to: "/customers/wholesale/tiers", label: t("wholesale.nav.tiers") },
        { to: "/customers/wholesale/orders", label: t("wholesale.nav.orders") },
      ]}
    />
  )
}
