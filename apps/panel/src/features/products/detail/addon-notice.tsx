import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"

interface AddonNoticeProps {
  text: string
  /** Links to Settings > Features, where the shop turns add-ons on. */
  features: boolean
  /** A refused save is an alert; the flag being off is a standing note. */
  tone: "danger" | "warning"
}

/** A line in the add-ons card or sheet, with where to turn add-ons on when that is the cause. */
export function AddonNotice({ text, features, tone }: AddonNoticeProps) {
  const { t } = useTranslation()
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md px-3 py-2 text-[13px]",
        tone === "danger"
          ? "bg-destructive-soft text-destructive-text"
          : "bg-warning-soft text-warning-text"
      )}
    >
      <span>{text}</span>
      {features ? (
        <Link to="/settings/features" className="font-medium underline underline-offset-4">
          {t("products.addons.features")}
        </Link>
      ) : null}
    </p>
  )
}
