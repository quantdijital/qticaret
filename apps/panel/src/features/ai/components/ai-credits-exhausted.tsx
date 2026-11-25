import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useStaff } from "@/features/auth/api/staff"

/**
 * What to do when the platform's credits ran out (`ai.credits_exhausted`,
 * adr/0085 §5): the owner tops up in place ("Kredi yükle" opens the
 * dialog, where the caller hosts it); anyone else is told to let the owner
 * know. Drawn under the failure's own sentence.
 */
export function AiCreditsExhausted({ onTopUp }: { onTopUp?: (() => void) | undefined }) {
  const { t } = useTranslation()
  const role = useStaff()?.role
  if (role === undefined) {
    return null
  }
  if (role !== "owner") {
    return <p className="text-xs text-muted-foreground">{t("ai.credits.tellOwner")}</p>
  }
  return onTopUp ? (
    <Button type="button" size="sm" className="self-start" onClick={onTopUp}>
      {t("ai.credits.topUp")}
    </Button>
  ) : null
}
