import type { MenuLinkInput } from "../../lib/storefront/menus"
import type { BannerSection } from "../../lib/storefront/sections/banner"
import type { PostsSection } from "../../lib/storefront/sections/posts"
import type { StoreLayoutImage, StoreLayoutLink } from "./layout-hydrate"

/** What the band and the posts are printed with: the hydrate's own helpers. */
export interface BandContext {
  fill: (text: string | null) => string | null
  link: (each: MenuLinkInput | null) => StoreLayoutLink | null
  image: (url: string, alt: string | null) => StoreLayoutImage
}

/**
 * The picture band as the storefront prints it (adr/0049 Ek 2026-11-14
 * §3.3 E2): each slide's pictures with what the media library knows of
 * them (the shop's alt kept), its words filled, its buttons placed (a
 * broken one null), the band's steps as saved. The split's own (adr/0077
 * Ek) only on a `split`, so a `standard` band prints as it did before
 * variants.
 */
export function hydrateBanner(section: BannerSection, at: BandContext) {
  const { id, type } = section
  return {
    id,
    type,
    slides: section.slides.map((slide) => ({
      image: { ...at.image(slide.image.url, slide.image.alt), alt: slide.image.alt },
      mobile_image: slide.mobile_image
        ? {
            ...at.image(slide.mobile_image.url, slide.mobile_image.alt),
            alt: slide.mobile_image.alt,
          }
        : null,
      heading: at.fill(slide.heading),
      text: at.fill(slide.text),
      link: at.link(slide.link),
      second_link: at.link(slide.second_link),
      tone: slide.tone,
    })),
    width: section.width,
    height: section.height,
    text_position: section.text_position,
    overlay: section.overlay,
    button_style: section.button_style,
    ...(section.variant === "split"
      ? {
          variant: section.variant,
          eyebrow: at.fill(section.eyebrow),
          edge: section.edge,
          // The hand note is plain text, no shop tokens to fill (`hand-note.ts`)
          note: section.note,
        }
      : {}),
  }
}

/**
 * The newest posts as the storefront prints them: the title and the count
 * (the posts are the storefront's to fetch); the intro panel's own
 * (adr/0077 Ek) only on an `intro_panel`, its words filled and its button
 * placed (a broken one null), so a `grid` prints as it did before variants.
 */
export function hydratePosts(section: PostsSection, at: BandContext) {
  const { id, type } = section
  const printed = { id, type, title: section.title, limit: section.limit }
  return section.variant === "intro_panel"
    ? {
        ...printed,
        variant: section.variant,
        eyebrow: at.fill(section.eyebrow),
        intro: at.fill(section.intro),
        link: at.link(section.link),
      }
    : printed
}
