import { Link } from "@tanstack/react-router"
import { Ban, Lock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { useCan, usePlanStatus } from "@/features/auth/api/staff"

/** The strip's id, for a button its status holds back to point to (`aria-describedby`). */
export const PLAN_STRIP_ID = "plan-status-strip"

/**
 * Above every page while the shop is restricted or suspended (adr/0061
 * §5.5, Ek C15): what is closed, what stays open and what to do. Every
 * role sees it (the status comes with `staff/me`); the owner and admins,
 * who may read the plan, get the way to Ayarlar > Abonelik, the others
 * are told to ask the owner.
 */
export function PlanStatusBanner() {
  const { t } = useTranslation()
  const status = usePlanStatus()
  const readsPlan = useCan("settings")
  if (status === "active") {
    return null
  }
  const suspended = status === "suspended"
  const Icon = suspended ? Ban : Lock
  return (
    <div
      id={PLAN_STRIP_ID}
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-[13px] lg:px-[var(--page-padding-wide)]",
        suspended
          ? "border-destructive bg-destructive-soft text-destructive-text"
          : "border-warning bg-warning-soft text-warning-text"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 font-medium">
        {t(`plan.strip.${status}`)}
        {readsPlan ? null : ` ${t("plan.strip.askOwner")}`}
      </span>
      {readsPlan ? (
        <Link to="/settings/subscription" className="font-medium underline underline-offset-4">
          {t("plan.view")}
        </Link>
      ) : null}
    </div>
  )
}
