import { useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { fetchLayoutPreview } from "@/features/storefront/api/layout"
import { previewAddress } from "@/features/storefront/layout/preview-url"
import { errorText } from "@/lib/errors"

/**
 * The draft as the storefront draws it, in a new tab: the signed preview
 * link the theme editor opens too (adr/0049), so the page shows the look
 * itself, not a sketch of it. The tab opens on the click, before the link
 * exists: one opened after the request would be taken for a pop-up.
 */
export function useDraftPreview() {
  const { t } = useTranslation()
  const preview = useMutation({ mutationFn: fetchLayoutPreview })
  return {
    opening: preview.isPending,
    open: async () => {
      const tab = window.open("about:blank", "_blank")
      try {
        const address = previewAddress(await preview.mutateAsync())
        if (!address) {
          tab?.close()
          toast.error(t("storefront.editor.preview.noHost"))
          return
        }
        if (tab) {
          tab.opener = null
          tab.location.href = address
        }
      } catch (failure) {
        tab?.close()
        toast.error(errorText(t, failure))
      }
    },
  }
}
