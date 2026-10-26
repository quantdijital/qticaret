import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { contentQuery, useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { DocumentCard } from "@/features/content/components/document-card"

/** The page's text in the editor, saved as a whole. */
export function ContentBodyCard({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const client = useQueryClient()
  return (
    <DocumentCard
      title={t("content.body")}
      description={t("content.bodyHint")}
      stored={entry.body}
      saving={update.isPending}
      save={async (body) => {
        const { entry: saved } = await update.mutateAsync({ body })
        // The saved text becomes the stored one at once: the editor keeps its place
        client.setQueryData(contentQuery(entry.id).queryKey, saved)
      }}
    />
  )
}
