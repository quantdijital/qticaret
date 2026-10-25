import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Container, Heading, Text } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { CatalogForm } from "../components/product-catalog/catalog-form"
import { useProductCatalog } from "../components/product-catalog/use-product-catalog"
import { ErrorState, LoadingRows } from "../components/page-states"
import { errorText } from "../lib/errors"

/**
 * Catalog details on the product page (F3.1): condition, primary category,
 * successor product and the variants' MPNs; GTINs come from Medusa's own
 * variant fields and are shown as structured data will use them.
 */
// What the catalog lists depend on in the product the page holds
const versionOf = (product: AdminProduct): string =>
  [
    String(product.updated_at),
    (product.variants ?? []).map((variant) => variant.id).join(","),
    (product.categories ?? []).map((category) => category.id).join(","),
  ].join("|")

function ProductCatalogWidget({ data: product }: DetailWidgetProps<AdminProduct>) {
  const { t } = useTranslation()
  const { catalog, save } = useProductCatalog(product.id, versionOf(product))

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{t("qticaret.catalog.title")}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {t("qticaret.catalog.subtitle")}
        </Text>
      </div>
      {catalog.isPending ? (
        <div className="px-6 py-4">
          <LoadingRows rows={3} />
        </div>
      ) : catalog.isError ? (
        <div className="px-6 py-4">
          <ErrorState text={errorText(t, catalog.error)} onRetry={() => void catalog.refetch()} />
        </div>
      ) : (
        // A save or a refetch brings new fields: the form starts again from them
        <CatalogForm
          key={catalog.dataUpdatedAt}
          productId={product.id}
          catalog={catalog.data}
          save={save}
        />
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details",
})

export default ProductCatalogWidget
