// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ImageCue } from "../../../../../packages/themes/atolye/src/frame/ImageCue"

/**
 * `ImageCue` (adr/0067 Ek 2026-11-18): an image is marked `data-js-loaded`
 * once loaded and decoded, so a card's second photo fades in over the
 * first only with a picture to show; `<html>` carries `data-js-img` only
 * while it runs, so without the script nothing waits.
 */

let host: HTMLDivElement
let root: Root
const decode = vi.fn(() => Promise.resolve())

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  Object.defineProperty(HTMLImageElement.prototype, "decode", { value: decode, configurable: true })
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  document.body.replaceChildren()
  decode.mockClear()
})

const image = (complete: boolean) => {
  const img = document.createElement("img")
  Object.defineProperty(img, "complete", { value: complete })
  document.body.append(img)
  return img
}

describe("the image cue", () => {
  it("marks the images already loaded and the page as waiting, then lets go on unmount", () => {
    const done = image(true)
    const lazy = image(false)
    act(() => {
      root.render(<ImageCue />)
    })
    expect(document.documentElement.hasAttribute("data-js-img")).toBe(true)
    expect(done.hasAttribute("data-js-loaded")).toBe(true)
    expect(lazy.hasAttribute("data-js-loaded")).toBe(false)
    act(() => {
      root.unmount()
    })
    expect(document.documentElement.hasAttribute("data-js-img")).toBe(false)
    root = createRoot(host)
  })

  it("marks an image once its picture loads and is decoded, a failed one too", async () => {
    act(() => {
      root.render(<ImageCue />)
    })
    const second = image(false)
    const broken = image(false)
    second.dispatchEvent(new Event("load"))
    broken.dispatchEvent(new Event("error"))
    expect(decode).toHaveBeenCalledTimes(2)
    await act(async () => {
      await Promise.resolve()
    })
    expect(second.hasAttribute("data-js-loaded")).toBe(true)
    expect(broken.hasAttribute("data-js-loaded")).toBe(true)
  })

  it("still shows an image whose decode fails", async () => {
    decode.mockImplementationOnce(() => Promise.reject(new Error("EncodingError")))
    act(() => {
      root.render(<ImageCue />)
    })
    const odd = image(false)
    odd.dispatchEvent(new Event("load"))
    await act(async () => {
      await Promise.resolve()
    })
    expect(odd.hasAttribute("data-js-loaded")).toBe(true)
  })
})
