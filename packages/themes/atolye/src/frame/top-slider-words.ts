import type { Translate } from "@qticaret/ui"
import type { TopSliderWords } from "./TopSlider"

/** The top image slider's words for `count` slides. */
export function topSliderWords(t: Translate, count: number): TopSliderWords {
  return {
    label: t("top_slider.label"),
    previous: t("top_slider.previous"),
    next: t("top_slider.next"),
    pause: t("top_slider.pause"),
    play: t("top_slider.play"),
    slides: Array.from({ length: count }, (_, index) =>
      t("top_slider.slide", { n: index + 1, total: count })
    ),
    goTo: Array.from({ length: count }, (_, index) => t("top_slider.go", { n: index + 1 })),
  }
}
