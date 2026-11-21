import { useQueryClient } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { contentQuery, useUpdateContent } from "@/features/content/api/content"
import type { ContentDetail } from "@/features/content/api/content"
import { DocumentCard } from "@/features/content/components/document-card"
import { PostDraftAi } from "@/features/content/components/post-draft-ai"
import { PostLinkSuggestions } from "@/features/content/components/post-link-suggestions"
import { docText } from "@/features/content/doc-text"
import { docOfPostDraft } from "@/features/ai/post-draft"
import type { AiPostLink } from "@/features/ai/post-draft"

/** No text, picture or card: nothing a draft would replace (an empty editor holds a bare paragraph). */
const isBlank = (doc: JSONContent): boolean =>
  (doc.content ?? []).every((node) => node.type === "paragraph" && docText(node) === "")

/**
 * The page's text in the editor, saved as a whole. A blog post has "Taslak
 * yaz" above it (adr/0074 §5 madde 5): the draft goes in as headings and
 * paragraphs, an unsaved change, and its internal link suggestions stay in
 * a list under the editor until closed.
 */
export function ContentBodyCard({ entry }: { entry: ContentDetail }) {
  const { t } = useTranslation()
  const update = useUpdateContent(entry.id)
  const client = useQueryClient()
  const [links, setLinks] = useState<AiPostLink[]>([])
  return (
    <div className="flex flex-col gap-[var(--grid-gap)]">
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
        action={
          entry.kind === "post"
            ? (put, current) => (
                <PostDraftAi
                  postId={entry.id}
                  empty={isBlank(current)}
                  onUse={(draft) => {
                    put(docOfPostDraft(draft))
                    setLinks(draft.links)
                  }}
                />
              )
            : undefined
        }
      />
      {links.length > 0 ? (
        <PostLinkSuggestions
          links={links}
          onClose={() => {
            setLinks([])
          }}
        />
      ) : null}
    </div>
  )
}
