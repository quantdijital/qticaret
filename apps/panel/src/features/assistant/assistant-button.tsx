import { Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Kbd, KbdGroup } from "@qticaret/admin-ui/ui/kbd"
import { useAssistant } from "./assistant-state"

/** The top bar's ✨ "Yardımcı" (adr/0079 §9): opens and closes the panel, as ⌘J does; none with the flag off. */
export function AssistantButton() {
  const { t } = useTranslation()
  const assistant = useAssistant()
  if (!assistant.enabled) {
    return null
  }
  return (
    <Button
      type="button"
      variant={assistant.open ? "secondary" : "outline"}
      className="h-9"
      aria-pressed={assistant.open}
      aria-keyshortcuts="Meta+J Control+J"
      onClick={assistant.toggle}
    >
      <Sparkles aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{t("ai.assistant.open")}</span>
      <KbdGroup className="hidden lg:inline-flex" aria-hidden="true">
        <Kbd>⌘</Kbd>
        <Kbd>J</Kbd>
      </KbdGroup>
    </Button>
  )
}
