import type { HomeSectionView, ProductCardView } from "@qticaret/ui"

export type Of<T extends HomeSectionView["type"]> = Extract<HomeSectionView, { type: T }>

/** How many categories the opening lists under 1024 px, where the menu bar is in the drawer. */
export const OPENING_CATEGORIES = 6

/** The opening (design.md: hero) and what it drew from. */
export interface Opening {
  hero: Of<"hero">
  /** The categories section the hero took in, if the shop placed one right after it. */
  categories: Of<"categories"> | null
  /** One of the shop's own product photographs: the first product with a picture. */
  photo: ProductCardView | null
}

export interface HomePlan {
  opening: Opening | null
  /** Every other section, in the shop's order. */
  sections: HomeSectionView[]
}

const firstPictured = (sections: readonly HomeSectionView[]): ProductCardView | null => {
  for (const section of sections) {
    if (section.type === "products") {
      const found = section.products.find((product) => product.image !== null)
      if (found) {
        return found
      }
    }
  }
  return null
}

/**
 * The home page's plan from the shop's sections (adr/0049): an opening
 * hero takes the categories section that follows it (the brief wants
 * categories on a phone's first screen; the opening lists the first ones
 * there and the index right after it lists them all), and one of the
 * shop's own product photographs from its first product section. Nothing
 * is invented: without a pictured product the opening is its words.
 * Every other section keeps its place.
 */
export function planHome(sections: readonly HomeSectionView[]): HomePlan {
  const [first, second, ...after] = sections
  if (first?.type !== "hero") {
    return { opening: null, sections: [...sections] }
  }
  const categories = second?.type === "categories" ? second : null
  return {
    opening: { hero: first, categories, photo: firstPictured(sections) },
    sections: categories ? after : sections.slice(1),
  }
}
