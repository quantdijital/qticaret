import { ExternalLink, Eye } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { ProductDetail } from "@/features/products/api/products"
import { useOpenStorefront } from "@/features/products/use-open-storefront"

/**
 * "Vitrinde gör" for a published product (its own page on the
 * storefront), "Önizle" for any other: a signed link to its page as last
 * saved, for a day, never indexed (F18, as a content draft's).
 */
export function StorefrontButton({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const link = useOpenStorefront(product.id)
  const live = product.status === "published"
  const { open } = link
  return (
    <Button variant="outline" disabled={link.isPending} onClick={open}>
      {live ? <ExternalLink /> : <Eye />}
      {/* On a phone the icon only: the header's row keeps room for the save */}
      <span className="max-sm:sr-only">
        {t(live ? "products.detail.viewOnStore" : "products.detail.preview")}
      </span>
    </Button>
  )
}
