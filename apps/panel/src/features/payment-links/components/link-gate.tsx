import { Link } from "@tanstack/react-router"
import { Link2 } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import type { LinkGateState } from "./use-link-access"

const P = "paymentLinks"

/** Its children once the screen may open; otherwise one sentence says why. */
export function LinkGate({ gate, children }: { gate: LinkGateState; children: ReactNode }) {
  const { t } = useTranslation()
  if (gate.access === "ok") {
    return children
  }
  if (gate.access === "loading") {
    return <LoadingRows rows={6} />
  }
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center shadow-card">
      <Link2 className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-md text-sm text-muted-foreground">
        {t(gate.access === "off" ? `${P}.off` : `${P}.noAccess`)}
      </p>
      {gate.access === "off" && gate.canTurnOn ? (
        <Button asChild variant="outline">
          <Link to="/settings/features">{t(`${P}.turnOn`)}</Link>
        </Button>
      ) : null}
    </section>
  )
}
