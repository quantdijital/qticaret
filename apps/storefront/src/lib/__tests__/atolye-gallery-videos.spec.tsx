// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ImageView, ProductVideoView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { Gallery } from "../../../../../packages/themes/atolye/src/product/Gallery"
import {
  gallerySlides,
  slideOfPlace,
} from "../../../../../packages/themes/atolye/src/product/gallery-slides"
import { galleryWords } from "../../../../../packages/themes/atolye/src/product/words"

/**
 * The shop's videos among the Grafit gallery's photographs (adr/0069 §7):
 * each after as many photographs as it says, the photographs' own places
 * (a variant's, the zoom's) unmoved, a play mark on its thumbnail, the
 * zoom stepping through the photographs alone. A product without videos
 * draws the gallery it drew before; one without photographs shows the
 * poster as its first picture.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const picture = (name: string): ImageView => ({
  src: `/media/${name}.webp`,
  alt: name,
  width: 1000,
  height: 1000,
  sources: { avif: null, webp: null },
})

const video = (id: string, after = 1): ProductVideoView => ({
  id,
  after,
  title: `Klip ${id}`,
  poster: picture(`${id}-kapak`),
  width: 720,
  height: 1280,
  durationSeconds: 12,
  sources: { webm: `/media/${id}.webm`, mp4: `/media/${id}.mp4` },
})

const images = ["set", "kirmizi", "yesil", "yakin"].map(picture)
const own = { variant_kirmizi: [1], variant_yesil: [2] }
const words = galleryWords(t)

const render = (props: Partial<Parameters<typeof Gallery>[0]> = {}) =>
  renderToStaticMarkup(createElement(Gallery, { images, own, initial: "Ş", words, ...props }))

/** The rail's squares in order: a photograph's name, or `video:<id>`. */
const squares = (html: string) =>
  [...html.matchAll(/<li[^>]*id="gorsel-\d+"[^>]*>([\s\S]*?)<\/li>/g)].map((match) => {
    const body = match[1] ?? ""
    const clip = /data-video="([^"]+)"/.exec(body)
    return clip ? `video:${clip[1] ?? ""}` : (/src="\/media\/(\w+)\.webp"/.exec(body)?.[1] ?? "")
  })

describe("gallerySlides", () => {
  it("puts each video after as many pictures as it says, in the order given", () => {
    const slides = gallerySlides(images, [video("a"), video("b", 2), video("c", 1)])
    expect(slides.map((slide) => (slide.kind === "image" ? slide.place : slide.video.id))).toEqual([
      0,
      "a",
      "c",
      1,
      "b",
      2,
      3,
    ])
    // The zoom's places map back to their squares
    expect(slideOfPlace(slides, 1)).toBe(3)
    expect(slideOfPlace(slides, 9)).toBe(0)
  })

  it("never before the first photograph, after the last when it says more", () => {
    const ids = (slides: ReturnType<typeof gallerySlides>) =>
      slides.map((slide) => (slide.kind === "image" ? slide.place : slide.video.id))
    expect(ids(gallerySlides(images.slice(0, 2), [video("a", 0), video("b", 7)]))).toEqual([
      0,
      "a",
      1,
      "b",
    ])
    expect(ids(gallerySlides([], [video("a")]))).toEqual(["a"])
    expect(ids(gallerySlides(images))).toEqual([0, 1, 2, 3])
  })
})

describe("the gallery's first HTML with videos", () => {
  it("draws a product without videos exactly as before", () => {
    const before = render()
    expect(render({ videos: [] })).toBe(before)
    expect(before).not.toContain("data-video")
    expect(before).not.toContain("<video")
  })

  it("sits the video at its place, the first photograph still the eager one", () => {
    const html = render({ videos: [video("mvid_1")] })
    expect(squares(html)).toEqual(["set", "video:mvid_1", "kirmizi", "yesil", "yakin"])
    expect(html).toContain("1 / 5")
    expect(html.match(/fetchPriority="high"/g)).toHaveLength(1)
    expect(html.indexOf('fetchPriority="high"')).toBeLessThan(html.indexOf("mvid_1-kapak"))
    // Nothing of the clip in the first HTML: no source, nothing preloaded
    expect(html).not.toMatch(/<source[^>]*src=/)
    expect(html).toContain('preload="none"')
  })

  it("keeps the variants' own pictures following the choice, the video after the first", () => {
    const html = render({ videos: [video("mvid_1")], openOn: "variant_yesil" })
    expect(squares(html)).toEqual(["yesil", "video:mvid_1", "set", "yakin"])
    expect(html).toContain("1 / 4")
  })

  it("gives the video's thumbnail its poster, a play mark and its title", () => {
    const html = render({ videos: [video("mvid_1")] })
    const thumbs = [
      ...html.matchAll(/<a href="#gorsel-(\d)"[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),
    ]
    expect(thumbs.map((match) => match[2])).toEqual([
      "Görsel 1",
      "Video: Klip mvid_1",
      "Görsel 3",
      "Görsel 4",
      "Görsel 5",
    ])
    expect(thumbs[1]?.[3]).toContain("mvid_1-kapak.webp")
    expect(thumbs[1]?.[3]).toContain("data-video-mark")
    expect(thumbs.filter((match) => match[3]?.includes("data-video-mark"))).toHaveLength(1)
  })

  it("shows a product without photographs its poster first, eager, as the only square", () => {
    const html = render({ images: [], own: {}, videos: [video("mvid_1")] })
    expect(squares(html)).toEqual(["video:mvid_1"])
    expect(html).toContain('fetchPriority="high"')
    expect(html).not.toContain(words.noImage)
  })
})

describe("the gallery's zoom with a video", () => {
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

  it("steps through the photographs alone, and a press on the video's square opens nothing", async () => {
    await act(async () => {
      root.render(<Gallery images={images} videos={[video("mvid_1")]} initial="Ş" words={words} />)
      await new Promise((done) => setTimeout(done, 20))
    })
    const square = host.querySelector<HTMLElement>("#gorsel-2")
    await act(async () => {
      square?.click()
      await new Promise((done) => setTimeout(done, 20))
    })
    expect(document.querySelector("[role=dialog]")).toBeNull()

    // The third square is the second photograph: the zoom counts four, on the second
    await act(async () => {
      host.querySelector<HTMLElement>("#gorsel-3")?.click()
      await new Promise((done) => setTimeout(done, 20))
    })
    const dialog = document.querySelector("[role=dialog]")
    expect(dialog?.querySelector("h2")?.textContent).toBe("2 / 4")
    expect(dialog?.querySelector("video")).toBeNull()
  })
})
