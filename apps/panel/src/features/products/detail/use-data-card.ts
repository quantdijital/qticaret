import { useState } from "react"
import { useRememberedChoice } from "@qticaret/admin-ui/hooks/use-section-open"
import type { ProductDetail } from "@/features/products/api/products"
import { isTab } from "@/features/products/layout/parts"
import type { TabPart } from "@/features/products/layout/parts"
import { usePlaceholderOption } from "./placeholder-option"
import { isSimpleProduct } from "./simple-plan"

/** "Basit ürün" or "Varyantlı ürün" (WooCommerce's product type). */
export type ProductType = "simple" | "variable"

/**
 * The "Ürün verileri" card's state, kept by the page (its "Alana git"
 * opens a tab): the product's type, derived from what is stored (one
 * variant, no real option: simple) and switched on the card, and the open
 * tab, remembered per person when they pick one. A simple product shown
 * as one with variants (to add options) goes back freely; a product that
 * is not simple asks first in the card (`confirming`), since making it
 * simple deletes its other variants and takes its options off.
 */
export function useDataCard(product: ProductDetail) {
  const placeholder = usePlaceholderOption()
  const simpleNow = isSimpleProduct(product, placeholder)
  const [picked, setPicked] = useState<ProductType>(simpleNow ? "simple" : "variable")
  const [confirming, setConfirming] = useState(false)
  // A product that gained options or variants elsewhere is one with variants, whatever was picked
  const type: ProductType = simpleNow ? picked : "variable"
  const [remembered, remember] = useRememberedChoice<TabPart>("product.dataTab", "pricing")
  const [tab, setTab] = useState<TabPart>(() => (isTab(remembered) ? remembered : "pricing"))
  return {
    type,
    simple: type === "simple",
    /** "Basit ürün" was picked on a product that is not simple: the card asks before changing it. */
    confirming: confirming && !simpleNow,
    setType: (next: ProductType) => {
      if (next === "simple" && !simpleNow) {
        setConfirming(true)
        return
      }
      setConfirming(false)
      setPicked(next)
    },
    /** The question was answered "Vazgeç": nothing changed. */
    cancel: () => {
      setConfirming(false)
    },
    /** The product was made simple: shown so once it is read again. */
    madeSimple: () => {
      setConfirming(false)
      setPicked("simple")
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
