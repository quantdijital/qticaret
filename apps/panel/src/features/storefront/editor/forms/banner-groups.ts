import { BANNER_SETTINGS } from "@qticaret/types"
import type { BannerSetting } from "@qticaret/types"
import type { FieldGroupName } from "./field-registry"

/**
 * Where the band's settings sit (docs/tema/bilesen-denetimi 1.4): its
 * height, the words' place and the veil, the basics, open in "Diziliş"
 * under its pictures; its width and the buttons' style in "Görünüm"
 * (Stil) with the page's look.
 */
export const BANNER_GROUPS: Readonly<Record<BannerSetting, FieldGroupName>> = {
  width: "frame",
  height: "layout",
  text_position: "layout",
  overlay: "layout",
  button_style: "frame",
}

const bannerIn = (group: FieldGroupName): readonly BannerSetting[] =>
  (Object.keys(BANNER_SETTINGS) as BannerSetting[]).filter(
    (setting) => BANNER_GROUPS[setting] === group
  )

/** The band's basics: the open "Diziliş" group. */
export const BANNER_LAYOUT_SETTINGS = bannerIn("layout")

/** The band's width and buttons, with the look in "Görünüm" (Stil). */
export const BANNER_FRAME_SETTINGS = bannerIn("frame")
