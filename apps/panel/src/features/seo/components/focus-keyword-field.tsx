import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChipInput } from "@qticaret/admin-ui/patterns/chip-input"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { AiButton } from "@/features/ai/components/ai-button"
import type { SeoEntityType } from "@/features/seo/api/seo-meta"
import {
  FOCUS_KEYWORDS_MAX,
  FOCUS_KEYWORD_LENGTH,
  addFocusKeywords,
  formatFocusKeywords,
  makePrimary,
  parseFocusKeywords,
  withSuggested,
} from "@/features/seo/focus-keywords"
import type { FocusKeywordNote } from "@/features/seo/focus-keywords"
import { aiEntityOf } from "./ai-entity"

const folded = (keyword: string) => keyword.toLocaleLowerCase("tr")

/**
 * The page's focus keywords as chips (docs/13 §3, docs/14 KW-01): typed,
 * then Enter, a comma or leaving the field makes a chip; a pasted "a, b, c"
 * is three. The first is the primary ("Ana"); another one's text makes it
 * the primary. Five at most, each 60 characters: past that a line says so,
 * the save is never refused. Where the AI core writes for the record, its
 * button adds the picked keyword (the primary when there is none), or all
 * of its candidates. The value stays the one text the server keeps.
 */
export function FocusKeywordField({
  type,
  id,
  value,
  onChange,
}: {
  type: SeoEntityType
  id: string
  value: string
  onChange: (next: string) => void
}) {
  const { t } = useTranslation()
  const entity = aiEntityOf(type, id)
  const keywords = parseFocusKeywords(value)
  const [text, setText] = useState("")
  const [note, setNote] = useState<FocusKeywordNote>(null)
  const noteId = `seo-keyword-note-${id}`

  const change = (next: readonly string[]) => {
    const formatted = formatFocusKeywords(next)
    if (formatted !== formatFocusKeywords(keywords)) {
      onChange(formatted)
    }
  }
  const commit = (typed: string) => {
    if (typed.trim() !== "") {
      const added = addFocusKeywords(keywords, typed)
      change(added.keywords)
      setNote(added.note)
    }
    setText("")
  }
  const suggested = (candidates: readonly string[]) => {
    change(candidates.reduce<string[]>((list, each) => withSuggested(list, each), keywords))
  }

  const field = (
    <ChipInput
      id={`seo-keyword-${id}`}
      chips={keywords.map((keyword) => ({ key: folded(keyword), label: keyword }))}
      text={text}
      onTextChange={(next) => {
        // A pasted list becomes its chips at once; a comma typed is caught as a key
        if (next.includes(",")) {
          commit(next)
        } else {
          setText(next)
          setNote(null)
        }
      }}
      onCommit={() => {
        commit(text)
      }}
      onRemove={(index) => {
        change(keywords.filter((_, at) => at !== index))
        setNote(null)
      }}
      removeLabel={(keyword) => t("seo.card.keywords.remove", { keyword })}
      primaryLabel={keywords.length > 1 ? t("seo.card.keywords.primary") : undefined}
      onMakePrimary={(index) => {
        change(makePrimary(keywords, index))
      }}
      makePrimaryLabel={(keyword) => t("seo.card.keywords.makePrimary", { keyword })}
      placeholder={
        keywords.length < FOCUS_KEYWORDS_MAX ? t("seo.card.keywords.placeholder") : undefined
      }
      aria-describedby={note ? noteId : undefined}
      className="min-w-0 flex-1"
    />
  )

  return (
    <Field
      label={t("seo.card.focusKeyword")}
      htmlFor={`seo-keyword-${id}`}
      hint={t("seo.card.focusKeywordHint")}
    >
      <div className="flex flex-col gap-1">
        {entity ? (
          <div className="flex items-start gap-1.5">
            {field}
            <AiButton
              task="focus_keyword"
              entity={entity}
              size="icon"
              label={t("seo.card.aiKeyword")}
              onUse={(keyword) => {
                suggested([keyword])
              }}
              onUseAll={suggested}
            />
          </div>
        ) : (
          field
        )}
        {note ? (
          <p id={noteId} role="status" className="text-xs text-warning-text">
            {t(`seo.card.keywords.${note}`, {
              max: FOCUS_KEYWORDS_MAX,
              length: FOCUS_KEYWORD_LENGTH,
            })}
          </p>
        ) : null}
      </div>
    </Field>
  )
}
