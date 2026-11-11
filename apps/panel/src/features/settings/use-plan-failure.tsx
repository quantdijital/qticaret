import { useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PLAN_KEY } from "@/features/settings/api/plan"
import { errorText } from "@/lib/errors"

/** The backend's key for a write past the package's limit (adr/0061 Ek C14). */
export const PLAN_LIMIT_REACHED = "plan.limit_reached"

/**
 * A write the package refused. Through the SDK only the status and the
 * backend's sentence survive (it names the limit and Ayarlar > Abonelik);
 * a `fetch` answer keeps the key. On the screens that call this (a new
 * product, a copy, an invitation, a draft), a 403 to someone allowed to
 * make the write is the plan's answer.
 */
export function isPlanRefusal(failure: unknown): boolean {
  const { status, code } = (failure ?? {}) as { status?: unknown; code?: unknown }
  return code === PLAN_LIMIT_REACHED || (status === 403 && (code === undefined || code === null))
}

/**
 * A failed write's toast: the backend's sentence, and for a plan refusal a
 * link to Settings > Abonelik and the screen's limit notice brought up to
 * date (its count is refetched).
 */
export function usePlanFailureToast(): (failure: unknown) => void {
  const { t } = useTranslation()
  const client = useQueryClient()
  return (failure) => {
    if (!isPlanRefusal(failure)) {
      toast.error(errorText(t, failure))
      return
    }
    void client.invalidateQueries({ queryKey: PLAN_KEY })
    toast.error(errorText(t, failure), {
      action: (
        <Link to="/settings/subscription" className="text-sm font-medium underline">
          {t("plan.view")}
        </Link>
      ),
    })
  }
}
