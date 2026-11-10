import { Link } from "@tanstack/react-router"
import { Mails } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { BulkGateState } from "./use-bulk-access"

const B = "bulkMessages"

/** Its children once the screen may open; otherwise one sentence says why. */
export function BulkGate({ gate, children }: { gate: BulkGateState; children: ReactNode }) {
  const { t } = useTranslation()
  if (gate.access === "ok") {
    return children
  }
  if (gate.access === "loading") {
    return <LoadingRows rows={6} />
  }
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center shadow-card">
      <Mails className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-md text-sm text-muted-foreground">
        {t(gate.access === "off" ? `${B}.off` : `${B}.noAccess`)}
      </p>
      {gate.access === "off" && gate.canTurnOn ? (
        <Button asChild variant="outline">
          <Link to="/settings/features">{t(`${B}.turnOn`)}</Link>
        </Button>
      ) : null}
    </section>
  )
}
