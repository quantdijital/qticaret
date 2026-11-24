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
 * broken one left out), products shown small, whether "from" is shown,
 * and its slides (their words filled, links placed, pictures sized) and
 * how they turn when the shop saved them.
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
  if (section.variant === "full_image") {
    // adr/0077 §9: its settings as saved; the search box and the badges are the storefront's to read
    return {
      ...shown,
      variant: section.variant,
      title_accent: readers.fill(section.title_accent),
      action: section.action,
      search_position: section.search_position,
      height: section.height,
      scrim: section.scrim,
      align: section.align,
      image_side: section.image_side,
      edge: section.edge,
      show_trust: section.show_trust,
      // The storefront takes the video's id from the link and builds the player's address itself
      video_url: section.video_url,
      video_label: section.video_label,
      // Plain text, no shop tokens to fill (`hand-note.ts`)
      note: section.note,
    }
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
    // Printed only when saved (Ek 2026-11-15), so an opening from before them prints as it did
    ...(section.slides
      ? {
          slides: section.slides.map((slide) => ({
            image: shownImage(readers, slide.image),
            heading: readers.fill(slide.heading),
            text: readers.fill(slide.text),
            links: present(slide.links.map((each) => readers.link(each))),
            link: readers.link(slide.link),
          })),
        }
      : {}),
    ...(section.scroller ? { scroller: section.scroller } : {}),
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
