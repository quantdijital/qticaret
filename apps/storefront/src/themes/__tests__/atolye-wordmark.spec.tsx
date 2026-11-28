// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { ImageView } from "@qticaret/ui"
import { Wordmark } from "../../../../../packages/themes/atolye/src/frame/Wordmark"

/**
 * The header's mark with the shop's dark-ground logo (`logoOnDark`): both
 * drawn, the dark one hidden until `header-over.css` swaps them over the
 * opening's photograph; the link names the shop once.
 */

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  document.body.replaceChildren()
})

const image = (src: string, alt: string): ImageView => ({
  src,
  alt,
  width: 240,
  height: 60,
  sources: { avif: null, webp: null },
})

describe("the header's mark", () => {
  it("draws the logo alone without a dark-ground logo, as before", () => {
    act(() => {
      root.render(<Wordmark name="Rota" logo={image("/m/a.png", "Rota")} />)
    })
    const images = host.querySelectorAll("img")
    expect(images).toHaveLength(1)
    expect(host.querySelector("[data-gf-logo]")).toBe(null)
    expect(images[0]?.getAttribute("alt")).toBe("Rota")
  })

  it("draws the dark-ground twin hidden, sized, and silent", () => {
    act(() => {
      root.render(
        <Wordmark
          name="Rota"
          logo={image("/m/a.png", "Rota")}
          logoOnDark={image("/m/k.png", "Rota")}
        />
      )
    })
    const link = host.querySelector("a")
    expect(link?.getAttribute("aria-label")).toBe("Rota")
    const light = host.querySelector('[data-gf-logo="light"] img')
    const dark = host.querySelector('[data-gf-logo="dark"]')
    expect(light?.getAttribute("src")).toBe("/m/a.png")
    expect(dark?.getAttribute("aria-hidden")).toBe("true")
    expect(dark?.className).toContain("hidden")
    const twin = dark?.querySelector("img")
    expect(twin?.getAttribute("src")).toBe("/m/k.png")
    expect(twin?.getAttribute("alt")).toBe("")
    expect(twin?.getAttribute("width")).toBe("240")
    expect(twin?.getAttribute("height")).toBe("60")
  })

  it("draws the name without a logo, even with a dark-ground one", () => {
    act(() => {
      root.render(<Wordmark name="Rota" logo={null} logoOnDark={image("/m/k.png", "")} />)
    })
    expect(host.querySelector("img")).toBe(null)
    expect(host.textContent).toBe("Rota")
  })
})
