import type { HeroSection } from "../../lib/storefront/sections/hero"
import { bandRanges } from "../../lib/storefront/sections/price-bands"
import type { PriceBandsSection } from "../../lib/storefront/sections/price-bands"
import type { BandPick } from "./price-bands"
import type { StoreLayoutImage, StoreLayoutLink } from "./layout-hydrate"

/**
 * The catalogue home page's sections as the storefront prints them
 * (adr/0049 Ek 2026-11-14, note "Katalog ana sayfası"); `layout-hydrate.ts`
 * calls these with its own link and image readers.
 */

interface Readers {
  fill: (text: string | null) => string | null
  link: (each: HeroSection["links"][number] | null) => StoreLayoutLink | null
  image: (url: string, alt: string | null) => StoreLayoutImage
}

const shownImage = (readers: Readers, image: { url: string; alt: string | null } | null) =>
  image ? { ...readers.image(image.url, image.alt), alt: image.alt } : null

const present = <T>(items: readonly (T | null)[]): T[] =>
  items.flatMap((item) => (item === null ? [] : [item]))

/**
 * The opening in its variant: the common words, buttons and picture, and
 * for H17 its variant, list, tiles (their pictures sized), quick links (a
 * broken one left out), products shown small and whether "from" is shown.
 * Today's opening prints as it did before variants (no `variant`: the
 * storefront reads none as `standard`).
 */
export function hydrateHero(section: HeroSection, readers: Readers) {
  const shown = {
    id: section.id,
    type: section.type,
    eyebrow: readers.fill(section.eyebrow),
    heading: readers.fill(section.heading),
    text: readers.fill(section.text),
    links: present(section.links.map((each) => readers.link(each))),
    image: shownImage(readers, section.image),
  }
  if (section.variant !== "category_list") {
    return shown
  }
  return {
    ...shown,
    variant: section.variant,
    list: section.list,
    list_limit: section.list_limit,
    show_count: section.show_count,
    tiles: section.tiles.map((tile) => ({
      category_id: tile.category_id,
      image: shownImage(readers, tile.image),
    })),
    chips: present(section.chips.map((each) => readers.link(each))),
    picks: section.picks,
    show_price: section.show_price,
  }
}

/**
 * The price bands: each band's words filled, its category (printed only
 * when it has one, so a strip from before band categories prints as it
 * did), its range, and its products as picked.
 */
export function hydratePriceBands(
  section: PriceBandsSection,
  pick: BandPick | undefined,
  fill: Readers["fill"]
) {
  const ranges = bandRanges(section.bands)
  return {
    id: section.id,
    type: section.type,
    title: section.title,
    bands: section.bands.map((band, index) => ({
      label: fill(band.label) ?? band.label,
      text: fill(band.text),
      ...(band.category_id ? { category_id: band.category_id } : {}),
      min: ranges[index]?.min ?? null,
      max: band.max,
      product_ids: pick?.[index] ?? [],
    })),
  }
}
