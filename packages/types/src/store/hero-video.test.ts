import { describe, expect, it } from "vitest"
import { HERO_VIDEO_LIMITS, heroVideoOf, heroVideoPlayerSrc } from "./hero-video.js"

const YT = "dQw4w9WgXcQ"

/** The opening's video link: only the id is taken, from these forms on these hosts. */
describe("heroVideoOf", () => {
  it.each([
    `https://www.youtube.com/watch?v=${YT}`,
    `https://youtube.com/watch?v=${YT}&t=42s`,
    `https://m.youtube.com/watch/?feature=share&v=${YT}`,
    `http://www.youtube.com/watch?v=${YT}`,
    `https://youtu.be/${YT}`,
    `https://youtu.be/${YT}?si=abc`,
    `youtu.be/${YT}`,
    `https://www.youtube.com/embed/${YT}`,
    `https://www.youtube.com/shorts/${YT}/`,
    `https://www.youtube-nocookie.com/embed/${YT}`,
    `  https://www.youtube.com/watch?v=${YT}  `,
  ])("takes a YouTube id from %s", (link) => {
    expect(heroVideoOf(link)).toEqual({ host: "youtube", id: YT })
  })

  it.each([
    "https://vimeo.com/76979871",
    "https://www.vimeo.com/76979871/",
    "vimeo.com/76979871",
    "https://player.vimeo.com/video/76979871",
    "https://vimeo.com/76979871?share=copy",
  ])("takes a Vimeo id from %s", (link) => {
    expect(heroVideoOf(link)).toEqual({ host: "vimeo", id: "76979871" })
  })

  it.each([
    ["another host", `https://example.com/watch?v=${YT}`],
    ["a host that only looks like YouTube's", `https://youtube.com.evil.com/watch?v=${YT}`],
    ["a host ending like YouTube's", `https://evilyoutube.com/watch?v=${YT}`],
    ["a host that only looks like Vimeo's", "https://vimeo.com.evil.com/76979871"],
    ["a name before the host", `https://youtube.com@evil.com/watch?v=${YT}`],
    ["a name and password", `https://a:b@www.youtube.com/watch?v=${YT}`],
    ["a port", `https://www.youtube.com:8443/watch?v=${YT}`],
    ["a script", "javascript:alert(1)//youtu.be/dQw4w9WgXcQ"],
    ["a data address", `data:text/html,https://youtu.be/${YT}`],
    ["another scheme", `ftp://youtu.be/${YT}`],
    ["a path on the shop", `/watch?v=${YT}`],
    ["an id a character too long", `https://youtu.be/${YT}x`],
    ["an id a character too short", "https://youtu.be/dQw4w9WgXc"],
    ["a character off the id's alphabet", "https://youtu.be/dQw4w9WgX.Q"],
    ["an encoded character in the id", "https://youtu.be/dQw4w9WgX%22"],
    ["more path after the id", `https://www.youtube.com/embed/${YT}/x`],
    ["two videos", `https://www.youtube.com/watch?v=${YT}&v=aaaaaaaaaaa`],
    ["no video", "https://www.youtube.com/watch"],
    ["a channel", "https://www.youtube.com/@kanal"],
    ["a Vimeo id with letters", "https://vimeo.com/7697987a"],
    ["a Vimeo page that is not a video", "https://vimeo.com/channels/staffpicks"],
    ["a Vimeo video under another path", "https://player.vimeo.com/76979871"],
    ["YouTube's path on Vimeo", `https://vimeo.com/embed/${YT}`],
    ["nothing", "   "],
  ])("refuses %s", (_, link) => {
    expect(heroVideoOf(link)).toBeNull()
  })

  it("refuses what is not a link, and one longer than any real link", () => {
    expect(heroVideoOf(null)).toBeNull()
    expect(heroVideoOf(42)).toBeNull()
    expect(heroVideoOf(undefined)).toBeNull()
    const long = `https://youtu.be/${YT}?x=${"a".repeat(HERO_VIDEO_LIMITS.url)}`
    expect(heroVideoOf(long)).toBeNull()
  })
})

describe("heroVideoPlayerSrc", () => {
  it("builds each player's address from the id alone", () => {
    expect(heroVideoPlayerSrc({ host: "youtube", id: YT })).toBe(
      `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&playsinline=1&rel=0`
    )
    expect(heroVideoPlayerSrc({ host: "vimeo", id: "76979871" })).toBe(
      "https://player.vimeo.com/video/76979871?autoplay=1&dnt=1"
    )
  })

  it("refuses an id off its host's list, or a host off the list", () => {
    expect(heroVideoPlayerSrc({ host: "youtube", id: "76979871" })).toBeNull()
    expect(heroVideoPlayerSrc({ host: "vimeo", id: YT })).toBeNull()
    expect(heroVideoPlayerSrc({ host: "youtube", id: `${YT}"><script>` })).toBeNull()
    expect(heroVideoPlayerSrc({ host: "toString" as never, id: YT })).toBeNull()
  })
})
