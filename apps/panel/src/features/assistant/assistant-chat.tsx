import { ArrowUp, MessageSquarePlus, Sparkles, X } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { AssistantMessageView } from "./assistant-message"
import { useAssistant } from "./assistant-state"
import { assistantFailureText } from "./failure-text"
import { exampleSetOf } from "./open-screen"

const EXAMPLES = ["one", "two", "three"] as const

interface AssistantChatProps {
  /** The title's element id: the region or dialog is named by it. */
  titleId: string
  /** Mobile: the dialog's own title element. */
  title?: ReactNode
}

/**
 * The conversation (adr/0079 §9): a header with "Yeni sohbet" and close,
 * the messages, three example questions for the open screen while empty,
 * and the box to write in at the bottom with the standing hint about
 * personal data. New messages are read out politely.
 */
export function AssistantChat({ titleId, title }: AssistantChatProps) {
  const { t } = useTranslation()
  const assistant = useAssistant()
  const { messages, pending, error, draft, setDraft, send } = assistant
  const hintId = useId()
  const end = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const set = exampleSetOf(assistant.screen)

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [messages.length, pending, error])

  useEffect(() => {
    box.current?.focus()
  }, [])

  const submit = () => {
    send(draft)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[var(--layout-topbar-height)] shrink-0 items-center gap-1 border-b px-3">
        <Sparkles aria-hidden="true" className="size-4 text-primary-text" />
        {title ?? (
          <h2 id={titleId} className="flex-1 text-[15px] font-semibold">
            {t("ai.assistant.title")}
          </h2>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={messages.length === 0 && !pending}
          onClick={assistant.reset}
        >
          <MessageSquarePlus aria-hidden="true" />
          {t("ai.assistant.newChat")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("ai.assistant.close")}
          onClick={() => {
            assistant.setOpen(false)
          }}
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label={t("ai.assistant.log")}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && !pending ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{t("ai.assistant.emptyTitle")}</p>
              <p className="text-[13px] leading-5 text-muted-foreground">
                {t("ai.assistant.emptyText")}
              </p>
            </div>
            <div
              role="group"
              aria-label={t("ai.assistant.examplesLabel")}
              className="flex flex-col items-start gap-2"
            >
              {EXAMPLES.map((which) => {
                const question = t(`ai.assistant.examples.${set}.${which}`)
                return (
                  <Button
                    key={which}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto max-w-full py-1.5 text-left whitespace-normal"
                    onClick={() => {
                      send(question)
                    }}
                  >
                    {question}
                  </Button>
                )
              })}
            </div>
          </div>
        ) : null}
        {messages.map((message, index) => (
          <AssistantMessageView key={index} message={message} />
        ))}
        {pending ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("ai.assistant.thinking")}
          </p>
        ) : null}
        {error && !pending ? (
          <p className="text-sm text-destructive-text">{assistantFailureText(t, error)}</p>
        ) : null}
        <div ref={end} />
      </div>

      <form
        className="flex shrink-0 flex-col gap-1.5 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            ref={box}
            value={draft}
            rows={2}
            maxLength={2000}
            aria-label={t("ai.assistant.placeholder")}
            aria-describedby={hintId}
            placeholder={t("ai.assistant.placeholder")}
            className="max-h-40 min-h-10 resize-none"
            onChange={(event) => {
              setDraft(event.target.value)
            }}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks the line
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submit()
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            aria-label={t("ai.assistant.send")}
            disabled={pending || draft.trim() === ""}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
        </div>
        <p id={hintId} className="text-xs leading-4 text-muted-foreground">
          {t("ai.assistant.hint")}
        </p>
      </form>
    </div>
  )
}
