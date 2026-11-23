import { z } from "@medusajs/framework/zod"
import { image, optional, shopText, text, title } from "../layout-fields"
import { storefrontLink } from "../menus"
import { bodyFields } from "./look"

/**
 * The photo collage (`photo_collage`, adr/0077 §10): an optional title and
 * intro over three to seven of the shop's photographs from its media
 * library, each with its words (required: nothing else names a picture
 * here), an optional caption and link. Its ground and alignment are the
 * look's; its corners and gaps the theme's. Mirrors `@qticaret/types`'
 * `PHOTO_COLLAGE_LIMITS`, `PHOTO_COLLAGE_SETTINGS` and
 * `PHOTO_COLLAGE_DEFAULTS` (the backend reads no runtime value from that
 * package); a unit test keeps them equal.
 */
export const PHOTO_COLLAGE_LIMITS = {
  items: { min: 3, max: 7 },
  intro: 240,
  caption: 60,
  alt: 300,
} as const

export const PHOTO_COLLAGE_SETTINGS = {
  layout: ["asymmetric", "even"],
  phone: ["scroll", "stack"],
} as const satisfies Record<string, readonly [string, ...string[]]>

type Setting = keyof typeof PHOTO_COLLAGE_SETTINGS
type Step<S extends Setting> = (typeof PHOTO_COLLAGE_SETTINGS)[S][number]

export const PHOTO_COLLAGE_DEFAULTS: { readonly [S in Setting]: Step<S> } = {
  layout: "asymmetric",
  phone: "scroll",
}

const SETTING_ERROR = { error: "storefront_layout.section_invalid" }

/** A step off the list is a stale or forged editor (a custom check: Medusa's answer drops an enum's key). */
const setting = <S extends Setting>(name: S) => {
  const steps: readonly unknown[] = PHOTO_COLLAGE_SETTINGS[name]
  return z
    .custom<Step<S>>((value) => steps.includes(value), SETTING_ERROR)
    .default(PHOTO_COLLAGE_DEFAULTS[name])
}

/** A library picture whose words are written: a collage's photograph is never left unnamed. */
const described = z.object({ url: image.shape.url, alt: text(PHOTO_COLLAGE_LIMITS.alt) }).strict()

export const photoCollage = z
  .object({
    ...bodyFields,
    type: z.literal("photo_collage"),
    /** None: no heading. */
    title,
    intro: optional(shopText(PHOTO_COLLAGE_LIMITS.intro)),
    items: z
      .array(
        z
          .object({
            image: described,
            caption: optional(shopText(PHOTO_COLLAGE_LIMITS.caption)),
            link: optional(storefrontLink),
          })
          .strict()
      )
      .min(PHOTO_COLLAGE_LIMITS.items.min)
      .max(PHOTO_COLLAGE_LIMITS.items.max),
    layout: setting("layout"),
    phone: setting("phone"),
  })
  .strict()

export type PhotoCollageSection = z.infer<typeof photoCollage>

/** Every picture the collage shows (each from the media library, `layout-check`). */
export const photoCollageImages = (section: PhotoCollageSection): string[] =>
  section.items.map((each) => each.image.url)
