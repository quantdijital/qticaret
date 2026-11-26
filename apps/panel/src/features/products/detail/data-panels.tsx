import { ArrowRight } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { AttributesCard } from "@/features/attributes/components/attributes-card"
import type { ProductDetail } from "@/features/products/api/products"
import type { TabPart } from "@/features/products/layout/parts"
import { AddonsCard } from "./addons-card"
import { CatalogPanel } from "./catalog-panel"
import { ParcelPanel } from "./parcel-panel"
import { PriceHistoryCard } from "./price-history-card"
import { PRODUCT_SECTIONS } from "./sections"
import { PricingPanel, StockPanel } from "./simple-panels"
import type { SimpleVariant } from "./use-simple-variant"
import { useAddonsShown } from "./use-addons-shown"
import { VariantsCard } from "./variants-card"

const D = "products.data"

/**
 * A card drawn inside a tab: the data card is its frame, so its own border,
 * corners and shadow go; its padding and title stay (a part's heading).
 */
function Inset({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div
      id={id}
      className="flex min-w-0 scroll-mt-20 flex-col [&>section]:rounded-none [&>section]:border-0 [&>section]:bg-transparent [&>section]:shadow-none [&>div>section]:rounded-none [&>div>section]:border-0 [&>div>section]:bg-transparent [&>div>section]:shadow-none [&>div]:gap-0 [&>div]:divide-y"
    >
      {children}
    </div>
  )
}

/** One of the card's own forms in a tab, padded as a card's body. */
function Pad({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div id={id} className="@container flex min-w-0 scroll-mt-20 flex-col p-5">
      {children}
    </div>
  )
}

/** A product with variants has its prices and stock on each variant: said, with the way there. */
function OnVariants({ text, onVariants }: { text: string; onVariants: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-[13px] text-muted-foreground">
      <p className="min-w-0">{text}</p>
      <Button type="button" variant="outline" size="sm" onClick={onVariants}>
        {t(`${D}.goVariants`)}
        <ArrowRight />
      </Button>
    </div>
  )
}

/** The Gelişmiş tab: add-ons (while the shop uses them or the product has some) and the price history. */
function AdvancedPanel({ productId }: { productId: string }) {
  const addons = useAddonsShown(productId) === true
  return (
    <div className="flex min-w-0 flex-col divide-y">
      {addons ? (
        <Inset id={PRODUCT_SECTIONS.addons}>
          <AddonsCard productId={productId} />
        </Inset>
      ) : null}
      <Inset id={PRODUCT_SECTIONS.priceHistory}>
        <PriceHistoryCard productId={productId} />
      </Inset>
    </div>
  )
}

/**
 * What one tab of the "Ürün verileri" card holds (docs/06 "Ürün
 * sayfası"); each saves on its own and on the page's header save.
 */
export function DataPanel({
  tab,
  product,
  simple,
  onVariants,
}: {
  tab: TabPart
  product: ProductDetail
  /** A simple product's variant form (Genel and Stok), "loading" until known; null for one with variants. */
  simple: SimpleVariant | "loading" | null
  onVariants: () => void
}) {
  const { t } = useTranslation()
  if (simple === "loading" && (tab === "pricing" || tab === "stock")) {
    return (
      <Pad>
        <Skeleton className="h-40 rounded-lg" />
      </Pad>
    )
  }
  const own = simple === "loading" ? null : simple
  switch (tab) {
    case "pricing":
      return own ? (
        <Pad id="product-variants">
          <PricingPanel simple={own} />
        </Pad>
      ) : (
        <OnVariants text={t(`${D}.pricesOnVariants`)} onVariants={onVariants} />
      )
    case "stock":
      return own ? (
        <Pad>
          <StockPanel simple={own} />
        </Pad>
      ) : (
        <OnVariants text={t(`${D}.stockOnVariants`)} onVariants={onVariants} />
      )
    case "shipping":
      return (
        <Pad>
          <ParcelPanel product={product} />
        </Pad>
      )
    case "attributes":
      return (
        <Inset>
          <AttributesCard productId={product.id} />
        </Inset>
      )
    case "variants":
      return (
        <Inset id="product-variants">
          <VariantsCard product={product} />
        </Inset>
      )
    case "catalog":
      return (
        <Pad>
          <CatalogPanel productId={product.id} />
        </Pad>
      )
    case "advanced":
      return <AdvancedPanel productId={product.id} />
  }
}
