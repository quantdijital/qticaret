import { useNavigate } from "@tanstack/react-router"
import { CornerDownRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PANEL_MAP, trailOf } from "@/features/panel-map/map"
import type { PanelScreen } from "@/features/panel-map/map"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { AssistantMessage as Message } from "./api"
import { replyParts } from "./reply-parts"

const BY_KEY: ReadonlyMap<string, PanelScreen> = new Map(
  PANEL_MAP.map((screen) => [screen.key, screen])
)

/**
 * One message of the conversation (adr/0079 §7, §9). The words are text
 * nodes, never markup: a reply's Markdown, HTML or address shows as the
 * characters it is. A screen the reply names among its `screens` is a
 * "Götür" chip that opens it with the panel's own router; the panel
 * stays open.
 */
export function AssistantMessageView({ message }: { message: Message }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap break-words">
          <span className="sr-only">{t("ai.assistant.you")}: </span>
          {message.text}
        </p>
      </div>
    )
  }
  const parts = replyParts(message.text, message.screens ?? [], (key) => BY_KEY.has(key))
  return (
    <div className="text-sm leading-6 whitespace-pre-wrap break-words">
      <span className="sr-only">{t("ai.assistant.title")}: </span>
      {parts.map((part, index) => {
        if (part.kind === "text") {
          return <span key={index}>{part.text}</span>
        }
        const screen = BY_KEY.get(part.screen.key)
        if (!screen) {
          return null
        }
        const name = [...trailOf(screen), screen].map((each) => t(each.label)).join(" › ")
        return (
          <button
            key={index}
            type="button"
            aria-label={t("ai.assistant.go", { name })}
            onClick={() => {
              void navigate({
                to: screen.path,
                ...(screen.search ? { search: screen.search } : {}),
              })
            }}
            className={cn(
              "mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border bg-background px-2 py-0.5 align-baseline text-[13px] font-medium text-primary-text",
              "transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            )}
          >
            <CornerDownRight aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{name}</span>
          </button>
        )
      })}
    </div>
  )
}
