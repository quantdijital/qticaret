import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  categoryDescriptionQuery,
  useSetCategoryDescription,
} from "@/features/categories/api/descriptions"
import { ListingDescriptionCard } from "@/features/content/components/listing-description-card"
import { errorText } from "@/lib/errors"

/**
 * The category's own text (adr/0075), read and written through
 * `/admin/category-descriptions` only: Medusa's category route never gets
 * the text from the panel, or the document would go stale.
 */
export function CategoryDescriptionCard({ categoryId }: { categoryId: string }) {
  const { t } = useTranslation()
  const description = useQuery(categoryDescriptionQuery(categoryId))
  const save = useSetCategoryDescription(categoryId)
  if (description.isError) {
    return (
      <ErrorState
        text={errorText(t, description.error)}
        onRetry={() => void description.refetch()}
      />
    )
  }
  if (!description.data) {
    return <Skeleton className="h-96 w-full rounded-lg" />
  }
  return (
    <ListingDescriptionCard
      doc={description.data.description_doc}
      text={description.data.description}
      saving={save.isPending}
      save={async (doc) => {
        await save.mutateAsync(doc)
      }}
    />
  )
}
