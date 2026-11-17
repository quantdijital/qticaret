import { Link } from "@tanstack/react-router"
import { Sparkles, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useCan } from "@/features/auth/api/staff"

/** Where the browser remembers the tip was closed: once closed, it stays closed on every field. */
export const AI_HINT_KEY = "qt.panel.ai.hint.dismissed"

function readClosed(): boolean {
  try {
    return window.localStorage.getItem(AI_HINT_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * In place of the AI button when no service can do the task (adr/0071
 * §13): one quiet line, closable, remembered in the browser. The owner
 * gets "Bağla" to Settings › Yapay zekâ; anyone else hears that the
 * store owner can connect one.
 */
export function AiConnectHint() {
  const { t } = useTranslation()
  const mayConnect = useCan("accounts")
  const [closed, setClosed] = useState(readClosed)
  if (closed) {
    return null
  }
  const close = () => {
    try {
      window.localStorage.setItem(AI_HINT_KEY, "1")
    } catch {
      // A browser that keeps nothing: closed for this visit only
    }
    setClosed(true)
  }
  return (
    <p
      className="flex items-start gap-1.5 text-xs text-muted-foreground"
      data-slot="ai-connect-hint"
    >
      <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        {mayConnect ? t("ai.hint.text") : t("ai.hint.ownerOnly")}
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
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t("ai.hint.close")}
        onClick={close}
        className="-my-1"
      >
        <X />
      </Button>
    </p>
  )
}
