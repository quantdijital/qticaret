import type { Translate } from "@qticaret/ui"
import type { SliderWords } from "./SliderControls"

/**
 * A slider's words in the shopper's language (the server's `t`), for its
 * stage and controls: the openings' sliders share them. Not in the client
 * module: the server calls it while drawing the section.
 */
export function sliderWords(t: Translate, count: number): SliderWords {
  return {
    label: t("home.slider"),
    previous: t("home.slider_previous"),
    next: t("home.slider_next"),
    play: t("home.slider_play"),
    pause: t("home.slider_pause"),
    picker: t("home.slider_picker"),
    slides: Array.from({ length: count }, (_, index) =>
      t("home.slider_slide", { n: index + 1, total: count })
    ),
    goTo: Array.from({ length: count }, (_, index) => t("home.slider_go", { n: index + 1 })),
  }
}
