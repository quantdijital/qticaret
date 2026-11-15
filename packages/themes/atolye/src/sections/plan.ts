import { shelfJoins } from "@qticaret/types/section-shelf"
import type { HomeSectionView, ProductCardView } from "@qticaret/ui"

export type Of<T extends HomeSectionView["type"]> = Extract<HomeSectionView, { type: T }>

/** A heading's id from the section's own: unique on the page, stable across requests. */
export const headingId = (sectionId: string) => `bolum-${sectionId}`

/** One block of the page: product sections side by side share one tabbed shelf. */
export type Block =
  | { kind: "shelf"; sections: Of<"products">[] }
  | { kind: "one"; section: Exclude<HomeSectionView, Of<"products">> }

/**
 * Whether a rail joins its neighbours' tabs: every variant does, each
 * panel drawn as its own, but a columns rail, whose lists are already side
 * by side under their own headings (adr/0049 Ek 2026-11-15), and one the
 * shop set apart (`tabs: "off"`, bilesen-denetimi (b) 2).
 */
const joins = (section: Of<"products">) => shelfJoins(section)

/**
 * The shop's sections in its order (adr/0049), product sections that
 * stand next to each other joined into one shelf with tabs (a columns
 * rail, or one set apart, stands alone). Nothing is moved or invented.
 */
export function blocksOf(sections: readonly HomeSectionView[]): Block[] {
  const out: Block[] = []
  for (const section of sections) {
    const last = out.at(-1)
    if (section.type === "products") {
      if (last?.kind === "shelf" && joins(section) && last.sections.every(joins)) {
        last.sections.push(section)
      } else {
        out.push({ kind: "shelf", sections: [section] })
      }
    } else {
      out.push({ kind: "one", section })
    }
  }
  return out
}

/**
 * The opening's picture when the shop gave the hero none: its newest
 * pictured product (from the first product section, else the close-up),
 * so the first screen shows the shop's own photograph, never a stand-in.
 */
export function openingProduct(sections: readonly HomeSectionView[]): ProductCardView | null {
  for (const section of sections) {
    if (section.type === "products") {
      const found = section.products.find((product) => product.image !== null)
      if (found) {
        return found
      }
    }
    if (section.type === "featured_product" && section.product.image) {
      return section.product
    }
  }
  return null
}
