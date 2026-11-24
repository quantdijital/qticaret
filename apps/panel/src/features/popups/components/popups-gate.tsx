import { Link } from "@tanstack/react-router"
import { AppWindow } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCan } from "@/features/auth/api/staff"
import { useFeatureState } from "@/features/settings/api/features"
import { POPUPS_FLAG } from "@/features/popups/api/types"

/**
 * Its children while the shop has pop-ups on (adr/0080 §5); off, one
 * sentence says so (the records are kept) and the owner or admin is
 * offered the switch in Ayarlar > Özellikler. The API answers 404 while off.
 */
export function PopupsGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const on = useFeatureState(POPUPS_FLAG)
  const canTurnOn = useCan("settings")
  if (on === undefined) {
    return <LoadingRows rows={6} />
  }
  if (on) {
    return children
  }
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center shadow-card">
      <AppWindow className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-md text-sm text-muted-foreground">{t("popups.gate.off")}</p>
      {canTurnOn ? (
        <Button asChild variant="outline">
          <Link to="/settings/features">{t("popups.gate.turnOn")}</Link>
        </Button>
      ) : null}
    </section>
  )
}
