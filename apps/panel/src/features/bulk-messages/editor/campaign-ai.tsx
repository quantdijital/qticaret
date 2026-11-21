import { useQuery } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
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
import { ToggleGroup, ToggleGroupItem } from "@qticaret/admin-ui/ui/toggle-group"
import { aiServicesQuery } from "@/features/ai/api/ai"
import type { AiSuggestion } from "@/features/ai/api/suggestions"
import { AiConnectHint } from "@/features/ai/components/ai-connect-hint"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { AiSuggestionBox } from "@/features/ai/components/ai-suggestion-box"
import { hintClosed } from "@/features/ai/hint-state"
import { useAiSuggestion } from "@/features/ai/use-ai-suggestion"

const A = "bulkMessages.ai"

export interface CampaignAiProps {
  task: "campaign_email" | "campaign_sms"
  campaignId: string
  /** Unsaved changes in the editor: the words are written from what is saved, said in the dialog. */
  dirty: boolean
  /** The field holds words "Kullan" would replace: asked once more first. */
  filled: boolean
  /** The suggestion as shown; none: the box's own (a text's candidates). */
  preview?: ((suggestion: AiSuggestion) => ReactNode) | undefined
  /** Gets what was taken: the candidate picked (a text) and whether the field's words go. */
  onUse: (suggestion: AiSuggestion, candidate: string | undefined, replace: boolean) => void
  /** The pick's place when the choices are inside the one text (an e-mail's subject lines). */
  acceptIndex?: ((suggestion: AiSuggestion) => number | undefined) | undefined
  /** The confirmation: its sentence, the replacing button and, when there is one, keeping the field. */
  confirm: { text: string; replace: string; keep?: string | undefined }
}

/**
 * "Yapay zekâ ile öner" on a bulk message (adr/0074 §5 madde 6): the
 * purpose is picked first (a closed list; none: a general message), then
 * the words come from the saved campaign, read on the server; nothing is
 * typed and nothing is saved. Drawn only for a role the task allows.
 */
export function CampaignAi(props: CampaignAiProps) {
  const { task, campaignId, dirty, filled, preview, onUse, acceptIndex, confirm } = props
  const { t } = useTranslation()
  const services = useQuery(aiServicesQuery())
  const view = services.data?.tasks.find((each) => each.id === task)
  const usable = view?.usable ?? []
  const remembered = view?.preference && usable.includes(view.preference) ? view.preference : null
  const [picked, setPicked] = useState<string | null>(null)
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")
  const [option, setOption] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState<{ candidate: string | undefined } | null>(null)
  const [hintGone, setHintGone] = useState(hintClosed)
  const suggestion = useAiSuggestion(task, { type: "campaign", id: campaignId })
  const { state } = suggestion

  if (!view?.allowed || (usable.length === 0 && hintGone)) {
    return null
  }

  const ask = (next: { service?: string; option?: string | undefined }) => {
    setConfirming(null)
    void suggestion.request({
      ...(usable.length > 1 ? { service: next.service ?? service } : {}),
      ...(next.option === undefined ? {} : { option: next.option }),
    })
  }

  const close = () => {
    setOpen(false)
    setConfirming(null)
    suggestion.dismiss()
  }

  const take = async (candidate: string | undefined, replace: boolean) => {
    if (state.status !== "suggestion") {
      return
    }
    const taken = state.suggestion
    setConfirming(null)
    setOpen(false)
    await suggestion.accept(candidate, acceptIndex?.(taken))
    onUse(taken, candidate, replace)
  }

  const use = (candidate?: string) => {
    if (filled) {
      setConfirming({ candidate })
      return
    }
    void take(candidate, true)
  }

  const started = state.status !== "idle"

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(true)
        }}
      >
        <Sparkles />
        {t(`${A}.button`)}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            close()
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t(`${A}.${task}.title`)}</DialogTitle>
            <DialogDescription>{t(`${A}.${task}.description`)}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            {dirty ? <p className="text-xs text-warning-text">{t(`${A}.dirty`)}</p> : null}
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
                <p className="text-sm">{confirm.text}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void take(confirming.candidate, true)}
                  >
                    {confirm.replace}
                  </Button>
                  {confirm.keep ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void take(confirming.candidate, false)}
                    >
                      {confirm.keep}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="cancel"
                    onClick={() => {
                      setConfirming(null)
                    }}
                  >
                    {t(`${A}.back`)}
                  </Button>
                </div>
              </div>
            ) : !started ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span id={`${task}-purpose`} className="text-sm font-medium">
                    {t(`${A}.purpose`)}
                  </span>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={option ?? ""}
                    aria-labelledby={`${task}-purpose`}
                    onValueChange={(next) => {
                      setOption(next === "" ? undefined : next)
                    }}
                    className="w-full flex-wrap"
                  >
                    {view.options.map((each) => (
                      <ToggleGroupItem key={each} value={each} className="flex-1">
                        {t(`ai.options.${each}`, { defaultValue: each })}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <p className="text-xs text-muted-foreground">{t(`${A}.purposeHint`)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      ask({ option })
                    }}
                  >
                    <Sparkles />
                    {t(`${A}.ask`)}
                  </Button>
                  <Button type="button" size="sm" variant="cancel" onClick={close}>
                    {t("ai.suggest.dismiss")}
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
                  onUse={use}
                  onRetry={() => {
                    ask({ option })
                  }}
                  onTryWith={(id) => {
                    if (usable.includes(id)) {
                      setPicked(id)
                    }
                    void suggestion.tryWith(id)
                  }}
                  onDismiss={close}
                  preview={
                    preview && state.status === "suggestion" ? preview(state.suggestion) : undefined
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
