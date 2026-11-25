import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import "@/lib/i18n"
import type { PopupDesign, PopupLayout } from "@/features/popups/api/types"
import type { PreviewContent } from "./preview-box"
import { PageFrame } from "./preview-card"
import { boxWidth, fitScale, previewScreen, scaledHeight } from "./preview-scale"
import type { Device } from "./preview-scale"

describe("the pop-up preview's scale", () => {
  it("scales the screen down to the room, rounded down", () => {
    expect(fitScale(288, 576)).toBe(0.5)
    expect(fitScale(300, 576)).toBe(0.52)
    expect(fitScale(224, 390)).toBe(0.574)
  })

  it("crops a laptop's page around the pop-up: its width and a margin each side", () => {
    expect(previewScreen("desktop", "modal", "classic", true)).toEqual({ width: 576, height: 360 })
    expect(previewScreen("desktop", "modal", "split", true)).toEqual({ width: 816, height: 360 })
    expect(previewScreen("desktop", "corner", "split", true)).toEqual({ width: 448, height: 440 })
    expect(previewScreen("mobile", "modal", "split", true)).toEqual({ width: 390, height: 844 })
  })

  it("lands a window around half its size in the ~300 px sticky column", () => {
    const scale = fitScale(300, previewScreen("desktop", "modal", "classic", false).width)
    expect(scale).toBeGreaterThanOrEqual(0.5)
    expect(scale).toBeLessThan(0.6)
  })

  it("never draws the screen larger than it is, nor at all while the room is unmeasured", () => {
    expect(fitScale(2000, 576)).toBe(1)
    expect(fitScale(0, 576)).toBe(0)
  })

  it("takes the viewport's height, or the taller screen a long pop-up made", () => {
    expect(scaledHeight(0, 360, 0.5)).toBe(180)
    expect(scaledHeight(1100, 360, 0.5)).toBe(550)
  })

  it("draws the pop-up as wide as the storefront does", () => {
    expect(boxWidth("modal", "classic", true)).toBe(480)
    expect(boxWidth("modal", "split", true)).toBe(720)
    expect(boxWidth("modal", "split", false)).toBe(480)
    expect(boxWidth("corner", "split", true)).toBe(384)
  })
})

const DESIGNS: PopupDesign[] = ["classic", "split", "hero", "minimal", "coupon"]

const content = (design: PopupDesign, imageUrl: string): PreviewContent => ({
  type: design === "coupon" ? "campaign" : "info",
  design,
  title: "Kış indirimi başladı, tüm bıçaklarda yüzde yirmi indirim ".repeat(3),
  body: "Uzun bir açıklama satırı.\n".repeat(30),
  imageUrl,
  imageAlt: "",
  buttonLabel: "Alışverişe başla",
  code: "KIS20",
})

/** The room is 288 px wide; the screen is as tall as `screenHeight` (a long pop-up's). */
let screenHeight = 0
const descriptors = {
  clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
  offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight"),
}

describe("the pop-up preview's screen", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset["previewRoom"] ? 288 : 0
      },
    })
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset["previewScreen"] ? screenHeight : 0
      },
    })
  })

  afterEach(() => {
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, name, descriptor)
      }
    }
  })

  const draw = (device: Device, layout: PopupLayout, design: PopupDesign, imageUrl: string) => {
    const view = render(
      <PageFrame device={device} layout={layout} content={content(design, imageUrl)} />
    )
    const room = view.container.querySelector<HTMLElement>("[data-preview-room]")
    const screen = view.container.querySelector<HTMLElement>("[data-preview-screen]")
    const box = view.container.querySelector<HTMLElement>("[data-preview-design]")
    if (!room || !screen || !box) {
      throw new Error("the preview is not drawn")
    }
    return { room, screen, box }
  }

  it("grows with a long pop-up instead of cutting it: the room is the screen's height scaled", () => {
    screenHeight = 1100
    const { room, screen } = draw("desktop", "modal", "classic", "/kis.jpg")
    expect(screen.style.transform).toBe("scale(0.5)")
    expect(screen.style.width).toBe("576px")
    // A minimum, never a fixed height: the screen grows with what it holds
    expect(screen.style.minHeight).toBe("360px")
    expect(screen.style.height).toBe("")
    expect(room.style.height).toBe("550px")
  })

  it("keeps the viewport's height for a short pop-up, a phone's screen at 390 px", () => {
    screenHeight = 0
    const { room, screen } = draw("mobile", "modal", "minimal", "")
    expect(screen.style.width).toBe("390px")
    expect(screen.style.minHeight).toBe("844px")
    // 288 / 390, rounded down to a thousandth, of 844 px
    expect(room.style.height).toBe(`${String(Math.ceil(844 * 0.738))}px`)
  })

  it.each(
    (["desktop", "mobile"] as const).flatMap((device) =>
      (["modal", "corner"] as const).flatMap((layout) =>
        DESIGNS.flatMap((design) =>
          ["", "/kis.jpg"].map((image) => [device, layout, design, image] as const)
        )
      )
    )
  )("never clips the %s %s %s pop-up (picture %j) or its text", (device, layout, design, image) => {
    screenHeight = 0
    const { room, box } = draw(device, layout, design, image)
    // Nothing between the pop-up and the room hides what overflows (the room clips only
    // the unscaled screen's width, which the scale brings back inside it)
    for (let node = box.parentElement; node && node !== room; node = node.parentElement) {
      expect(node.className).not.toMatch(/overflow-(hidden|clip)|max-h-/)
    }
    expect(box.className).not.toMatch(/overflow-hidden|max-h-|line-clamp/)
    for (const text of box.querySelectorAll("p")) {
      expect(text.className).not.toMatch(/line-clamp|truncate/)
    }
  })
})
