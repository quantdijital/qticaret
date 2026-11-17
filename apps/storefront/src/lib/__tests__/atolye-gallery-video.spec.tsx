// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ImageView, ProductVideoView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { GalleryVideo } from "../../../../../packages/themes/atolye/src/product/GalleryVideo"
import { galleryWords } from "../../../../../packages/themes/atolye/src/product/words"

/**
 * A product's clip in the Grafit gallery (adr/0069 §7): its poster first,
 * nothing of the clip before it is half in view, then its sources (WebM,
 * then MP4) and play; out of view it pauses. Reduced motion or the data
 * saver: no start by itself, the poster and "Videoyu oynat". The button
 * is always there, named after the clip; a refused `play()` leaves the
 * poster and the button, quietly. jsdom plays nothing: the media element's
 * calls are watched here.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const poster: ImageView = {
  src: "/media/sef-bicagi-video-1.jpg",
  alt: "Yakın çekim",
  width: 720,
  height: 1280,
  sources: { avif: null, webp: "/media/sef-bicagi-video-1-400.webp 400w" },
}

const clip: ProductVideoView = {
  id: "mvid_1",
  after: 1,
  title: "Yakın çekim",
  poster,
  width: 720,
  height: 1280,
  durationSeconds: 12,
  sources: { webm: "/media/sef-bicagi-video-1.webm", mp4: "/media/sef-bicagi-video-1.mp4" },
}

// What the page's observers watch: the clip's own is told when it comes in and out of view
const observers: { callback: IntersectionObserverCallback; targets: Element[] }[] = []
class Watcher {
  targets: Element[] = []
  constructor(callback: IntersectionObserverCallback) {
    observers.push({ callback, targets: this.targets })
  }
  observe = (target: Element) => {
    this.targets.push(target)
  }
  unobserve = () => undefined
  disconnect = () => {
    this.targets.length = 0
  }
}
vi.stubGlobal("IntersectionObserver", Watcher)
vi.stubGlobal("ResizeObserver", Watcher)

let reduced = false
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: query.includes("reduce") && reduced,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}))

// The media element: whether it plays, and what it was asked
// A refusal's name: "NotAllowedError" (autoplay off), "AbortError" (paused before it began)
let refuse: string | null = null
const calls: string[] = []
const playing = new WeakSet<HTMLMediaElement>()
Object.defineProperty(HTMLMediaElement.prototype, "paused", {
  configurable: true,
  get(this: HTMLMediaElement) {
    return !playing.has(this)
  },
})
HTMLMediaElement.prototype.load = function load() {
  calls.push("load")
}
HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
  calls.push("play")
  if (refuse) {
    return Promise.reject(new DOMException("play refused", refuse))
  }
  playing.add(this)
  return Promise.resolve()
}
HTMLMediaElement.prototype.pause = function pause(this: HTMLMediaElement) {
  calls.push("pause")
  playing.delete(this)
  this.dispatchEvent(new Event("pause"))
}

const words = galleryWords(t)
let host: HTMLDivElement
let root: Root

beforeEach(() => {
  observers.length = 0
  calls.length = 0
  reduced = false
  refuse = null
  Reflect.deleteProperty(navigator, "connection")
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

async function draw(props: Partial<Parameters<typeof GalleryVideo>[0]> = {}) {
  await act(async () => {
    root.render(<GalleryVideo video={clip} sizes="100vw" words={words} {...props} />)
    await settle()
  })
  const video = host.querySelector("video")
  if (!video) {
    throw new Error("no video drawn")
  }
  return video
}

/** The clip's tile this much in view (0 to 1), as its observer is told. */
async function inView(ratio: number) {
  const tile = host.querySelector("[data-video]")
  await act(async () => {
    for (const { callback, targets } of observers) {
      if (tile && targets.includes(tile)) {
        const entry = { target: tile, isIntersecting: ratio > 0, intersectionRatio: ratio }
        callback([entry as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
      }
    }
    await settle()
  })
}

const button = () => host.querySelector("button")
const named = (template: string) => template.replace("{title}", clip.title)

describe("the gallery's video", () => {
  it("shows its poster first, lazy, and loads nothing of the clip before it is in view", async () => {
    const video = await draw()
    const img = host.querySelector("img")
    expect(img?.getAttribute("src")).toBe(poster.src)
    expect(img?.getAttribute("loading")).toBe("lazy")
    expect(video.getAttribute("preload")).toBe("none")
    expect(video.hasAttribute("loop")).toBe(true)
    expect(video.hasAttribute("playsinline")).toBe(true)
    expect(video.hasAttribute("disablepictureinpicture")).toBe(true)
    expect(video.muted).toBe(true)
    expect(host.querySelectorAll("video source[src]")).toHaveLength(0)
    expect(calls).toEqual([])

    // A sliver in view is not enough
    await inView(0.3)
    expect(host.querySelectorAll("video source[src]")).toHaveLength(0)
    expect(calls).toEqual([])
  })

  it("attaches WebM then MP4 and plays once half in view, and pauses out of view", async () => {
    const video = await draw()
    await inView(0.6)
    const sources = [...host.querySelectorAll("video source")]
    expect(
      sources.map((source) => [source.getAttribute("type"), source.getAttribute("src")])
    ).toEqual([
      ["video/webm", clip.sources?.webm],
      ["video/mp4", clip.sources?.mp4],
    ])
    expect(calls).toEqual(["load", "play"])
    expect(video.className).toContain("opacity-100")
    expect(button()?.getAttribute("aria-label")).toBe(named(words.videoPauseNamed))

    await inView(0.2)
    expect(calls.at(-1)).toBe("pause")
    expect(button()?.getAttribute("aria-label")).toBe(named(words.videoPlayNamed))

    // Back in view: it plays again, the sources already there
    await inView(0.8)
    expect(calls.slice(-1)).toEqual(["play"])
    expect(calls.filter((call) => call === "load")).toHaveLength(1)
  })

  it.each([
    ["reduced motion", () => (reduced = true)],
    [
      "the data saver",
      () => {
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: { saveData: true },
        })
      },
    ],
  ])("does not start by itself under %s: the poster and Videoyu oynat", async (_, ask) => {
    ask()
    const video = await draw()
    await inView(1)
    expect(calls).toEqual([])
    expect(host.querySelectorAll("video source[src]")).toHaveLength(0)
    expect(video.className).toContain("opacity-0")
    expect(button()?.textContent).toBe(t("product.video_play"))
    expect(button()?.getAttribute("aria-label")).toBe("Videoyu oynat: Yakın çekim")

    // The shopper's press plays it
    await act(async () => {
      button()?.click()
      await settle()
    })
    expect(calls).toEqual(["load", "play"])
    expect(host.querySelectorAll("video source[src]")).toHaveLength(2)
  })

  it("never starts by itself when it must not (a product without photographs)", async () => {
    await draw({ autoplay: false, priority: true })
    expect(host.querySelector("img")?.getAttribute("loading")).toBe("eager")
    await inView(1)
    expect(calls).toEqual([])
    expect(host.querySelectorAll("video source")).toHaveLength(0)
  })

  it("pauses and plays from its button, named after the clip, and stays paused when pressed so", async () => {
    await draw()
    await inView(1)
    const toggle = button()
    expect(toggle?.getAttribute("type")).toBe("button")
    expect(toggle?.getAttribute("aria-label")).toBe("Videoyu durdur: Yakın çekim")

    await act(async () => {
      toggle?.click()
      await settle()
    })
    expect(calls.at(-1)).toBe("pause")
    expect(button()).toBe(toggle)
    expect(toggle?.getAttribute("aria-label")).toBe("Videoyu oynat: Yakın çekim")

    // Out of view and back: the shopper's pause holds
    await inView(0)
    await inView(1)
    expect(calls.at(-1)).toBe("pause")

    await act(async () => {
      toggle?.click()
      await settle()
    })
    expect(calls.at(-1)).toBe("play")
    expect(toggle?.getAttribute("aria-label")).toBe("Videoyu durdur: Yakın çekim")
  })

  it("falls back to the poster and the button when the browser refuses to play, and does not insist", async () => {
    refuse = "NotAllowedError"
    const video = await draw()
    await inView(1)
    expect(calls).toEqual(["load", "play"])
    expect(video.className).toContain("opacity-0")
    expect(button()?.getAttribute("aria-label")).toBe("Videoyu oynat: Yakın çekim")
    expect(button()?.textContent).toBe("Videoyu oynat")

    await inView(0)
    await inView(1)
    expect(calls.filter((call) => call === "play")).toHaveLength(1)
  })

  it("tries again next time when its start was only cut short (paused before it began)", async () => {
    refuse = "AbortError"
    await draw()
    await inView(1)
    await inView(0)
    refuse = null
    await inView(1)
    expect(calls.filter((call) => call === "play")).toHaveLength(2)
    expect(button()?.getAttribute("aria-label")).toBe("Videoyu durdur: Yakın çekim")
  })

  it("names its button with the shop's title as written, `$` patterns and all (review S2)", async () => {
    const title = "Kesim $& açısı $' ve $` $$"
    await draw({ video: { ...clip, title } })
    expect(button()?.getAttribute("aria-label")).toBe(`Videoyu oynat: ${title}`)
    await inView(1)
    expect(button()?.getAttribute("aria-label")).toBe(`Videoyu durdur: ${title}`)
  })
})
