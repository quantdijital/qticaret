import type { JSONContent } from "@tiptap/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
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
}

/**
 * A text in the editor, saved as a whole (adr/0019). What was typed while
 * a save ran stays a change to save; an untouched text is never "changed".
 */
export function DocumentCard({ title, description, stored, saving, save }: DocumentCardProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<JSONContent | null>(null)
  const dirty = draft !== null && !sameDoc(draft, stored)
  return (
    <CardForm
      title={title}
      description={description}
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
        <RichEditor value={draft ?? stored} onChange={setDraft} label={title} />
      </div>
    </CardForm>
  )
}
