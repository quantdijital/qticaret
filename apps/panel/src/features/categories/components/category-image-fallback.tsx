import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { categoryTreeQuery } from "@/features/categories/api/categories"
import { categoryFallbackQuery } from "@/features/categories/api/images"
import { descendantsOf } from "@/features/categories/tree"

const I = "categories.image"
// The storefront tile's 4:5, the size of the frame beside it
const TILE = "aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-md border"

/**
 * Beside an empty category picture: what the storefront shows right now,
 * the newest product's photo from the category or one under it, else the
 * name alone; in the same 4:5 tile as the frame, the crop's hint under
 * the words.
 */
export function CategoryImageFallback({ categoryId }: { categoryId: string }) {
  const { t } = useTranslation()
  const tree = useQuery(categoryTreeQuery())
  const categories = tree.data ?? []
  const ids = tree.data ? [categoryId, ...descendantsOf(categories, categoryId)] : []
  const fallback = useQuery({ ...categoryFallbackQuery(ids), enabled: ids.length > 0 })
  const name = categories.find((category) => category.id === categoryId)?.name ?? ""

  if (!fallback.isSuccess) {
    return (
      <div className="flex gap-4">
        <Skeleton className={TILE} />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    )
  }
  const photo = fallback.data?.url ?? null
  return (
    <div className="flex gap-4">
      {photo ? (
        <img src={photo} alt="" className={`${TILE} bg-muted object-cover`} />
      ) : (
        <div className={`${TILE} flex items-end bg-muted p-3`}>
          <span className="text-sm leading-tight font-semibold">{name}</span>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm break-words">
          {photo && fallback.data
            ? t(`${I}.fallback.photo`, { title: fallback.data.title })
            : t(`${I}.fallback.nameOnly`)}
        </p>
        <p className="text-xs text-muted-foreground">{t(`${I}.frameHint`)}</p>
      </div>
    </div>
  )
}
