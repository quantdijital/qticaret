import type { JSONContent } from "@tiptap/react"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { sameDoc } from "@/features/content/editor/normalize"
import { RichEditor } from "@/features/content/editor/rich-editor"
import { errorText } from "@/lib/errors"

interface DocumentCardProps {
  title: string
  description: string
  /** The text as stored. */
  stored: JSONContent
  saving: boolean
  /**
   * Saves the text; resolves once the stored text is the saved one (the
   * caller puts the saved record in its cache), rejects with the failure.
   */
  save: (doc: JSONContent) => Promise<void>
  /** Pictures and cards in the editor; off for a product's description (ADR-0055). */
  media?: boolean
  /** The shop's details menu; only for a text the server fills them in (pages, posts, filter pages). */
  shopTokens?: boolean
  /** A short text: a product's short description (ADR-0055 Ek 2026-11-06), see `RichEditor`. */
  short?: boolean
  /** Characters of text the server takes, counted below the editor. */
  maxChars?: number
  /** The empty editor's hint. */
  placeholder?: string
  /**
   * Right of the title: an action that may put a whole new text in the
   * editor (an AI suggestion, adr/0071 §13). The text is a change like any
   * typed one: the card's Save writes it, Undo drops it. `current` is the
   * text in the editor now (typed and unsaved included).
   */
  action?: ((put: (doc: JSONContent) => void, current: JSONContent) => ReactNode) | undefined
  /** Whether the editor holds an unsaved change: a dialog asks before leaving it. */
  onDirtyChange?: ((dirty: boolean) => void) | undefined
}

/**
 * A text in the editor, saved as a whole (adr/0019). What was typed while
 * a save ran stays a change to save; an untouched text is never "changed".
 */
export function DocumentCard({
  title,
  description,
  stored,
  saving,
  save,
  media = true,
  shopTokens = true,
  short = false,
  maxChars,
  placeholder,
  action,
  onDirtyChange,
}: DocumentCardProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<JSONContent | null>(null)
  const dirty = draft !== null && !sameDoc(draft, stored)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  return (
    <CardForm
      title={title}
      description={description}
      action={action?.(setDraft, draft ?? stored)}
      dirty={dirty}
      saving={saving}
      onSubmit={() => {
        if (!draft) {
          return
        }
        const submitted = draft
        save(submitted).then(
          () => {
            setDraft((current) => (current === submitted ? null : current))
            toast.success(t("content.saved"))
          },
          (failure: unknown) => {
            toast.error(errorText(t, failure))
          }
        )
      }}
      onReset={() => {
        setDraft(null)
      }}
    >
      <div className="-mx-5 -my-1">
        <RichEditor
          value={draft ?? stored}
          onChange={setDraft}
          label={title}
          media={media}
          shopTokens={shopTokens}
          short={short}
          maxChars={maxChars}
          placeholder={placeholder}
        />
      </div>
    </CardForm>
  )
}
