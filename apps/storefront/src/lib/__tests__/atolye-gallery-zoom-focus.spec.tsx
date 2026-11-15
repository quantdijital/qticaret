// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ImageView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { Gallery } from "../../../../../packages/themes/atolye/src/product/Gallery"
import { galleryWords } from "../../../../../packages/themes/atolye/src/product/words"

/**
 * The gallery's full-screen picture: closed by Escape or its close
 * button, the focus goes back to the round "enlarge" button, not to `body`.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const picture = (name: string): ImageView => ({
  src: `/media/${name}.webp`,
  alt: name,
  width: 1000,
  height: 1000,
  sources: { avif: null, webp: null },
})

/** jsdom has neither observer; the gallery only needs them to exist. */
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

async function open() {
  await act(async () => {
    root.render(<Gallery images={["a", "b"].map(picture)} initial="R" words={words} />)
    await settle()
  })
  const opener = host.querySelector<HTMLButtonElement>(`button[aria-label="${words.zoom}"]`)
  if (!opener) {
    throw new Error("no zoom button")
  }
  await act(async () => {
    opener.focus()
    opener.click()
    await settle()
  })
  expect(document.querySelector("[role=dialog]")).not.toBeNull()
  return opener
}

describe("the gallery's zoom", () => {
  it("gives the focus back to the enlarge button when Escape closes it", async () => {
    const opener = await open()
    await act(async () => {
      document
        .querySelector("[role=dialog]")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      await settle()
    })
    expect(document.querySelector("[role=dialog]")).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it("gives the focus back to the enlarge button when the close button is pressed", async () => {
    const opener = await open()
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`button[aria-label="${words.close}"]`)?.click()
      await settle()
    })
    expect(document.querySelector("[role=dialog]")).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it("does so too when a press on the picture opened it", async () => {
    await act(async () => {
      root.render(<Gallery images={["a", "b"].map(picture)} initial="R" words={words} />)
      await settle()
    })
    const opener = host.querySelector<HTMLButtonElement>(`button[aria-label="${words.zoom}"]`)
    await act(async () => {
      host.querySelector<HTMLElement>("li[data-index]")?.click()
      await settle()
    })
    await act(async () => {
      document
        .querySelector("[role=dialog]")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      await settle()
    })
    expect(document.activeElement).toBe(opener)
  })
})
