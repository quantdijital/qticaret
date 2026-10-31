import { Link } from "@tanstack/react-router"
import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"

/** Stock is kept at the store's default warehouse: without one there is nowhere to write it. */
export function NoLocationNotice() {
  const { t } = useTranslation()
  return (
    <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2.5 text-[13px] text-warning-text">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {t("inventory.noLocation")}{" "}
        <Link
          to="/settings/shipping"
          search={{ part: "locations" }}
          className="font-medium underline underline-offset-2"
        >
          {t("inventory.addLocation")}
        </Link>
      </span>
    </p>
  )
}
