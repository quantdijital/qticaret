import { ExternalLink, Eye, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@qticaret/admin-ui/ui/tooltip"
import type { ProductDetail } from "@/features/products/api/products"
import { useOpenStorefront } from "@/features/products/use-open-storefront"

/**
 * "Vitrinde gör" for a published product (its own page on the
 * storefront), "Önizle" for any other: a signed link to its page as last
 * saved, for a day, never indexed (F18, as a content draft's). In the
 * page header an icon only (the owner 2026-11-26: the header's row keeps
 * room for the save), named on hover and to screen readers.
 */
export function StorefrontButton({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const link = useOpenStorefront(product.id)
  const live = product.status === "published"
  const { open } = link
  const label = t(live ? "products.detail.viewOnStore" : "products.detail.preview")
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={label}
            disabled={link.isPending}
            onClick={open}
          >
            {link.isPending ? (
              <Loader2 className="animate-spin" />
            ) : live ? (
              <ExternalLink />
            ) : (
              <Eye />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
