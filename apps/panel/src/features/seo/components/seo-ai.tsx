import type { ReactNode } from "react"
import type { AiEntity } from "@/features/ai/api/suggestions"
import { AiButton } from "@/features/ai/components/ai-button"
import type { SeoEntityType } from "@/features/seo/api/seo-meta"

/**
 * The records the AI core can write a search title and description for
 * (adr/0071 §8, docs/22 PR 1-1): a product, a category and a content page.
 * Any other SEO card (collection, brand, post, landing…) has no button.
 */
const aiEntityOf = (type: SeoEntityType, id: string): AiEntity | null =>
  type === "product" || type === "category" || type === "page" ? { type, id } : null

/**
 * A SEO field with the AI button beside it (adr/0071 §13). "Kullan" hands
 * the text to `onUse`, which puts it in the form as a change; the card's
 * own Save writes it, or leaving drops it.
 */
export function SeoAiField({
  task,
  type,
  id,
  onUse,
  children,
}: {
  task: "seo_title" | "seo_description"
  type: SeoEntityType
  id: string
  onUse: (text: string) => void
  children: ReactNode
}) {
  const entity = aiEntityOf(type, id)
  if (!entity) {
    return <>{children}</>
  }
  return (
    <div className="flex items-start gap-1.5">
      <div className="min-w-0 flex-1">{children}</div>
      <AiButton task={task} entity={entity} onUse={onUse} size="icon" />
    </div>
  )
}
