import { Link } from "@tanstack/react-router"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCan } from "@/features/auth/api/staff"
import { closeHint } from "@/features/ai/hint-state"

export interface AiConnectHintProps {
  /** Called once the tip is closed for good (remembered in the browser). */
  onClose: () => void
  /** The words for a job that fills no field (`ai.background.hint`): `text` and `ownerOnly` keys under it. */
  words?: string
}

/**
 * What the AI button says when no service can do the task (adr/0071
 * §13): one quiet sentence, closable for good. The owner gets "Bağla" to
 * Settings › Yapay zekâ; anyone else hears that the store owner can
 * connect one.
 */
export function AiConnectHint({ onClose, words = "ai.hint" }: AiConnectHintProps) {
  const { t } = useTranslation()
  const mayConnect = useCan("accounts")
  return (
    <div className="flex items-start gap-2 text-sm" data-slot="ai-connect-hint">
      <p className="min-w-0 flex-1">
        {mayConnect ? t(`${words}.text`) : t(`${words}.ownerOnly`)}
        {mayConnect ? (
          <>
            {" "}
            <Link
              to="/settings/ai"
              className="font-medium text-primary-text underline-offset-4 hover:underline"
            >
              {t("ai.hint.connect")}
            </Link>
          </>
        ) : null}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("ai.hint.close")}
        onClick={() => {
          closeHint()
          onClose()
        }}
      >
        <X />
      </Button>
    </div>
  )
}
