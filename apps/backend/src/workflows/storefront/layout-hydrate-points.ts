import type { MenuLinkInput } from "../../lib/storefront/menus"
import type { StatsSection } from "../../lib/storefront/sections/stats"
import type { StepsSection } from "../../lib/storefront/sections/steps"
import type { PhotoCollageSection } from "../../lib/storefront/sections/photo-collage"
import type { StoreLayoutImage, StoreLayoutLink } from "./layout-hydrate"
import type { DeparturesSection } from "../../lib/storefront/sections/departures"

/** What the figures strip and the steps are printed with: the hydrate's own helpers. */
export interface PointsContext {
  fill: (text: string | null) => string | null
  link: (each: MenuLinkInput | null) => StoreLayoutLink | null
}

/** Shop text that is never null in the design stays a string once filled. */
const filled = (at: PointsContext, text: string) => at.fill(text) ?? text

/**
 * The figures strip and the numbered steps as the storefront prints them
 * (adr/0077 §10): the shop's words filled, the steps' link placed (a broken
 * one null), every setting as saved (both came with their settings, so
 * there is no older shape to keep).
 */
export function hydratePoints(section: StatsSection | StepsSection, at: PointsContext) {
  const { id, type } = section
  if (section.type === "stats") {
    return {
      id,
      type,
      title: section.title,
      items: section.items.map((item) => ({
        value: item.value,
        label: filled(at, item.label),
        text: at.fill(item.text),
      })),
      dividers: section.dividers,
    }
  }
  return {
    id,
    type,
    title: section.title,
    intro: at.fill(section.intro),
    items: section.items.map((item) => ({
      title: filled(at, item.title),
      text: at.fill(item.text),
    })),
    link: at.link(section.link),
    layout: section.layout,
    numbers: section.numbers,
  }
}

/**
 * The photo collage as the storefront prints it (adr/0077 §10): each
 * picture with what the media library knows of it and the shop's own
 * words, its caption filled, its link placed (a broken one null, the
 * photograph kept), the settings as saved.
 */
export function hydrateCollage(
  section: PhotoCollageSection,
  at: PointsContext & { image: (url: string, alt: string | null) => StoreLayoutImage }
) {
  return {
    id: section.id,
    type: section.type,
    title: section.title,
    intro: at.fill(section.intro),
    items: section.items.map((each) => ({
      image: { ...at.image(each.image.url, each.image.alt), alt: each.image.alt },
      caption: at.fill(each.caption),
      link: at.link(each.link),
    })),
    layout: section.layout,
    phone: section.phone,
  }
}

/**
 * Upcoming departures as the storefront asks for them (adr/0077 §10): the
 * shop's words filled, the source, count and layout as saved; the rows
 * themselves are read live (`GET /store/departures`), never kept here.
 */
export function hydrateDepartures(section: DeparturesSection, at: PointsContext) {
  const { id, type } = section
  return {
    id,
    type,
    title: section.title,
    intro: at.fill(section.intro),
    source: section.source,
    limit: section.limit,
    layout: section.layout,
  }
}
