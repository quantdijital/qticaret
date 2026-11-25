import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useProductStorefrontLink } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"

/**
 * Opens a product on the storefront: its live page, or a draft's signed
 * preview for a day, never indexed (F18), the link copied and said so.
 * The tab opens on the click, before the link exists: a tab opened after
 * the request would be taken for a pop-up. Used by the product page's
 * button and the list's row menu.
 */
export function useOpenStorefront(productId: string) {
  const { t } = useTranslation()
  const link = useProductStorefrontLink(productId)
  const open = () => {
    const tab = window.open("about:blank", "_blank")
    link.mutate(undefined, {
      onSuccess: ({ url, live }) => {
        if (tab) {
          tab.opener = null
          tab.location.href = url
        }
        if (!live) {
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
  return { open, isPending: link.isPending }
}
