import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { aiCreditsQuery } from "@/features/ai/api/credits"
import { useStaff } from "@/features/auth/api/staff"

/**
 * What to do when the platform's credits ran out (`ai.credits_exhausted`,
 * adr/0085 §5): the owner tops up in place ("Kredi yükle" opens the
 * dialog, where the caller hosts it), or, a request already open, is told
 * it is on its way; anyone else is told to let the owner know. Drawn under
 * the failure's own sentence.
 */
export function AiCreditsExhausted({ onTopUp }: { onTopUp?: (() => void) | undefined }) {
  const { t } = useTranslation()
  const role = useStaff()?.role
  const owner = role === "owner"
  // The wallet the button already read (the same key); unread, the button stays and
  // the server's `ai.credits_order_open` says the rest
  const wallet = useQuery({
    ...aiCreditsQuery(),
    enabled: owner && onTopUp !== undefined,
    retry: false,
  }).data
  if (role === undefined) {
    return null
  }
  if (!owner) {
    return <p className="text-xs text-muted-foreground">{t("ai.credits.tellOwner")}</p>
  }
  if (wallet?.available && wallet.pending_order !== null) {
    return (
      <p className="text-xs text-muted-foreground" data-slot="ai-credit-pending">
        {t("ai.credits.pendingWait")}
      </p>
    )
  }
  return onTopUp ? (
    <Button type="button" size="sm" className="self-start" onClick={onTopUp}>
      {t("ai.credits.topUp")}
    </Button>
  ) : null
}
