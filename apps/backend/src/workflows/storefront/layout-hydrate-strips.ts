import type { MenuLinkInput, RecordLinkKind } from "../../lib/storefront/menus"
import { STRIP_GALLERY_SETTING_NAMES } from "../../lib/storefront/sections/strip-gallery"
import type { StripGallerySection } from "../../lib/storefront/sections/strip-gallery"
import type { StoreLayoutImage, StoreLayoutLink } from "./layout-hydrate"

/** What the strip gallery is printed with: the hydrate's own helpers. */
export interface StripsContext {
  fill: (text: string | null) => string | null
  link: (each: MenuLinkInput | null) => StoreLayoutLink | null
  image: (url: string, alt: string | null) => StoreLayoutImage
  /** Whether a source is live now; none: all are (a unit test's design). */
  live?: ((kind: RecordLinkKind, id: string) => boolean) | undefined
}

/**
 * The strip gallery as the storefront prints it (adr/0049 Ek 2026-11-16):
 * an item whose source is not live is left out, its id never printed
 * (security review 2026-11-02, L8), the others keeping their saved place
 * (`at`, the editor's field marks). The source's name, picture and price
 * are the storefront's to fetch; the shop's words are filled, its picture
 * keeps its own alt, its link is placed (a broken one null).
 */
export function hydrateStrips(section: StripGallerySection, at: StripsContext) {
  const live = at.live ?? (() => true)
  return {
    id: section.id,
    type: section.type,
    title: section.title,
    text: at.fill(section.text),
    items: section.items.flatMap((each, place) =>
      each.source.kind !== "custom" && !live(each.source.kind, each.source.target)
        ? []
        : [
            {
              at: place,
              source: each.source,
              image: each.image
                ? { ...at.image(each.image.url, each.image.alt), alt: each.image.alt }
                : null,
              title: at.fill(each.title),
              note: at.fill(each.note),
              link: at.link(each.link),
            },
          ]
    ),
    ...Object.fromEntries(STRIP_GALLERY_SETTING_NAMES.map((name) => [name, section[name]])),
  }
}
