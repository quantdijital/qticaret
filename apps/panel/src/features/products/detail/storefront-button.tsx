import { ExternalLink, Eye } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useProductStorefrontLink } from "@/features/products/api/products"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"

/**
 * "Vitrinde gör" for a published product (its own page on the
 * storefront), "Önizle" for any other: a signed link to its page as last
 * saved, for a day, never indexed (F18, as a content draft's). The tab
 * opens on the click, before the link exists: a tab opened after the
 * request would be taken for a pop-up.
 */
export function StorefrontButton({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const link = useProductStorefrontLink(product.id)
  const live = product.status === "published"
  const open = () => {
    const tab = window.open("about:blank", "_blank")
    link.mutate(undefined, {
      onSuccess: ({ url, live: isLive }) => {
        if (tab) {
          tab.opener = null
          tab.location.href = url
        }
        if (!isLive) {
          // Not every page has the clipboard (plain http): the tab is opened anyway
          void Promise.resolve()
            .then(() => navigator.clipboard.writeText(url))
            .catch(() => undefined)
          toast.success(t("products.detail.previewReady"))
        }
      },
      onError: (failure) => {
        tab?.close()
        toast.error(errorText(t, failure))
      },
    })
  }
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
