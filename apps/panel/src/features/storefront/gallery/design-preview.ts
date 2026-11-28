import { queryOptions, useMutation } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { LayoutPreview } from "@/features/storefront/api/layout"
import { previewAddress } from "@/features/storefront/layout/preview-url"
import { errorText } from "@/lib/errors"
import { sdk } from "@/lib/sdk"
import type { DesignCard } from "./api"

/**
 * A saved look drawn by the storefront itself (adr/0064, as Shopify's
 * `preview_theme_id`): the backend signs a link for that look alone, an
 * hour, ended by a rename or its removal. The card frames it small as its
 * picture (`DesignFrame`); "Önizle" opens it whole in a new tab.
 */

const MINUTE = 60 * 1000

/** A fresh signed link to the look as saved now (a read: it writes nothing). */
export const fetchDesignPreview = (id: string) =>
  sdk.client.fetch<LayoutPreview>(`/admin/storefront-designs/${encodeURIComponent(id)}/preview`)

/**
 * The card picture's link: one per look as saved (a rename moves
 * `updated_at` and asks again), kept well inside its hour. Outside the
 * gallery's own key, so the gallery's refresh redraws no picture.
 */
export const designPreviewQuery = (design: Pick<DesignCard, "id" | "updated_at">) =>
  queryOptions({
    queryKey: ["storefront-design-preview", design.id, design.updated_at] as const,
    queryFn: () => fetchDesignPreview(design.id),
    staleTime: 45 * MINUTE,
    gcTime: 50 * MINUTE,
    refetchOnWindowFocus: false,
    retry: false,
  })

/**
 * The address a card picture frames: the page alone, without the
 * preview's band. None for a link about to end (a picture kept past its
 * hour would show the live storefront): the query asks again first.
 */
export const pictureAddress = (preview: LayoutPreview, now = Date.now()): string | null => {
  const address = Date.parse(preview.expires_at) - now > MINUTE ? previewAddress(preview) : null
  return address ? `${address}${address.includes("?") ? "&" : "?"}gorsel=1` : null
}

/**
 * "Önizle": the look whole in a new tab, from a fresh link. The tab opens
 * on the click, before the link exists: one opened after the request would
 * be taken for a pop-up.
 */
export function useDesignPreview() {
  const { t } = useTranslation()
  const preview = useMutation({ mutationFn: fetchDesignPreview })
  return {
    opening: preview.isPending,
    open: async (id: string) => {
      const tab = window.open("about:blank", "_blank")
      try {
        const address = previewAddress(await preview.mutateAsync(id))
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
