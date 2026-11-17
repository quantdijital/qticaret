import { useQuery } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@qticaret/admin-ui/ui/popover"
import { aiServicesQuery } from "@/features/ai/api/ai"
import type { AiEntity } from "@/features/ai/api/suggestions"
import { AiConnectHint } from "@/features/ai/components/ai-connect-hint"
import { AiServicePicker } from "@/features/ai/components/ai-service-picker"
import { AiSuggestionBox } from "@/features/ai/components/ai-suggestion-box"
import { hintClosed } from "@/features/ai/hint-state"
import { useAiSuggestion } from "@/features/ai/use-ai-suggestion"

export interface AiButtonProps {
  /** The job, not the capability (`seo_title`): which service runs it is the backend's call. */
  task: string
  entity: AiEntity
  /** Gets the accepted text for the form; the form saves it, or not, as its own change. */
  onUse: (text: string) => void
  /** The ready options to offer, a subset of the task's; left out: the task's own. */
  options?: readonly string[]
  /** The button's size: `icon` stands level with a 36px field beside it (docs/18 §2). */
  size?: "icon-sm" | "icon"
  /** The button's name when a form has more than one ("Başlık için…"); left out: the shared one. */
  label?: string
}

/**
 * The AI button beside a field (adr/0071 §13): one click asks for a
 * suggestion in a small layer, no page, no prompt to write. Several usable
 * services add a picker; with none the same button opens the connect hint; a role
 * the task does not allow draws nothing. Nothing is saved: "Kullan" hands
 * the text to `onUse`.
 */
export function AiButton({ task, entity, onUse, options, size = "icon-sm", label }: AiButtonProps) {
  const { t } = useTranslation()
  const name = label ?? t("ai.suggest.button")
  const services = useQuery(aiServicesQuery())
  const view = services.data?.tasks.find((each) => each.id === task)
  const usable = view?.usable ?? []
  const several = usable.length > 1
  const remembered = view?.preference && usable.includes(view.preference) ? view.preference : null
  const [picked, setPicked] = useState<string | null>(null)
  const service = picked && usable.includes(picked) ? picked : (remembered ?? usable[0] ?? "")
  const offered = (options ?? view?.options ?? []).filter((each) =>
    (view?.options ?? []).includes(each)
  )
  const [option, setOption] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const suggestion = useAiSuggestion(task, entity)
  const [hintGone, setHintGone] = useState(hintClosed)

  if (!view?.allowed) {
    return null
  }
  const trigger = (
    <PopoverTrigger asChild>
      <Button type="button" variant="ghost" size={size} aria-label={name} title={name}>
        <Sparkles />
      </Button>
    </PopoverTrigger>
  )
  // No service: the same button in the same place says how to get one; closed for good, it goes
  if (usable.length === 0) {
    return hintGone ? null : (
      <Popover open={open} onOpenChange={setOpen}>
        {trigger}
        <PopoverContent align="end" aria-label={name} className="w-72 max-w-[calc(100vw-2rem)]">
          <AiConnectHint
            onClose={() => {
              setOpen(false)
              setHintGone(true)
            }}
          />
        </PopoverContent>
      </Popover>
    )
  }

  const ask = (next: { service?: string; option?: string | undefined }) => {
    const chosen = next.service ?? service
    void suggestion.request({
      // With one service the backend picks it; the name is sent only when there was a choice
      ...(several ? { service: chosen } : {}),
      ...(next.option === undefined ? {} : { option: next.option }),
    })
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      ask({ option })
    } else {
      suggestion.dismiss()
    }
  }

  const use = async () => {
    const text = await suggestion.accept()
    setOpen(false)
    if (text !== null) {
      onUse(text)
    }
  }

  const tryWith = (id: string) => {
    if (usable.includes(id)) {
      setPicked(id)
    }
    void suggestion.tryWith(id)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {trigger}
      <PopoverContent
        align="end"
        aria-label={name}
        className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3"
      >
        <AiServicePicker
          services={usable}
          value={service}
          disabled={suggestion.state.status === "loading"}
          onChange={(id) => {
            setPicked(id)
            ask({ service: id, option })
          }}
        />
        <AiSuggestionBox
          state={suggestion.state}
          options={offered}
          option={option}
          onOption={(next) => {
            setOption(next)
            ask({ option: next })
          }}
          onUse={() => void use()}
          onRetry={() => {
            ask({ option })
          }}
          onTryWith={tryWith}
          onDismiss={() => {
            onOpenChange(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
