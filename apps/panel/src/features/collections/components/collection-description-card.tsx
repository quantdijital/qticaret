import { useQueryClient } from "@tanstack/react-query"
import { collectionQuery, useSetCollectionDetails } from "@/features/collections/api/collections"
import type { Collection } from "@/features/collections/api/collections"
import { ListingDescriptionCard } from "@/features/content/components/listing-description-card"

/**
 * The collection page's own text (adr/0075): sends the document only
 * (both fields at once is a 400), the server mirrors its plain text.
 */
export function CollectionDescriptionCard({ collection }: { collection: Collection }) {
  const client = useQueryClient()
  const details = useSetCollectionDetails(collection.id)
  return (
    <ListingDescriptionCard
      doc={collection.description_doc}
      text={collection.description}
      saving={details.isPending}
      save={async (description_doc) => {
        const result = await details.mutateAsync({ description_doc })
        client.setQueryData(collectionQuery(collection.id).queryKey, result.collection)
      }}
    />
  )
}
