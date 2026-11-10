import type { JSONContent } from "@tiptap/react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { LeaveGuard } from "@qticaret/admin-ui/patterns/leave-guard"
import { Input } from "@qticaret/admin-ui/ui/input"
import { sameDoc } from "@/features/content/editor/normalize"
import { RichEditor } from "@/features/content/editor/rich-editor"
import { useSaveLegalDraft } from "@/features/legal/api"
import type { LegalKind } from "@/features/legal/api"
import { errorText } from "@/lib/errors"

const E = "settings.legal.editor"

/**
 * The text being written: the draft, or the published text to start a new
 * version from. Saving keeps it as the draft; customers see it only once
 * it is published. Whether it holds unsaved changes goes up to the page,
 * which asks before dropping or restarting the draft would lose them.
 */
export function LegalEditorCard({
  kind,
  stored,
  isDraft,
  onDirtyChange,
}: {
  kind: LegalKind
  stored: { title: string; body: JSONContent }
  /** Whether `stored` is the draft (else the published text a save starts a draft from). */
  isDraft: boolean
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const save = useSaveLegalDraft(kind)
  const [title, setTitle] = useState<string | null>(null)
  const [body, setBody] = useState<JSONContent | null>(null)
  const dirty =
    (title !== null && title !== stored.title) || (body !== null && !sameDoc(body, stored.body))
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  // Replaced (another version, a reset) or gone: nothing of it is left unsaved
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])
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
      <LeaveGuard when={dirty && !save.isPending} />
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
