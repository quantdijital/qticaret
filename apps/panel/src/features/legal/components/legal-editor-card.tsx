import type { JSONContent } from "@tiptap/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Field } from "@/components/patterns/form-section"
import { Input } from "@/components/ui/input"
import { sameDoc } from "@/features/content/editor/normalize"
import { RichEditor } from "@/features/content/editor/rich-editor"
import { useSaveLegalDraft } from "@/features/legal/api"
import type { LegalKind } from "@/features/legal/api"
import { errorText } from "@/lib/errors"

const E = "settings.legal.editor"

/**
 * The text being written: the draft, or the published text to start a new
 * version from. Saving keeps it as the draft; customers see it only once
 * it is published.
 */
export function LegalEditorCard({
  kind,
  stored,
  isDraft,
}: {
  kind: LegalKind
  stored: { title: string; body: JSONContent }
  /** Whether `stored` is the draft (else the published text a save starts a draft from). */
  isDraft: boolean
}) {
  const { t } = useTranslation()
  const save = useSaveLegalDraft(kind)
  const [title, setTitle] = useState<string | null>(null)
  const [body, setBody] = useState<JSONContent | null>(null)
  const dirty =
    (title !== null && title !== stored.title) || (body !== null && !sameDoc(body, stored.body))
  return (
    <CardForm
      title={t(`${E}.title`)}
      description={t(isDraft ? `${E}.draftHint` : `${E}.publishedHint`)}
      dirty={dirty}
      saving={save.isPending}
      onSubmit={() => {
        save.mutate(
          { title: (title ?? stored.title).trim(), body: body ?? stored.body },
          {
            onSuccess: () => {
              setTitle(null)
              setBody(null)
              toast.success(t(`${E}.saved`))
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
      onReset={() => {
        setTitle(null)
        setBody(null)
      }}
    >
      <Field label={t(`${E}.titleLabel`)} htmlFor="legal-title">
        <Input
          id="legal-title"
          maxLength={200}
          value={title ?? stored.title}
          onChange={(event) => {
            setTitle(event.target.value)
          }}
        />
      </Field>
      <div className="-mx-5 -mb-1">
        <RichEditor value={body ?? stored.body} onChange={setBody} label={t(`${E}.body`)} />
      </div>
    </CardForm>
  )
}
