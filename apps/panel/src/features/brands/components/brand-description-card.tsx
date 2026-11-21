import { useQueryClient } from "@tanstack/react-query"
import { brandQuery, useUpdateBrand } from "@/features/brands/api/brands"
import type { Brand } from "@/features/brands/api/brands"
import { ListingDescriptionCard } from "@/features/content/components/listing-description-card"

/**
 * The brand page's own text (adr/0075): sends the document only (both
 * fields at once is a 400), the server mirrors its plain text.
 */
export function BrandDescriptionCard({ brand }: { brand: Brand }) {
  const client = useQueryClient()
  const update = useUpdateBrand(brand.id)
  return (
    <ListingDescriptionCard
      kind="brand"
      id={brand.id}
      doc={brand.description_doc}
      text={brand.description}
      saving={update.isPending}
      save={async (description_doc) => {
        const result = await update.mutateAsync({ description_doc })
        client.setQueryData(brandQuery(brand.id).queryKey, result.brand)
      }}
    />
  )
}
