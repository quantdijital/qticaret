import { videoFactsOf } from "../video-facts"
import type { VideoRow } from "../video-facts"

const poster = {
  url: "https://cdn.example.com/gomlek-video-1.jpg",
  derivatives: {
    srcset: {
      webp: [
        { width: 640, url: "https://cdn.example.com/gomlek-video-1-640.webp" },
        { width: 1280, url: "https://cdn.example.com/gomlek-video-1-1280.webp" },
      ],
    },
    og: { url: "https://cdn.example.com/gomlek-video-1-og.jpg" },
  },
}

const row = (overrides: Partial<VideoRow> = {}): VideoRow => ({
  id: "mvid_01",
  kind: "upload",
  status: "ready",
  title: "Yakın çekim",
  position: 1,
  duration_ms: 12_400,
  outputs: { mp4: { url: "https://cdn.example.com/gomlek-video-1.mp4" } },
  poster,
  youtube_id: null,
  processed_at: new Date("2026-11-17T12:30:00+03:00"),
  ...overrides,
})

describe("videoFactsOf (adr/0069 §9)", () => {
  it("reads a ready clip: widest WebP and share crop, the MP4, the UTC upload time", () => {
    expect(videoFactsOf([row()])).toEqual([
      {
        kind: "upload",
        id: "mvid_01",
        title: "Yakın çekim",
        thumbnails: [
          "https://cdn.example.com/gomlek-video-1-1280.webp",
          "https://cdn.example.com/gomlek-video-1-og.jpg",
        ],
        uploadDate: "2026-11-17T09:30:00.000Z",
        contentUrl: "https://cdn.example.com/gomlek-video-1.mp4",
        durationMs: 12_400,
      },
    ])
  })

  it("falls back to the poster itself without its versions, and to none without a poster", () => {
    const [plain] = videoFactsOf([row({ poster: { url: poster.url, derivatives: null } })])
    expect(plain?.thumbnails).toEqual([poster.url])
    const [none] = videoFactsOf([row({ poster: null })])
    expect(none?.thumbnails).toEqual([])
  })

  it("reads a YouTube video by its id, with a date from text", () => {
    const [video] = videoFactsOf([
      row({
        kind: "youtube",
        youtube_id: "dQw4w9WgXcQ",
        outputs: null,
        duration_ms: null,
        processed_at: "2026-11-17T10:00:00.000Z",
      }),
    ])
    expect(video).toMatchObject({
      kind: "youtube",
      youtubeId: "dQw4w9WgXcQ",
      uploadDate: "2026-11-17T10:00:00.000Z",
    })
  })

  it("takes plain HTTP addresses on a developer's machine or in tests only", () => {
    const plain = row({
      outputs: { mp4: { url: "http://localhost:9000/static/gomlek-video-1.mp4" } },
      poster: { url: "http://localhost:9000/static/gomlek-video-1.jpg", derivatives: null },
    })
    expect(videoFactsOf([plain], true)[0]).toMatchObject({
      contentUrl: "http://localhost:9000/static/gomlek-video-1.mp4",
      thumbnails: ["http://localhost:9000/static/gomlek-video-1.jpg"],
    })
    // Live (production, staging, an unset NODE_ENV): HTTPS only, the rest left out
    expect(videoFactsOf([plain], false)[0]).toMatchObject({ contentUrl: null, thumbnails: [] })
    expect(videoFactsOf([row()], false)[0]).toMatchObject({
      contentUrl: "https://cdn.example.com/gomlek-video-1.mp4",
    })
  })

  it("decides by NODE_ENV when not told", () => {
    const plain = row({ outputs: { mp4: { url: "http://cdn.example.com/a.mp4" } } })
    const saved = process.env["NODE_ENV"]
    try {
      process.env["NODE_ENV"] = "production"
      expect(videoFactsOf([plain])[0]).toMatchObject({ contentUrl: null })
      process.env["NODE_ENV"] = "development"
      expect(videoFactsOf([plain])[0]).toMatchObject({ contentUrl: "http://cdn.example.com/a.mp4" })
    } finally {
      process.env["NODE_ENV"] = saved
    }
  })

  it("keeps only ready videos, in gallery order, and drops addresses that are not web ones", () => {
    const facts = videoFactsOf([
      row({ id: "mvid_c", position: 2 }),
      row({ id: "mvid_b", status: "processing" }),
      null,
      row({ id: "mvid_a", outputs: { mp4: { url: "javascript:alert(1)" } }, processed_at: null }),
    ])
    expect(facts.map((video) => video.id)).toEqual(["mvid_a", "mvid_c"])
    expect(facts[0]).toMatchObject({ contentUrl: null, uploadDate: null })
  })
})
