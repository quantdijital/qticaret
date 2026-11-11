import { Link } from "@tanstack/react-router"
import { Gauge } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertAction, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { useLimitStanding } from "@/features/settings/api/plan"
import { noticeKey, toneOf } from "@/features/settings/plan-rules"
import type { NoticedLimit } from "@/features/settings/plan-rules"

/**
 * A small notice on the screen a limit belongs to (adr/0061 §5.3, Ek C14):
 * from 80 % "you are near it (x/y)", at a blocking limit what stops and
 * what does not, past the month's orders that they keep coming. It links
 * to Settings > Abonelik. Nothing below 80 %, nothing for a role that may
 * not read the plan, nothing in a shop without one.
 */
export function LimitNotice({
  limit,
  id,
  className,
}: {
  limit: NoticedLimit
  /** For a control the limit holds back to point to (`aria-describedby`). */
  id?: string
  className?: string
}) {
  const { t } = useTranslation()
  const standing = useLimitStanding(limit)
  const key = standing ? noticeKey(limit, standing) : null
  if (!standing || key === null) {
    return null
  }
  const full = toneOf(standing) === "full"
  return (
    <Alert
      id={id}
      role="status"
      className={cn(
        full
          ? "border-destructive/40 [&>svg]:text-destructive"
          : "border-warning/40 [&>svg]:text-warning-text",
        className
      )}
    >
      <Gauge aria-hidden="true" />
      <AlertDescription className="text-foreground">
        {t(key, { used: standing.used ?? 0, max: standing.max ?? 0 })}
      </AlertDescription>
      <AlertAction>
        <Button asChild size="sm" variant="outline">
          <Link to="/settings/subscription">{t("plan.view")}</Link>
        </Button>
      </AlertAction>
    </Alert>
  )
}
