import { subscribeNewsletter } from "@/app/actions/newsletter"
import { t } from "@/lib/i18n"
import type { ProductPreview } from "@/lib/store-api/product-preview"
import { storefrontSettings } from "@/lib/store-api/requests"
import { themeActions } from "@/lib/theme-actions"
import { swatchLookup } from "@/lib/views/color"
import { currentLayout } from "@/lib/views/layout"
import { productPreviewView } from "@/lib/views/product-preview"
import { sharedSettingsOf } from "@/lib/views/shared-settings"
import { theme } from "@/theme"

/**
 * A draft product's page from a signed link (F18): the product's own block
 * drawn as the live page draws it, with the shop's badges and colour names,
 * under a line saying it is a preview. No analytics, no structured data:
 * it is nobody's page yet.
 */
export async function ProductPreviewScreen({
  preview,
  variant,
}: {
  preview: ProductPreview
  variant: string | null
}) {
  const [{ storefront }, layout] = await Promise.all([storefrontSettings(), currentLayout()])
  const shared = sharedSettingsOf(layout, storefront)
  const view = productPreviewView({
    product: preview.product,
    descriptionHtml: preview.texts.description,
    summaryHtml: preview.texts.summary,
    requestedVariant: variant,
    trustBadges: shared.trust_badges,
    swatchOf: swatchLookup(shared.color_swatches),
    t,
  })
  return (
    <theme.ProductPage view={view} t={t} actions={themeActions} subscribe={subscribeNewsletter} />
  )
}
