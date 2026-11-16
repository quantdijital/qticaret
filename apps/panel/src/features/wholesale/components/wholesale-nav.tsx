import { useTranslation } from "react-i18next"
import { SectionNav } from "@qticaret/admin-ui/patterns/section-nav"
import { useWholesaleOpen } from "@/features/wholesale/api/access"

/**
 * Toptancılar's screens, a menu item of its own (the owner, 2026-11-16):
 * the wholesalers, their levels and their orders, each at its own
 * address, while they are open.
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
        { to: "/wholesale", label: t("wholesale.nav.accounts") },
        { to: "/wholesale/tiers", label: t("wholesale.nav.tiers") },
        { to: "/wholesale/orders", label: t("wholesale.nav.orders") },
      ]}
    />
  )
}
