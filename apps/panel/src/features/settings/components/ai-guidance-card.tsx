import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import {
  AI_ADDRESSES,
  AI_TONES,
  GUIDANCE_LIMITS,
  overLimit,
  useSaveAiGuidance,
} from "@/features/ai/api/guidance"
import type { AiAddress, AiGuidanceSettings, AiTone } from "@/features/ai/api/guidance"
import { GuidanceText } from "@/features/settings/components/ai-guidance-text"
import { GuidanceWords } from "@/features/settings/components/ai-guidance-words"
import { errorText } from "@/lib/errors"

const C = "ai.guidance"

interface Draft {
  tone: AiTone
  address: AiAddress
  audience: string
  guide: string
  prefer: string[]
  avoid: string[]
}

/** The card's part of the setting as a save sends it (and "Dene" tries it). */
const sentOf = (draft: Draft): Pick<AiGuidanceSettings, keyof Draft> => ({
  tone: draft.tone,
  address: draft.address,
  audience: draft.audience.trim() || null,
  guide: draft.guide.trim() || null,
  prefer: draft.prefer,
  avoid: draft.avoid,
})

const draftOf = (saved: AiGuidanceSettings): Draft => ({
  tone: saved.tone,
  address: saved.address,
  audience: saved.audience ?? "",
  guide: saved.guide ?? "",
  prefer: saved.prefer,
  avoid: saved.avoid,
})

/**
 * Settings › Yapay zekâ › Yazım yönergesi (adr/0074 §2), the shop-wide
 * part: tone and address on top (a choice with its default, not a
 * question), the audience, the free guidance and the word lists. One
 * card, one save; empty fields are not sent to the AI. Owner and admin
 * change it (`mayChange`); others read it.
 */
export function AiGuidanceCard({
  saved,
  mayChange,
  onDraft,
}: {
  saved: AiGuidanceSettings
  mayChange: boolean
  /** The card's values as they stand, saved or not (for "Dene"). */
  onDraft?: ((values: Pick<AiGuidanceSettings, keyof Draft>) => void) | undefined
}) {
  const { t } = useTranslation()
  const save = useSaveAiGuidance()
  const toneId = useId()
  const [draft, setDraft] = useState(() => draftOf(saved))
  const [base, setBase] = useState(saved)
  // A save elsewhere (the tasks card) answers with the whole section: followed when untouched
  if (base !== saved) {
    setBase(saved)
    if (JSON.stringify(draft) === JSON.stringify(draftOf(base))) {
      setDraft(draftOf(saved))
    }
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(saved))
  useEffect(() => {
    onDraft?.(sentOf(draft))
  }, [draft, onDraft])
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }
  const off = !mayChange || save.isPending

  const submit = () => {
    if (
      overLimit(draft.audience, GUIDANCE_LIMITS.audience) ||
      overLimit(draft.guide, GUIDANCE_LIMITS.guide)
    ) {
      return
    }
    save.mutate(sentOf(draft), {
      // As the server kept it (personal data taken out, spaces folded)
      onSuccess: (result) => {
        setDraft(draftOf(result.values))
        toast.success(t("settings.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }

  return (
    <CardForm
      title={t(`${C}.title`)}
      description={t(mayChange ? `${C}.description` : `${C}.readOnly`)}
      dirty={dirty}
      saving={save.isPending}
      onSubmit={submit}
      onReset={() => {
        setDraft(draftOf(saved))
      }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t(`${C}.tone`)} htmlFor={toneId} hint={t(`${C}.toneHints.${draft.tone}`)}>
          <Select
            value={draft.tone}
            disabled={off}
            onValueChange={(next) => {
              set("tone", next as AiTone)
            }}
          >
            <SelectTrigger id={toneId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_TONES.map((tone) => (
                <SelectItem key={tone} value={tone}>
                  {t(`${C}.tones.${tone}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t(`${C}.address`)} hint={t(`${C}.addressHint`)}>
          <RadioGroup
            value={draft.address}
            disabled={off}
            aria-label={t(`${C}.address`)}
            onValueChange={(next) => {
              set("address", next as AiAddress)
            }}
            className="grid grid-cols-3 gap-2"
          >
            {AI_ADDRESSES.map((address) => (
              <label
                key={address}
                className="flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
              >
                <RadioGroupItem value={address} />
                <span className="truncate">{t(`${C}.addresses.${address}`)}</span>
              </label>
            ))}
          </RadioGroup>
        </Field>
      </div>
      <GuidanceText
        label={t(`${C}.audience`)}
        value={draft.audience}
        max={GUIDANCE_LIMITS.audience}
        placeholder={t(`${C}.audiencePlaceholder`)}
        disabled={off}
        onChange={(next) => {
          set("audience", next)
        }}
      />
      <GuidanceText
        label={t(`${C}.guide`)}
        value={draft.guide}
        max={GUIDANCE_LIMITS.guide}
        rows={5}
        placeholder={t(`${C}.guidePlaceholder`)}
        hint={`${t(`${C}.guideHint`)} ${t(`${C}.privacy`)}`}
        disabled={off}
        onChange={(next) => {
          set("guide", next)
        }}
      />
      <div className="grid gap-5 md:grid-cols-2">
        <GuidanceWords
          label={t(`${C}.prefer`)}
          words={draft.prefer}
          disabled={off}
          onChange={(next) => {
            set("prefer", next)
          }}
        />
        <GuidanceWords
          label={t(`${C}.avoid`)}
          words={draft.avoid}
          disabled={off}
          onChange={(next) => {
            set("avoid", next)
          }}
        />
      </div>
    </CardForm>
  )
}
