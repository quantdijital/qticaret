import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Layers } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { staffQuery } from "@/features/auth/api/staff"
import { useFeatureState } from "@/features/settings/api/features"
import { COLLECTIONS_FLAG } from "@/features/collections/api/flag"

/**
 * Its children while the shop has collections on; off, one sentence says
 * so (the records are kept) and the owner or admin is offered the switch
 * in Ayarlar > Özellikler. The API refuses collection writes while off.
 */
export function CollectionsGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const on = useFeatureState(COLLECTIONS_FLAG)
  const staff = useQuery(staffQuery())
  if (on === undefined) {
    return <LoadingRows rows={6} />
  }
  if (on) {
    return children
  }
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center shadow-card">
      <Layers className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-md text-sm text-muted-foreground">{t("collections.gate.off")}</p>
      {staff.data?.can.settings ? (
        <Button asChild variant="outline">
          <Link to="/settings/features">{t("collections.gate.turnOn")}</Link>
        </Button>
      ) : null}
    </section>
  )
}
