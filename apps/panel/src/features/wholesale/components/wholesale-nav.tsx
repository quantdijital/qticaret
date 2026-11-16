import { useTranslation } from "react-i18next"
import { SectionNav } from "@qticaret/admin-ui/patterns/section-nav"
import { CustomersNav } from "@/features/customers/components/customers-nav"
import { useWholesaleOpen } from "@/features/wholesale/api/access"

/**
 * Toptancılar's tabs (ADR-0068 Ek 2026-11-15 (2)) under Müşteriler's: the
 * section's own row first, Toptancılar marked on every wholesale screen,
 * so Müşteriler is one click away (the owner, 2026-11-16: "müşteriler
 * sekmesine geri gidemiyorum"); then the wholesalers, their levels and
 * their orders, each at its own address, while they are open.
 */
export function WholesaleNav() {
  const { t } = useTranslation()
  const open = useWholesaleOpen()
  return (
    <>
      <CustomersNav />
      {open ? (
        <SectionNav
          level="sub"
          label={t("wholesale.nav.label")}
          items={[
            { to: "/customers/wholesale", label: t("wholesale.nav.accounts") },
            { to: "/customers/wholesale/tiers", label: t("wholesale.nav.tiers") },
            { to: "/customers/wholesale/orders", label: t("wholesale.nav.orders") },
          ]}
        />
      ) : null}
    </>
  )
}
