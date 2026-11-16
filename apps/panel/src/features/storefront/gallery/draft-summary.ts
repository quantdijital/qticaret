import type { LayoutDocument } from "@/features/storefront/api/layout"
import type { DesignSummary } from "./api"

const HOME_TYPES_SHOWN = 8

/**
 * The draft's sketch, read as the server reads a saved look's (backend
 * `designSummary`): its colours, faces, section counts and the home
 * page's first section types, for the "Şu anki görünüm" card.
 */
export function draftSketch(
  doc: LayoutDocument
): Pick<DesignSummary, "colors" | "fonts" | "sections" | "home_types"> {
  const { colors, typography } = doc.settings.theme
  return {
    colors: {
      primary: colors.primary,
      accent: colors.accent,
      background: colors.background,
    },
    fonts: { heading: typography.heading, body: typography.body },
    sections: {
      header: doc.header.length,
      home: doc.home.length,
      footer: doc.footer.length,
      product: doc.product.length,
      category: doc.category.length,
    },
    home_types: doc.home.map((section) => section.type).slice(0, HOME_TYPES_SHOWN),
  }
}
