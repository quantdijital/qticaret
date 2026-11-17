// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ImageView, ProductVideoView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { Gallery } from "../../../../../packages/themes/atolye/src/product/Gallery"
import {
  GalleryYoutube,
  youtubePlayerSrc,
} from "../../../../../packages/themes/atolye/src/product/GalleryYoutube"
import { galleryWords } from "../../../../../packages/themes/atolye/src/product/words"

/**
 * A product's YouTube video in the Grafit gallery (adr/0069 §7, §8): its
 * cover from the shop's own storage, "Videoyu oynat" and the line saying
 * it loads from YouTube; nothing of YouTube's in the page before the
 * press (no frame, no address of Google's), then the privacy-enhanced
 * player framed, exactly, named after the video.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ID = "dQw4w9WgXcQ"
const PLAYER = `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&playsinline=1&rel=0`

const picture = (name: string): ImageView => ({
  src: `/media/${name}.webp`,
  alt: name,
  width: 1280,
  height: 720,
  sources: { avif: null, webp: `/media/${name}-640.webp 640w` },
})

const youtube = (fields: Partial<ProductVideoView> = {}): ProductVideoView => ({
  id: "mvid_yt",
  after: 1,
  title: "Bileme rehberi",
  poster: picture("bileme-tasi-video-1"),
  width: null,
  height: null,
  durationSeconds: null,
  youtube: { embedUrl: `https://www.youtube-nocookie.com/embed/${ID}` },
  ...fields,
})

vi.stubGlobal(
  "IntersectionObserver",
  class {
    observe = () => undefined
    unobserve = () => undefined
    disconnect = () => undefined
  }
)

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

async function draw(video: ProductVideoView = youtube()) {
  await act(async () => {
    root.render(<GalleryYoutube video={video} sizes="100vw" words={words} />)
    await new Promise((done) => setTimeout(done, 20))
  })
}

const playButton = () =>
  [...host.querySelectorAll("button")].find((button) =>
    button.getAttribute("aria-label")?.startsWith("Videoyu oynat")
  )

describe("a YouTube video's square", () => {
  it("shows our cover, the play button and the line, and nothing of YouTube's before the press", async () => {
    await draw()
    expect(host.querySelector("iframe")).toBeNull()
    expect(host.querySelector("img")?.getAttribute("src")).toBe("/media/bileme-tasi-video-1.webp")
    expect(playButton()?.getAttribute("aria-label")).toBe("Videoyu oynat: Bileme rehberi")
    expect(playButton()?.textContent).toBe("Videoyu oynat")
    expect(host.textContent).toContain("Oynattığınızda video YouTube'dan yüklenir.")
    // No address of YouTube's or Google's in any attribute of the drawn square
    const attributes = [...host.querySelectorAll("*")].flatMap((element) =>
      [...element.attributes].map((attribute) => attribute.value)
    )
    expect(attributes.join(" ")).not.toMatch(/youtube|ytimg|google/i)
  })

  it("frames exactly the privacy-enhanced player once pressed, named after the video", async () => {
    await draw()
    await act(async () => {
      playButton()?.click()
      await new Promise((done) => setTimeout(done, 20))
    })
    const frames = host.querySelectorAll("iframe")
    expect(frames).toHaveLength(1)
    const frame = frames[0]
    expect(frame?.getAttribute("src")).toBe(PLAYER)
    expect(frame?.getAttribute("title")).toBe("YouTube videosu: Bileme rehberi")
    expect(frame?.getAttribute("allow")).toBe("autoplay; encrypted-media; picture-in-picture")
    expect(frame?.hasAttribute("allowfullscreen")).toBe(true)
    expect(frame?.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin")
    // The keyboard goes on inside the player; the cover and the button are gone
    expect(document.activeElement).toBe(frame)
    expect(playButton()).toBeUndefined()
    expect(host.querySelector("img")).toBeNull()
  })

  it("names the player with the shop's title as written, `$` patterns and all", async () => {
    await draw(youtube({ title: "Bıçak $& $' rehberi" }))
    expect(playButton()?.getAttribute("aria-label")).toBe("Videoyu oynat: Bıçak $& $' rehberi")
    await act(async () => {
      playButton()?.click()
      await new Promise((done) => setTimeout(done, 20))
    })
    expect(host.querySelector("iframe")?.getAttribute("title")).toBe(
      "YouTube videosu: Bıçak $& $' rehberi"
    )
  })

  it.each([
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://evil.example/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&origin=x",
    "https://www.youtube-nocookie.com/embed/../../watch",
    "javascript:alert(1)",
  ])("never frames anything but the player's own address (%s): the cover alone", async (url) => {
    expect(youtubePlayerSrc(url)).toBeNull()
    await draw(youtube({ youtube: { embedUrl: url } }))
    expect(playButton()).toBeUndefined()
    expect(host.querySelector("iframe")).toBeNull()
    expect(host.querySelector("img")).not.toBeNull()
  })
})

describe("the gallery with a YouTube video", () => {
  const images = ["set", "yakin"].map(picture)
  const render = (videos: ProductVideoView[]) =>
    renderToStaticMarkup(createElement(Gallery, { images, videos, initial: "B", words }))

  it("draws it second, as its cover with a play mark on its thumbnail, and no frame", () => {
    const html = render([youtube()])
    expect(html).toContain('data-video="mvid_yt"')
    expect(html).not.toContain("<iframe")
    expect(html).not.toMatch(/youtube\.com|ytimg|googlevideo/)
    // The square holds the cover and the line; the button comes once the page runs
    expect(html).toContain("Oynattığınızda video YouTube&#x27;dan yüklenir.")
    expect(html).toContain('data-video-mark=""')
    expect(html.indexOf("/media/set.webp")).toBeLessThan(html.indexOf('data-video="mvid_yt"'))
  })

  it("draws a product without videos exactly as before", () => {
    expect(render([])).toBe(
      renderToStaticMarkup(createElement(Gallery, { images, initial: "B", words }))
    )
    expect(render([])).not.toContain("YouTube")
  })
})
