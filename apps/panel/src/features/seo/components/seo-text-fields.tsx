import type { ReactNode } from "react"
import type { UseFormRegisterReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { AiEntity } from "@/features/ai/api/suggestions"
import { AiButton } from "@/features/ai/components/ai-button"
import type { SeoEntityType } from "@/features/seo/api/seo-meta"
import { DESCRIPTION_LIMIT, SEO_MAX, TITLE_LIMIT } from "./seo-limits"

export type SeoTextField = "seo_title" | "seo_description"

/** A length against what search results show; past it, in the warning colour. */
export function Counter({ length, limit }: { length: number; limit: number }) {
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        length > limit ? "text-warning-text" : "text-muted-foreground"
      )}
    >
      {length}/{limit}
    </span>
  )
}

/**
 * The records the AI core can write a search title and description for
 * (adr/0071 §8, docs/22 PR 1-1): a product, a category and a content page.
 * Any other SEO card (collection, brand, post, landing…) has no button.
 */
const aiEntityOf = (type: SeoEntityType, id: string): AiEntity | null =>
  type === "product" || type === "category" || type === "page" ? { type, id } : null

/** The field and, where the AI core writes for the record, its button level beside it. */
function WithAi({
  entity,
  task,
  label,
  onUse,
  children,
}: {
  entity: AiEntity | null
  task: SeoTextField
  label: string
  onUse: (text: string) => void
  children: ReactNode
}) {
  if (!entity) {
    return <>{children}</>
  }
  return (
    <div className="flex items-start gap-1.5">
      <div className="min-w-0 flex-1">{children}</div>
      <AiButton task={task} entity={entity} onUse={onUse} size="icon" label={label} />
    </div>
  )
}

/**
 * The SEO card's title and description with their counters and AI
 * buttons (adr/0071 §13). "Kullan" hands the text to `onUse`, which puts
 * it in the form as a change: the card's own Save writes it, leaving drops it.
 */
export function SeoTextFields({
  type,
  id,
  title,
  description,
  titlePlaceholder,
  shown,
  onUse,
}: {
  type: SeoEntityType
  id: string
  title: UseFormRegisterReturn
  description: UseFormRegisterReturn
  titlePlaceholder: string
  /** What the preview shows, template-filled: the counters measure it. */
  shown: { title: string; description: string }
  onUse: (field: SeoTextField, text: string) => void
}) {
  const { t } = useTranslation()
  const entity = aiEntityOf(type, id)
  return (
    <>
      <Field
        label={t("seo.card.seoTitle")}
        htmlFor={`seo-title-${id}`}
        hint={t("seo.card.seoTitleHint")}
      >
        <div className="flex flex-col gap-1">
          <WithAi
            entity={entity}
            task="seo_title"
            label={t("seo.card.aiTitle")}
            onUse={(text) => {
              onUse("seo_title", text.slice(0, SEO_MAX.title))
            }}
          >
            <Input
              id={`seo-title-${id}`}
              maxLength={SEO_MAX.title}
              placeholder={titlePlaceholder}
              {...title}
            />
          </WithAi>
          <div className="flex justify-end">
            <Counter length={shown.title.length} limit={TITLE_LIMIT} />
          </div>
        </div>
      </Field>
      <Field
        label={t("seo.card.seoDescription")}
        htmlFor={`seo-description-${id}`}
        hint={t("seo.card.seoDescriptionHint")}
      >
        <div className="flex flex-col gap-1">
          <WithAi
            entity={entity}
            task="seo_description"
            label={t("seo.card.aiDescription")}
            onUse={(text) => {
              onUse("seo_description", text.slice(0, SEO_MAX.description))
            }}
          >
            <Textarea
              id={`seo-description-${id}`}
              // Grows with the text, up to a few lines; longer scrolls inside
              className="max-h-60 min-h-20"
              maxLength={SEO_MAX.description}
              {...description}
            />
          </WithAi>
          <div className="flex justify-end">
            <Counter length={shown.description.length} limit={DESCRIPTION_LIMIT} />
          </div>
        </div>
      </Field>
    </>
  )
}
