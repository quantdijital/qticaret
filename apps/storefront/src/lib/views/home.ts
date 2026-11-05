import "server-only"
import type { StoreLayoutSection } from "@qticaret/types"
import type { HomeSectionView, Translate } from "@qticaret/ui"
import { sectionViews } from "./sections"

/** The home page's sections, in the shop's order, each fetched at once (adr/0049). */
export const homeSections = (
  sections: readonly StoreLayoutSection[],
  t: Translate
): Promise<HomeSectionView[]> => sectionViews(sections, t, { home: true })
