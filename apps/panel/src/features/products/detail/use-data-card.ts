import { useState } from "react"
import { useRememberedChoice } from "@qticaret/admin-ui/hooks/use-section-open"
import type { ProductDetail } from "@/features/products/api/products"
import { isTab } from "@/features/products/layout/parts"
import type { TabPart } from "@/features/products/layout/parts"

/** "Basit ürün" or "Varyantlı ürün" (WooCommerce's product type). */
export type ProductType = "simple" | "variable"

// What Medusa names the option of a product made without any: nothing for a shopper to pick
const DEFAULT_OPTION = "Default option"

/** A product of one variant and no option a shopper picks: a simple one. */
export function isSimpleProduct(product: Pick<ProductDetail, "variants" | "options">): boolean {
  const options = (product.options ?? []).filter((option) => option.title !== DEFAULT_OPTION)
  return (product.variants?.length ?? 0) <= 1 && options.length === 0
}

/**
 * The "Ürün verileri" card's state, kept by the page (its "Alana git"
 * opens a tab): the product's type, derived from its variants and switched
 * on the card ("Varyantlı ürün" brings the Varyantlar tab; back to simple
 * only while it has one variant at most), and the open tab, remembered per
 * person when they pick one.
 */
export function useDataCard(product: ProductDetail) {
  const count = product.variants?.length ?? 0
  const [picked, setPicked] = useState<ProductType>(() =>
    isSimpleProduct(product) ? "simple" : "variable"
  )
  // A product that gained variants elsewhere is one with variants, whatever was picked
  const type: ProductType = count > 1 ? "variable" : picked
  const [remembered, remember] = useRememberedChoice<TabPart>("product.dataTab", "pricing")
  const [tab, setTab] = useState<TabPart>(() => (isTab(remembered) ? remembered : "pricing"))
  return {
    type,
    simple: type === "simple",
    /** Switching back to simple is refused while it has several variants. */
    canBeSimple: count <= 1,
    setType: (next: ProductType) => {
      if (next === "variable" || count <= 1) {
        setPicked(next)
      }
    },
    tab,
    /** The person picked a tab: remembered for their next product. */
    pick: (next: TabPart) => {
      setTab(next)
      remember(next)
    },
    /** The page went to a tab ("Alana git"): opened, not remembered. */
    open: setTab,
  }
}

export type DataCardState = ReturnType<typeof useDataCard>
