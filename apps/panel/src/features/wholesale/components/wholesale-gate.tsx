import { Link } from "@tanstack/react-router"
import { Store } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useWholesaleAccess } from "@/features/wholesale/api/access"

/**
 * Its children once the wholesale screens may open; otherwise one
 * sentence says why (the shop has it off, or the role does not reach it),
 * and the owner or admin is offered the switch in Ayarlar > Özellikler.
 */
export function WholesaleGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const gate = useWholesaleAccess()
  if (gate.access === "ok") {
    return children
  }
  if (gate.access === "loading") {
    return <LoadingRows rows={6} />
  }
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center shadow-card">
      <Store className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-md text-sm text-muted-foreground">
        {t(gate.access === "off" ? "wholesale.gate.off" : "wholesale.gate.denied")}
      </p>
      {gate.access === "off" && gate.canTurnOn ? (
        <Button asChild variant="outline">
          <Link to="/settings/features">{t("wholesale.gate.turnOn")}</Link>
        </Button>
      ) : null}
    </section>
  )
}
