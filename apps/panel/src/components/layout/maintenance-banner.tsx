import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Construction } from "lucide-react"
import { useTranslation } from "react-i18next"
import { maintenanceQuery } from "@/features/storefront/api/maintenance"

const B = "storefront.maintenance.banner"

/**
 * Above every page while the storefront is dark (adr/0053): shoppers see
 * the maintenance page, so nobody on the team forgets it is on. The section
 * is asked for once; a save from the panel puts its answer in place.
 */
export function MaintenanceBanner() {
  const { t } = useTranslation()
  const { data } = useQuery(maintenanceQuery())
  if (!data?.values.enabled) {
    return null
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning bg-warning-soft px-4 py-2 text-[13px] text-warning-text lg:px-[var(--page-padding-wide)]"
    >
      <Construction className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 font-medium">{t(`${B}.text`)}</span>
      <Link
        to="/storefront/preferences"
        search={{ part: "maintenance" }}
        className="font-medium underline underline-offset-4"
      >
        {t(`${B}.link`)}
      </Link>
    </div>
  )
}
