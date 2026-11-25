import { useState } from "react"
import { useRememberedChoice } from "@qticaret/admin-ui/hooks/use-section-open"
import type { ProductDetail } from "@/features/products/api/products"
import type { SimplePlan } from "@/features/products/api/product-simple"
import { isTab } from "@/features/products/layout/parts"
import type { TabPart } from "@/features/products/layout/parts"

/** "Basit ürün" or "Varyantlı ürün" (WooCommerce's product type). */
export type ProductType = "simple" | "variable"

type ProductOption = NonNullable<ProductDetail["options"]>[number]

// What Medusa names the option of a product made without any: nothing for a shopper to pick
const DEFAULT_OPTION = "Default option"
// What the wizard and the import give a product without options (backend `plan-variants.ts`)
const WIZARD_OPTION = { title: "Seçenek", value: "Standart" }

const isPlaceholder = (option: ProductOption) =>
  option.title === DEFAULT_OPTION ||
  (option.title === WIZARD_OPTION.title &&
    (option.values ?? []).length <= 1 &&
    (option.values?.[0]?.value ?? WIZARD_OPTION.value) === WIZARD_OPTION.value)

/** The options a shopper picks from: Medusa's "Default option" and the wizard's left out. */
export function realOptions(product: Pick<ProductDetail, "options">): ProductOption[] {
  return (product.options ?? []).filter((option) => !isPlaceholder(option))
}

/** A product of one variant and no option a shopper picks: a simple one. */
export function isSimpleProduct(product: Pick<ProductDetail, "variants" | "options">): boolean {
  return (product.variants?.length ?? 0) <= 1 && realOptions(product).length === 0
}

/** What making the product simple keeping this variant deletes and unlinks. */
export function simplePlan(product: ProductDetail, keep: string): SimplePlan {
  return {
    remove: (product.variants ?? []).flatMap((variant) =>
      variant.id === keep ? [] : [variant.id]
    ),
    options: realOptions(product).map((option) => option.id),
  }
}

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
  const simpleNow = isSimpleProduct(product)
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
