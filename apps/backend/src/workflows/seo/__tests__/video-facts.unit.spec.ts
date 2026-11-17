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
