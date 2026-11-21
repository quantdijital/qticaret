import { useQuery } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { aiServicesQuery } from "@/features/ai/api/ai"
import { AiConnectHint } from "@/features/ai/components/ai-connect-hint"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { AiSuggestionBox } from "@/features/ai/components/ai-suggestion-box"
import { hintClosed } from "@/features/ai/hint-state"
import type { AiPostDraft } from "@/features/ai/post-draft"
import { useAiSuggestion } from "@/features/ai/use-ai-suggestion"

const TASK = "post_draft"

/** The draft as it will read: its headings and paragraphs as text (never HTML), the links apart. */
export function PostDraftPreview({ draft }: { draft: AiPostDraft }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2" data-slot="ai-post-draft">
      {draft.sections.map((section, index) => (
        <div key={index} className="flex flex-col gap-2">
          {section.heading === "" ? null : section.level === 3 ? (
            <h4 className="pt-1 text-sm font-semibold">{section.heading}</h4>
          ) : (
            <h3 className="pt-2 text-base font-semibold">{section.heading}</h3>
          )}
          {section.paragraphs.map((text, at) => (
            <p key={at}>{text}</p>
          ))}
        </div>
      ))}
      {draft.links.length > 0 ? (
        <div className="mt-2 border-t pt-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("content.postDraft.linksTitle")}
          </p>
          <ul className="mt-1 flex flex-col gap-1 text-xs">
            {draft.links.map((link) => (
              <li key={link.code}>
                <span className="font-medium">{link.name}</span>
                <span className="text-muted-foreground"> · {link.why}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

interface PostDraftAiProps {
  postId: string
  /** Whether the editor holds no text now: the button stands out, and nothing is replaced. */
  empty: boolean
  /** Gets the draft taken: the editor puts it in as an unsaved change. */
  onUse: (draft: AiPostDraft) => void
}

/**
 * "Taslak yaz" above a blog post's editor (adr/0074 §5 madde 5): one click
 * asks for a draft from the post's own title, focus keyword and summary
 * (read on the server, nothing typed), in a dialog with the two ready
 * lengths. "Kullan" on a post with text asks once more before the draft
 * takes its place; either way nothing is saved: the card's Save writes it.
 * Drawn only for a role the task allows.
 */
export function PostDraftAi({ postId, empty, onUse }: PostDraftAiProps) {
  const { t } = useTranslation()
  const services = useQuery(aiServicesQuery())
  const view = services.data?.tasks.find((each) => each.id === TASK)
  const usable = view?.usable ?? []
  const remembered = view?.preference && usable.includes(view.preference) ? view.preference : null
  const [picked, setPicked] = useState<string | null>(null)
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")
  const [option, setOption] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [hintGone, setHintGone] = useState(hintClosed)
  const suggestion = useAiSuggestion(TASK, { type: "post", id: postId })
  const { state } = suggestion

  if (!view?.allowed || (usable.length === 0 && hintGone)) {
    return null
  }

  const ask = (next: { service?: string; option?: string | undefined }) => {
    setConfirming(false)
    void suggestion.request({
      ...(usable.length > 1 ? { service: next.service ?? service } : {}),
      ...(next.option === undefined ? {} : { option: next.option }),
    })
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    setConfirming(false)
    if (next) {
      if (usable.length > 0) {
        ask({ option })
      }
    } else {
      suggestion.dismiss()
    }
  }

  const draft = state.status === "suggestion" ? (state.suggestion.draft ?? null) : null

  const use = async () => {
    if (!draft) {
      return
    }
    if (!empty && !confirming) {
      setConfirming(true)
      return
    }
    await suggestion.accept()
    setOpen(false)
    setConfirming(false)
    onUse(draft)
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={empty ? "default" : "outline"}
        onClick={() => {
          onOpenChange(true)
        }}
      >
        <Sparkles />
        {t("content.postDraft.button")}
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="xl" pane>
          <DialogHeader>
            <DialogTitle>{t("content.postDraft.title")}</DialogTitle>
            <DialogDescription>{t("content.postDraft.description")}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            {usable.length === 0 ? (
              <AiConnectHint
                onClose={() => {
                  setOpen(false)
                  setHintGone(true)
                }}
              />
            ) : confirming ? (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-md border border-destructive/40 p-3"
              >
                <p className="text-sm">{t("content.postDraft.replaceWarning")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void use()}>
                    {t("content.postDraft.replace")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="cancel"
                    onClick={() => {
                      setConfirming(false)
                    }}
                  >
                    {t("content.postDraft.back")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <AiServicePicker
                  services={usable}
                  value={service}
                  disabled={state.status === "loading"}
                  onChange={(id) => {
                    setPicked(id)
                    ask({ service: id, option })
                  }}
                />
                <AiSuggestionBox
                  state={state}
                  options={view.options}
                  option={option}
                  onOption={(next) => {
                    setOption(next)
                    ask({ option: next })
                  }}
                  onUse={() => void use()}
                  onRetry={() => {
                    ask({ option })
                  }}
                  onTryWith={(id) => {
                    if (usable.includes(id)) {
                      setPicked(id)
                    }
                    void suggestion.tryWith(id)
                  }}
                  onDismiss={() => {
                    onOpenChange(false)
                  }}
                  preview={
                    draft ? <PostDraftPreview draft={draft} /> : <p>{t("ai.suggest.refused")}</p>
                  }
                />
              </>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
