// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SLIDER_DEFAULTS } from "@qticaret/types/section-scroller"
import type { SliderSettings } from "@qticaret/types/section-scroller"
import {
  SliderArrows,
  SliderDots,
  type SliderWords,
} from "../../../../../packages/themes/atolye/src/sections/SliderControls"

/**
 * The openings' slider controls (adr/0049 Ek 2026-11-19): the arrows' shape,
 * size and ground, the dots' style and place, the pause button hidden from
 * sight but not from the keyboard, and their field marks in the editor's
 * preview only. The stage draws them once its script runs, so they are
 * rendered here on their own.
 */

const words: SliderWords = {
  label: "Öne çıkan seçkiler",
  previous: "Önceki slayt",
  next: "Sonraki slayt",
  play: "Slaytları oynat",
  pause: "Slaytları durdur",
  picker: "Slayt seçimi",
  slides: ["1 / 3", "2 / 3", "3 / 3"],
  goTo: ["1. slayta geç", "2. slayta geç", "3. slayta geç"],
}

const look = (over: Partial<SliderSettings> = {}) => ({ ...SLIDER_DEFAULTS, ...over })
const noop = () => undefined

const arrows = (over: Partial<SliderSettings> = {}, marks = false) => {
  const settings = look(over)
  const host = document.createElement("div")
  host.innerHTML = renderToStaticMarkup(
    <SliderArrows
      words={words}
      shape={settings.arrow_style}
      look={settings}
      marks={marks}
      atStart={false}
      atEnd={false}
      onStep={noop}
    />
  )
  return [...host.querySelectorAll("button")]
}

const dots = (over: Partial<SliderSettings> = {}, marks = false, index = 1) => {
  const settings = look(over)
  const host = document.createElement("div")
  host.innerHTML = renderToStaticMarkup(
    <SliderDots
      words={words}
      count={3}
      index={index}
      dots={settings.dots === "on"}
      look={settings}
      marks={marks}
      playControl={settings.autoplay === "on"}
      playing
      onPick={noop}
      onPlay={noop}
    />
  )
  return host
}

describe("the slider's arrows", () => {
  it("are circles when round, whatever the shop's button shape (the reported bug)", () => {
    for (const button of arrows()) {
      expect(button.className).toContain("rounded-full")
      expect(button.className).not.toContain("rounded-button")
    }
  })

  it("draw as before by default: 48 px on the graphite", () => {
    const [previous] = arrows()
    expect(previous?.className).toContain("size-12")
    expect(previous?.className).toContain("bg-stage/70")
    expect(previous?.querySelector("svg")?.getAttribute("class")).toContain("size-6")
  })

  it("take the shop's size and ground; a bare chevron takes no ground", () => {
    const [large] = arrows({ arrow_size: "large", controls_tone: "brand" })
    expect(large?.className).toContain("size-14")
    expect(large?.className).toContain("bg-signal")
    const [square] = arrows({ arrow_style: "square", arrow_size: "small", controls_tone: "light" })
    expect(square?.className).toContain("rounded-(--radius-inner)")
    expect(square?.className).toContain("size-10")
    expect(square?.className).toContain("bg-field/85")
    const [plain] = arrows({ arrow_style: "plain", controls_tone: "brand" })
    expect(plain?.className).not.toContain("bg-signal")
    expect(plain?.className).toContain("text-stage-text")
  })

  it("carry their field mark in the editor's preview only", () => {
    expect(arrows().some((button) => button.hasAttribute("data-qf"))).toBe(false)
    expect(arrows({}, true).map((button) => button.getAttribute("data-qf"))).toEqual([
      "scroller.arrows",
      "scroller.arrows",
    ])
  })
})

describe("the slider's dots", () => {
  it("draw as before by default: a dot a slide, the one in view a longer line, in the middle", () => {
    const host = dots()
    const picker = host.querySelector('[role="group"]')
    expect(picker?.getAttribute("aria-label")).toBe("Slayt seçimi")
    const marks = [...host.querySelectorAll("button[aria-label$='geç'] > span")]
    expect(marks.map((mark) => mark.className.includes("w-6"))).toEqual([false, true, false])
    expect(host.firstElementChild?.className).toContain("justify-center")
  })

  it("take the shop's style: lines, a count, a bar filled to the slide", () => {
    const lines = [...dots({ dot_style: "lines" }).querySelectorAll("button > span")]
    expect(lines.every((line) => line.className.includes("h-1 w-5"))).toBe(true)
    const count = dots({ dot_style: "count" })
    expect(count.querySelector("button[aria-label$='geç']")).toBeNull()
    expect(count.querySelector('[role="group"]')).toBeNull()
    expect(count.textContent).toBe("2 / 3")
    const bar = [...dots({ dot_style: "progress" }, false, 1).querySelectorAll("button > span")]
    expect(bar.map((part) => part.className.includes("bg-stage-text/45"))).toEqual([
      false,
      false,
      true,
    ])
  })

  it("stand where the shop said", () => {
    expect(dots({ controls_place: "start" }).firstElementChild?.className).toContain(
      "justify-start"
    )
    expect(dots({ controls_place: "end" }).firstElementChild?.className).toContain("justify-end")
  })

  it("keep a pause button the shop hid for the keyboard: out of sight until focused", () => {
    const shown = dots({ autoplay: "on" }).querySelector("button[aria-label='Slaytları durdur']")
    expect(shown?.className).not.toContain("sr-only")
    const hidden = dots({ autoplay: "on", play_button: "off", dots: "off" })
    const button = hidden.querySelector("button[aria-label='Slaytları durdur']")
    expect(button?.className).toContain("sr-only")
    expect(button?.className).toContain("focus-visible:not-sr-only")
    // Nothing else in the pill: its ground shows only with the button focused
    expect(hidden.querySelector(".rounded-button")?.className).toContain(
      "has-focus-visible:bg-stage/70"
    )
  })

  it("carry their field marks in the editor's preview only, a hidden pause button none", () => {
    expect(dots({ autoplay: "on" }).querySelector("[data-qf]")).toBeNull()
    const marked = dots({ autoplay: "on" }, true)
    expect([...marked.querySelectorAll("[data-qf]")].map((e) => e.getAttribute("data-qf"))).toEqual(
      ["scroller.play_button", "scroller.dots"]
    )
    const hidden = dots({ autoplay: "on", play_button: "off" }, true)
    expect([...hidden.querySelectorAll("[data-qf]")].map((e) => e.getAttribute("data-qf"))).toEqual(
      ["scroller.dots"]
    )
  })
})
