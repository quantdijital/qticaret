import { describe, expect, it, vi } from "vitest"
import { videoTileLabel } from "@/features/products/video-facts"
import {
  VIDEO_ACCEPT,
  VIDEO_POLL_MS,
  isVideoFile,
  productVideosQuery,
  splitMedia,
  videoPollInterval,
} from "./videos"
import type { ProductVideo, ProductVideos, VideoStatus } from "./videos"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))

const file = (name: string, type: string) => new File(["x"], name, { type })

const video = (status: VideoStatus): ProductVideo => ({
  id: `mvid_${status}`,
  kind: "upload",
  status,
  title: null,
  position: 1,
  width: null,
  height: null,
  duration_ms: null,
  outputs: null,
  poster: null,
  youtube_id: null,
  error_code: null,
  created_at: "2026-11-17T10:00:00Z",
})

const list = (...statuses: VideoStatus[]): ProductVideos => ({
  videos: statuses.map(video),
  limit: 2,
  upload: true,
})

/** adr/0069 §10: one way in; each picked file goes where it belongs. */
describe("routing a picked file", () => {
  it("sends MP4, MOV and WebM to the video route by their type", () => {
    expect(isVideoFile(file("klip.mp4", "video/mp4"))).toBe(true)
    expect(isVideoFile(file("IMG_0001.MOV", "video/quicktime"))).toBe(true)
    expect(isVideoFile(file("klip.webm", "video/webm"))).toBe(true)
    expect(isVideoFile(file("klip.m4v", "video/x-m4v"))).toBe(true)
  })

  it("reads the extension only when the browser names no type", () => {
    expect(isVideoFile(file("IMG_0001.MOV", ""))).toBe(true)
    expect(isVideoFile(file("klip.webm", "application/octet-stream"))).toBe(true)
    expect(isVideoFile(file("not.txt", ""))).toBe(false)
    // A type the browser knows wins over the name
    expect(isVideoFile(file("resim.mp4", "image/png"))).toBe(false)
  })

  it("keeps a GIF, any picture and any other video on the image route (GIF: never a video)", () => {
    expect(isVideoFile(file("hareketli.gif", "image/gif"))).toBe(false)
    expect(isVideoFile(file("hareketli.gif", ""))).toBe(false)
    expect(VIDEO_ACCEPT).not.toMatch(/gif/i)
    expect(isVideoFile(file("kapak.jpg", "image/jpeg"))).toBe(false)
    expect(isVideoFile(file("film.mkv", "video/x-matroska"))).toBe(false)
    expect(isVideoFile(file("film.avi", "video/x-msvideo"))).toBe(false)
  })

  it("splits a drop into pictures and clips, keeping each list's order", () => {
    const picked = [
      file("a.png", "image/png"),
      file("b.mp4", "video/mp4"),
      file("c.gif", "image/gif"),
      file("d.mov", "video/quicktime"),
    ]
    const { images, videos } = splitMedia(picked)
    expect(images.map((each) => each.name)).toEqual(["a.png", "c.gif"])
    expect(videos.map((each) => each.name)).toEqual(["b.mp4", "d.mov"])
  })
})

describe("reading the list again while the job works", () => {
  it("polls every 5 s while a clip waits or is processed", () => {
    expect(VIDEO_POLL_MS).toBe(5000)
    expect(videoPollInterval(list("uploaded"))).toBe(5000)
    expect(videoPollInterval(list("ready", "processing"))).toBe(5000)
  })

  it("stops once every clip is ready or failed, and before the list is read", () => {
    expect(videoPollInterval(list("ready", "failed"))).toBe(false)
    expect(videoPollInterval(list())).toBe(false)
    expect(videoPollInterval(undefined)).toBe(false)
  })

  it("is the list query's own refresh", () => {
    const options = productVideosQuery("prod_1")
    const interval = options.refetchInterval as (query: {
      state: { data: ProductVideos | undefined }
    }) => number | false
    expect(interval({ state: { data: list("processing") } })).toBe(5000)
    expect(interval({ state: { data: list("ready") } })).toBe(false)
    expect(productVideosQuery("prod_1", false).enabled).toBe(false)
  })
})

describe("a video tile's label", () => {
  it("says İşleniyor while it waits or is processed, İşlenemedi on failure, nothing when ready", () => {
    expect(videoTileLabel("uploaded")).toBe("processing")
    expect(videoTileLabel("processing")).toBe("processing")
    expect(videoTileLabel("failed")).toBe("failed")
    expect(videoTileLabel("ready")).toBeNull()
  })
})
