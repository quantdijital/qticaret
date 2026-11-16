// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ImageView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { Gallery } from "../../../../../packages/themes/atolye/src/product/Gallery"
import { onPicture } from "../../../../../packages/themes/atolye/src/product/Zoom"
import { galleryWords } from "../../../../../packages/themes/atolye/src/product/words"

/**
 * The gallery's full-screen picture (owner 2026-11-16: "görselin dışına
 * tıklarsam görsele yakınlaştırma yapıyor. ve görsel ekranın tam ortasında
 * da değil"): a press on the photograph's own pixels enlarges it, a press
 * on the graphite around it closes (the focus back on the enlarge button),
 * a drag does neither; the photograph stands centred, as much room below
 * it as the bar above. jsdom draws nothing: the boxes are given here, the
 * centring is checked by its structure (a browser's eye is the main
 * session's).
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const picture = (name: string): ImageView => ({
  src: `/media/${name}.webp`,
  alt: name,
  width: 1000,
  height: 1000,
  sources: { avif: null, webp: null },
})

class Watcher {
  observe = () => undefined
  unobserve = () => undefined
  disconnect = () => undefined
}
vi.stubGlobal("ResizeObserver", Watcher)
vi.stubGlobal("IntersectionObserver", Watcher)
for (const name of ["scrollBy", "scrollTo", "scrollIntoView"] as const) {
  Element.prototype[name] = () => undefined
}
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}))

const words = galleryWords(t)
let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
})

const settle = () => new Promise((done) => setTimeout(done, 20))

/** The picture's area below the 64 px bar on a 1000 × 728 screen: 1000 × 600. */
const AREA = { left: 0, top: 64, width: 1000, height: 600 }
const rect = (box: typeof AREA): DOMRect => ({
  ...box,
  x: box.left,
  y: box.top,
  right: box.left + box.width,
  bottom: box.top + box.height,
  toJSON: () => box,
})

async function open() {
  await act(async () => {
    root.render(<Gallery images={["a", "b"].map(picture)} initial="R" words={words} />)
    await settle()
  })
  const opener = host.querySelector<HTMLButtonElement>(`button[aria-label="${words.zoom}"]`)
  await act(async () => {
    opener?.focus()
    opener?.click()
    await settle()
  })
  const dialog = document.querySelector<HTMLElement>("[role=dialog]")
  const lens = dialog?.querySelector<HTMLElement>(".gf-zoom")
  const img = lens?.querySelector("img")
  if (!opener || !dialog || !lens || !img) {
    throw new Error("the zoom did not open")
  }
  // A square photograph fitted into the 1000 × 600 area: 600 × 600 from x 200 to 800
  lens.getBoundingClientRect = () => rect(AREA)
  img.getBoundingClientRect = () => rect(AREA)
  // The lens's frame: never scaled, the area itself
  if (lens.parentElement) {
    lens.parentElement.getBoundingClientRect = () => rect(AREA)
  }
  Object.defineProperty(img, "naturalWidth", { value: 1000 })
  Object.defineProperty(img, "naturalHeight", { value: 1000 })
  return { opener, dialog, lens, img }
}

/**
 * A mouse pressed at one point and let go at another (the same one: a
 * press), as a browser sends it: down, up, then the click at the release.
 */
async function press(on: Element, from: [number, number], to: [number, number] = from) {
  const at = (point: [number, number]) => ({
    bubbles: true,
    clientX: point[0],
    clientY: point[1],
  })
  await act(async () => {
    on.dispatchEvent(new MouseEvent("pointerdown", at(from)))
    on.dispatchEvent(new MouseEvent("pointerup", at(to)))
    on.dispatchEvent(new MouseEvent("click", at(to)))
    await settle()
  })
}

describe("the gallery's zoom: where a press lands", () => {
  it("enlarges where the photograph itself is pressed, and lets go on a second press", async () => {
    const { lens, img } = await open()
    await press(img, [500, 364])
    expect(lens.hasAttribute("data-zoomed")).toBe(true)
    // The origin is the point pressed: the area's middle
    expect(lens.style.getPropertyValue("transform-origin")).toBe("50% 50%")
    expect(document.querySelector("[role=dialog]")).not.toBeNull()
    await press(img, [500, 364])
    expect(lens.hasAttribute("data-zoomed")).toBe(false)
  })

  it("closes on the graphite beside the photograph, without enlarging, the focus back on the opener", async () => {
    const { opener, lens, img } = await open()
    // Inside the picture element's box, outside the photograph: the band left of it
    await press(img, [100, 364])
    expect(lens.hasAttribute("data-zoomed")).toBe(false)
    expect(document.querySelector("[role=dialog]")).toBeNull()
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(opener)
    })
  })

  it("closes on the bar above the photograph, outside its buttons", async () => {
    const { dialog } = await open()
    await press(dialog.querySelector("h2") ?? dialog, [300, 30])
    expect(document.querySelector("[role=dialog]")).toBeNull()
  })

  it("closes when enlarged too, on the graphite left around it", async () => {
    const { lens, img } = await open()
    await press(img, [500, 364])
    expect(lens.hasAttribute("data-zoomed")).toBe(true)
    await press(img, [150, 364])
    expect(document.querySelector("[role=dialog]")).toBeNull()
  })

  it("neither closes nor lets go when the enlarged photograph is dragged, from it or past its edge", async () => {
    const { lens, img } = await open()
    await press(img, [500, 364])
    await press(img, [500, 364], [560, 380])
    await press(img, [300, 364], [100, 364])
    expect(document.querySelector("[role=dialog]")).not.toBeNull()
    expect(lens.hasAttribute("data-zoomed")).toBe(true)
  })

  it("decides on the click, not on the release: nothing is left for a click to fall through to", async () => {
    const { lens, img } = await open()
    await act(async () => {
      img.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 364 })
      )
      img.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 100, clientY: 364 }))
      await settle()
    })
    // The release alone: still open, so the click that follows lands in the dialog, not the page
    expect(document.querySelector("[role=dialog]")).not.toBeNull()
    expect(lens.hasAttribute("data-zoomed")).toBe(false)
    await act(async () => {
      img.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 100, clientY: 364 }))
      await settle()
    })
    expect(document.querySelector("[role=dialog]")).toBeNull()
  })

  it("follows the pointer on the unscaled frame while enlarged, so one jump reaches the graphite", async () => {
    const { lens, img } = await open()
    await press(img, [500, 364])
    // Enlarged two and a half times about the middle: the lens's own box is that large now
    const big = { left: -750, top: -386, width: 2500, height: 1500 }
    lens.getBoundingClientRect = () => rect(big)
    await act(async () => {
      lens.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX: 250, clientY: 304 })
      )
      await settle()
    })
    // The point over the frame (25 %, 40 %), not over the enlarged box
    expect(lens.style.getPropertyValue("transform-origin")).toBe("25% 40%")
  })

  it("leaves a press on a button to the button: the arrows step, the close button closes", async () => {
    const { dialog, lens } = await open()
    const next = dialog.querySelector(`button[aria-label="${words.next}"]`) ?? dialog
    expect(next).not.toBe(dialog)
    await press(next, [980, 364])
    expect(document.querySelector("[role=dialog]")).not.toBeNull()
    expect(lens.hasAttribute("data-zoomed")).toBe(false)
  })
})

describe("the gallery's zoom: the photograph centred", () => {
  it("fills the dynamic viewport and matches the bar above with as much room below", async () => {
    const { dialog, lens } = await open()
    expect(dialog.className).toContain("h-dvh")
    const [bar, area, foot] = Array.from(dialog.children)
    expect(bar?.className).toContain("h-16")
    expect(foot?.className).toContain("h-16")
    expect(area?.className).toContain("flex-1")
    // The photograph fits its area and is centred in it (object-contain's own centre)
    expect(lens.className).toContain("inset-0")
    expect(lens.querySelector("img")?.className).toContain("object-contain")
  })

  it("finds the photograph's pixels for every shape: tall, wide, square, small", () => {
    const img = document.createElement("img")
    img.getBoundingClientRect = () => rect(AREA)
    const shaped = (width: number, height: number) => {
      Object.defineProperty(img, "naturalWidth", { value: width, configurable: true })
      Object.defineProperty(img, "naturalHeight", { value: height, configurable: true })
    }
    // Tall 400 × 800: 300 × 600 centred, x 350 to 650
    shaped(400, 800)
    expect([onPicture(img, 349, 364), onPicture(img, 351, 364), onPicture(img, 651, 364)]).toEqual([
      false,
      true,
      false,
    ])
    // Wide 2000 × 500: 1000 × 250 centred, y 239 to 489
    shaped(2000, 500)
    expect([onPicture(img, 500, 238), onPicture(img, 500, 240), onPicture(img, 500, 490)]).toEqual([
      false,
      true,
      false,
    ])
    // Small 100 × 100 is fitted up as the picture draws it: 600 × 600
    shaped(100, 100)
    expect([onPicture(img, 199, 364), onPicture(img, 201, 364)]).toEqual([false, true])
    // Not loaded and no size known: the whole box is the picture
    shaped(0, 0)
    expect(onPicture(img, 5, 70)).toBe(true)
  })
})
