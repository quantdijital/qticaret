import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { AiPicks } from "@/features/ai/components/ai-picks"
import { hasTag, withTag } from "./tag-values"
import type { TagValue } from "./tag-values"

/**
 * The product's tags in the organize dialog: each a chip with a way to take
 * it off, and the AI picks beside them (adr/0074 §5 madde 2), a new one
 * marked until Save creates it.
 */
export function TagsField({
  productId,
  value,
  onChange,
}: {
  productId: string
  value: TagValue[]
  onChange: (tags: TagValue[]) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={t("products.tags.field")}>
          {value.map((tag) => (
            <li key={tag.id ?? `new:${tag.value}`}>
              <Badge variant="outline" className="gap-1 py-0.5 pr-0.5 text-xs font-normal">
                {tag.value}
                {tag.id === null ? (
                  <span className="text-[10px] text-muted-foreground">{t("ai.picks.new")}</span>
                ) : null}
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-accent"
                  aria-label={t("products.tags.remove", { name: tag.value })}
                  onClick={() => {
                    onChange(value.filter((each) => each !== tag))
                  }}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">{t("products.tags.none")}</p>
      )}
      <AiPicks
        task="product_tags"
        entity={{ type: "product", id: productId }}
        label={t("products.tags.ai")}
        has={(pick) => hasTag(value, pick)}
        onPick={(pick) => {
          onChange(withTag(value, pick))
        }}
      />
    </div>
  )
}
