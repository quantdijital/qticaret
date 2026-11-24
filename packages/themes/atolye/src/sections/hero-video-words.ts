import type { Translate } from "@qticaret/ui"

/**
 * The opening's video button's words, read on the server (docs/19 §6.2:
 * a client component gets its words translated, never `t`).
 */
export interface HeroVideoWords {
  /** The button's words when the shop wrote none. */
  play: string
  close: string
  /** The lightbox's and the player's name, by whose player it is. */
  youtube: string
  vimeo: string
}

export const heroVideoWords = (t: Translate): HeroVideoWords => ({
  play: t("home.hero_video"),
  close: t("home.hero_video_close"),
  youtube: t("home.hero_video_youtube"),
  vimeo: t("home.hero_video_vimeo"),
})
