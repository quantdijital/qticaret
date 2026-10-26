import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { contentQuery, useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { sameDoc } from "@/features/content/editor/normalize"
import { RichEditor } from "@/features/content/editor/rich-editor"
import { errorText } from "@/lib/errors"

/** The page's text in the editor, saved as a whole. */
export function ContentBodyCard({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const client = useQueryClient()
  const stored = entry.body
  const [draft, setDraft] = useState<ContentDetail["body"] | null>(null)
  // The editor normalises what it is given; an edit marks the card, not loading
  const dirty = draft !== null && !sameDoc(draft, stored)
  return (
    <CardForm
      title={t("content.body")}
      description={t("content.bodyHint")}
      dirty={dirty}
      saving={update.isPending}
      onSubmit={() => {
        if (!draft) {
          return
        }
        const submitted = draft
        update.mutate(
          { body: submitted },
          {
            onSuccess: ({ entry: saved }) => {
              // The saved text becomes the stored one at once: the editor keeps its place;
              // what was typed while it saved stays a change to save
              client.setQueryData(contentQuery(entry.id).queryKey, saved)
              setDraft((current) => (current === submitted ? null : current))
              toast.success(t("content.saved"))
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
      onReset={() => {
        setDraft(null)
      }}
    >
      <div className="-mx-5 -my-1">
        <RichEditor value={draft ?? stored} onChange={setDraft} label={t("content.body")} />
      </div>
    </CardForm>
  )
}
