import { describe, expect, it } from "vitest"
import type { StoreMediaVideo, StoreProduct } from "@qticaret/types"
import { t } from "@/lib/i18n"
import { productPage } from "../product"
import { productVideos } from "../product-videos"

const FILES = "https://dosya.ornek.com"

const clip = (id: string, fields: Partial<StoreMediaVideo> = {}): StoreMediaVideo => ({
  id,
  kind: "upload",
  status: "ready",
  title: null,
  position: 1,
  width: 720,
  height: 1280,
  duration_ms: 12_400,
  outputs: {
    mp4: { url: `${FILES}/${id}.mp4`, bytes: 2_000_000 },
    webm: { url: `${FILES}/${id}.webm`, bytes: 1_500_000 },
  },
  poster: {
    url: `${FILES}/${id}.jpg`,
    width: 720,
    height: 1280,
    derivatives: {
      srcset: {
        webp: [
          { width: 720, url: `${FILES}/${id}-720.webp` },
          { width: 400, url: `${FILES}/${id}-400.webp` },
        ],
        avif: [{ width: 400, url: `${FILES}/${id}-400.avif` }],
      },
    },
  },
  youtube_id: null,
  ...fields,
})

const product = (videos: StoreMediaVideo[] | null | undefined): StoreProduct => ({
  id: "prod_1",
  title: "Şef Bıçağı",
  handle: "sef-bicagi",
  subtitle: null,
  description: null,
  thumbnail: null,
  images: [{ id: "img_1", url: `${FILES}/sef-bicagi.jpg`, rank: 0 }],
  // Left out: an answer that did not ask for them
  ...(videos === undefined ? {} : { media_videos: videos }),
})

describe("productVideos (adr/0069 §6)", () => {
  it("draws a ready clip: its sources WebM then MP4, its poster with versions, its length in seconds", () => {
    expect(productVideos(product([clip("mvid_1", { title: "  Yakın çekim " })]))).toEqual([
      {
        id: "mvid_1",
        after: 1,
        title: "Yakın çekim",
        poster: {
          src: `${FILES}/mvid_1.jpg`,
          alt: "Yakın çekim",
          width: 720,
          height: 1280,
          sources: {
            avif: `${FILES}/mvid_1-400.avif 400w`,
            webp: `${FILES}/mvid_1-400.webp 400w, ${FILES}/mvid_1-720.webp 720w`,
          },
        },
        width: 720,
        height: 1280,
        durationSeconds: 12.4,
        sources: { webm: `${FILES}/mvid_1.webm`, mp4: `${FILES}/mvid_1.mp4` },
      },
    ])
  })

  it("names an untitled clip after the product", () => {
    const [view] = productVideos(product([clip("mvid_1", { title: "   " })]))
    expect(view?.title).toBe("Şef Bıçağı")
    expect(view?.poster.alt).toBe("Şef Bıçağı")
  })

  it("shows only ready clips, at most two, by their place", () => {
    const videos = productVideos(
      product([
        clip("mvid_queued", { status: "processing" }),
        clip("mvid_late", { position: 3 }),
        clip("mvid_failed", { status: "failed" }),
        clip("mvid_first", { position: 1 }),
        clip("mvid_second", { position: 2 }),
      ])
    )
    expect(videos.map((video) => [video.id, video.after])).toEqual([
      ["mvid_first", 1],
      ["mvid_second", 2],
    ])
  })

  it("never puts a clip before the first picture, and keeps the backend's order on a tie", () => {
    const videos = productVideos(
      product([clip("mvid_a", { position: 0 }), clip("mvid_b", { position: null })])
    )
    expect(videos.map((video) => [video.id, video.after])).toEqual([
      ["mvid_a", 1],
      ["mvid_b", 1],
    ])
  })

  it("leaves out a clip with nothing to play or no poster", () => {
    const videos = productVideos(
      product([
        clip("mvid_no_mp4", { outputs: { webm: { url: `${FILES}/x.webm` } } }),
        clip("mvid_no_poster", { poster: null }),
      ])
    )
    expect(videos).toEqual([])
  })

  it("plays the MP4 alone when no WebM was made, and leaves unknown sizes and length empty", () => {
    const [view] = productVideos(
      product([
        clip("mvid_1", {
          outputs: { mp4: { url: `${FILES}/mvid_1.mp4` }, webm: null },
          width: null,
          height: 0,
          duration_ms: null,
        }),
      ])
    )
    expect(view).toMatchObject({
      sources: { webm: null, mp4: `${FILES}/mvid_1.mp4` },
      width: null,
      height: null,
      durationSeconds: null,
    })
  })

  it.each([
    ["an MP4 over plain HTTP", { outputs: { mp4: { url: "http://dosya.ornek.com/a.mp4" } } }],
    [
      "a WebM over plain HTTP",
      {
        outputs: {
          mp4: { url: `${FILES}/a.mp4` },
          webm: { url: "http://dosya.ornek.com/a.webm" },
        },
      },
    ],
    [
      "a WebM of another scheme",
      { outputs: { mp4: { url: `${FILES}/a.mp4` }, webm: { url: "data:video/webm;base64,AA" } } },
    ],
    ["a relative MP4", { outputs: { mp4: { url: "/media/a.mp4" } } }],
    ["a script address", { outputs: { mp4: { url: "javascript:alert(1)" } } }],
    ["a malformed address", { outputs: { mp4: { url: "https//eksik" } } }],
    [
      "a poster over plain HTTP",
      { poster: { url: "http://dosya.ornek.com/a.jpg", width: 1, height: 1, derivatives: null } },
    ],
  ] satisfies [string, Partial<StoreMediaVideo>][])(
    "leaves out a clip with %s outside development",
    (_, fields) => {
      expect(productVideos(product([clip("mvid_1", fields)]), false)).toEqual([])
    }
  )

  it("takes plain HTTP addresses in development (the local storage), as the policy does", () => {
    const local = "http://localhost:58333/qticaret"
    const fields: Partial<StoreMediaVideo> = {
      outputs: { mp4: { url: `${local}/a.mp4` }, webm: { url: `${local}/a.webm` } },
      poster: { url: `${local}/a.jpg`, width: 720, height: 1280, derivatives: null },
    }
    expect(productVideos(product([clip("mvid_1", fields)]), true)).toHaveLength(1)
    expect(productVideos(product([clip("mvid_1", fields)]), false)).toEqual([])
    // Still never another scheme
    const script = { outputs: { mp4: { url: "javascript:alert(1)" } } }
    expect(productVideos(product([clip("mvid_2", script)]), true)).toEqual([])
  })

  describe("a YouTube video (slice 5)", () => {
    const ID = "dQw4w9WgXcQ"
    const youtube = (id: string, fields: Partial<StoreMediaVideo> = {}) =>
      clip(id, {
        kind: "youtube",
        outputs: null,
        width: null,
        height: null,
        duration_ms: null,
        youtube_id: ID,
        ...fields,
      })

    it("plays from the privacy-enhanced player, built from its id, its cover our own copy", () => {
      const [view] = productVideos(product([youtube("mvid_yt", { title: "Bileme" })]))
      expect(view).toEqual({
        id: "mvid_yt",
        after: 1,
        title: "Bileme",
        poster: {
          src: `${FILES}/mvid_yt.jpg`,
          alt: "Bileme",
          width: 720,
          height: 1280,
          sources: {
            avif: `${FILES}/mvid_yt-400.avif 400w`,
            webp: `${FILES}/mvid_yt-400.webp 400w, ${FILES}/mvid_yt-720.webp 720w`,
          },
        },
        width: null,
        height: null,
        durationSeconds: null,
        youtube: { embedUrl: `https://www.youtube-nocookie.com/embed/${ID}` },
      })
      expect(view).not.toHaveProperty("sources")
    })

    it("shows the product's first picture while it has no cover of ours, named after it", () => {
      const [view] = productVideos(product([youtube("mvid_yt", { poster: null })]))
      expect(view?.poster).toEqual({
        src: `${FILES}/sef-bicagi.jpg`,
        alt: "Şef Bıçağı",
        width: null,
        height: null,
        sources: { avif: null, webp: null },
      })
      // A cover outside the web addresses is no cover: the first picture stands in
      const [plain] = productVideos(
        product([
          youtube("mvid_yt", {
            poster: { url: "http://dosya.ornek.com/a.jpg", width: 1, height: 1, derivatives: null },
          }),
        ]),
        false
      )
      expect(plain?.poster.src).toBe(`${FILES}/sef-bicagi.jpg`)
    })

    it("leaves it out without a valid id, or with no picture at all to show", () => {
      for (const id of [null, "", "short", `${ID}x`, "../../admin", "dQw4w9WgX?Q"]) {
        expect(productVideos(product([youtube("mvid_yt", { youtube_id: id })]))).toEqual([])
      }
      const bare: StoreProduct = { ...product([youtube("mvid_yt", { poster: null })]), images: [] }
      expect(productVideos(bare)).toEqual([])
    })

    it("counts with the clips: two at most, by their place", () => {
      const videos = productVideos(
        product([
          youtube("mvid_yt", { position: 1 }),
          clip("mvid_clip", { position: 1 }),
          youtube("mvid_late", { position: 2 }),
        ])
      )
      expect(videos.map((video) => video.id)).toEqual(["mvid_yt", "mvid_clip"])
    })
  })

  it("has none for a product the answer gave no videos", () => {
    expect(productVideos(product(undefined))).toEqual([])
    expect(productVideos(product(null))).toEqual([])
  })
})

describe("the product page's videos", () => {
  const page = (videos: StoreMediaVideo[] | undefined) =>
    productPage({
      product: product(videos),
      seo: null,
      displays: {},
      brandPath: null,
      requestedVariant: null,
      t,
      trustBadges: [],
    })

  it("leaves the field out for a product without videos: its view is as it was", () => {
    expect(page(undefined)).not.toHaveProperty("videos")
    expect(page([clip("mvid_1", { status: "processing" })])).not.toHaveProperty("videos")
  })

  it("carries them beside the pictures, which do not change", () => {
    const view = page([clip("mvid_1")])
    expect(view.videos?.map((video) => video.id)).toEqual(["mvid_1"])
    expect(view.images.map((image) => image.src)).toEqual([`${FILES}/sef-bicagi.jpg`])
    expect(page(undefined).images).toEqual(view.images)
  })
})
