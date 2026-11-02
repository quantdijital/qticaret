import { Folder, Hash } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import type { TermView } from "@/features/content/api/terms"

// A row stays one line high on a phone: the rest are counted
const SHOWN_TAGS = 3

/** A post's category and its first tags, small, under its title in the posts list. */
export function TermBadges({
  category,
  tags,
}: {
  category: TermView | null
  tags: readonly TermView[]
}) {
  const { t } = useTranslation()
  if (!category && tags.length === 0) {
    return null
  }
  const rest = tags.length - SHOWN_TAGS
  return (
    <ul aria-label={t("content.terms.filedUnder")} className="mt-1 flex flex-wrap gap-1">
      {category ? (
        <li>
          <Badge variant="secondary" className="max-w-48 font-normal">
            <Folder aria-hidden="true" />
            <span className="truncate">{category.name}</span>
          </Badge>
        </li>
      ) : null}
      {tags.slice(0, SHOWN_TAGS).map((tag) => (
        <li key={tag.id}>
          <Badge variant="outline" className="max-w-40 font-normal text-muted-foreground">
            <Hash aria-hidden="true" />
            <span className="truncate">{tag.name}</span>
          </Badge>
        </li>
      ))}
      {rest > 0 ? (
        <li>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {t("content.terms.moreTags", { n: rest })}
          </Badge>
        </li>
      ) : null}
    </ul>
  )
}
