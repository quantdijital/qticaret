import type { ProductDetail } from "@/features/products/api/products"
import { useProductPathPrefix } from "@/features/products/use-product-path"
import { SeoCard } from "@/features/seo/components/seo-card"

// The meta description templates use a short excerpt, not the whole text
const EXCERPT = 140

/** The product's SEO fields, previewed with its own name, category and description. */
export function ProductSeoCard({ product }: { product: ProductDetail }) {
  const prefix = useProductPathPrefix()
  const description = (product.description ?? "").replace(/\s+/g, " ").trim()
  return (
    <SeoCard
      type="product"
      id={product.id}
      context={{
        path: `${prefix}${product.handle}`,
        tokens: {
          ürün_adı: product.title,
          kategori: product.categories?.[0]?.name ?? "",
          kısa_açıklama: description.slice(0, EXCERPT),
        },
        fallbackDescription: description.slice(0, EXCERPT),
      }}
    />
  )
}
