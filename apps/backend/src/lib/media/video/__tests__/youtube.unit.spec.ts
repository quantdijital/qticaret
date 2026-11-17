import {
  titleFromYoutube,
  youtubeEmbedUrl,
  youtubeIdOf,
  youtubeOembedUrl,
  youtubePosterUrls,
  youtubeWatchUrl,
} from "../youtube"

const ID = "dQw4w9WgXcQ"
const DASHED = "a_B-c9_-Z0x"

/** A YouTube link's video id (adr/0069 §8): the allowed forms, and nothing else. */
describe("a YouTube link's id", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, ID],
    [`https://youtube.com/watch?v=${ID}`, ID],
    [`https://m.youtube.com/watch?v=${ID}`, ID],
    [`https://www.youtube.com/watch?v=${ID}&t=42s&list=PL123`, ID],
    [`https://www.youtube.com/watch?feature=share&v=${DASHED}`, DASHED],
    [`https://www.youtube.com/watch/?v=${ID}`, ID],
    [`https://youtu.be/${ID}`, ID],
    [`https://youtu.be/${ID}?si=abcDEF&t=10`, ID],
    [`https://www.youtube.com/shorts/${ID}`, ID],
    [`https://youtube.com/shorts/${ID}/`, ID],
    [`https://m.youtube.com/shorts/${ID}?feature=share`, ID],
    [`https://www.youtube.com/embed/${ID}`, ID],
    [`https://youtube.com/embed/${ID}?start=5`, ID],
    [`https://www.youtube-nocookie.com/embed/${ID}`, ID],
    [`https://youtube-nocookie.com/embed/${ID}?rel=0`, ID],
    // Plain HTTP and a missing scheme: only the id is kept, so they read as the HTTPS link
    [`http://www.youtube.com/watch?v=${ID}`, ID],
    [`youtu.be/${ID}`, ID],
    [`www.youtube.com/watch?v=${ID}`, ID],
    // Case in the host and the default port are the URL parser's to normalise
    [`https://WWW.YouTube.com/watch?v=${ID}`, ID],
    [`https://www.youtube.com:443/watch?v=${ID}`, ID],
    [`  https://youtu.be/${ID}  `, ID],
    // A query value is read decoded: what is checked is the id it decodes to
    ["https://www.youtube.com/watch?v=dQw4w9WgXc%51", ID],
  ])("takes %s", (link, id) => {
    expect(youtubeIdOf(link)).toBe(id)
  })

  it.each([
    // Another scheme
    `javascript:alert(1)//https://www.youtube.com/watch?v=${ID}`,
    `JavaScript:alert(document.cookie)`,
    `data:text/html,<script>alert(1)</script>youtube.com/watch?v=${ID}`,
    `ftp://www.youtube.com/watch?v=${ID}`,
    `file:///etc/passwd?v=${ID}`,
    `//www.youtube.com/watch?v=${ID}`,
    // Lookalike hosts
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://evilyoutube.com/watch?v=${ID}`,
    `https://www.youtube.com.evil.com/embed/${ID}`,
    `https://youtu.be.evil.com/${ID}`,
    `https://youtube.co/watch?v=${ID}`,
    `https://youtube.com./watch?v=${ID}`,
    `https://www.yоutube.com/watch?v=${ID}`, // a Cyrillic "о"
    `https://m.youtu.be/${ID}`,
    `https://m.youtube-nocookie.com/embed/${ID}`,
    // Name and password, ports
    `https://user@www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com:pass@evil.com/watch?v=${ID}`,
    `https://www.youtube.com@evil.com/watch?v=${ID}`,
    `https://www.youtube.com:8080/watch?v=${ID}`,
    `https://evil.com\\@www.youtube.com/watch?v=${ID}`,
    // YouTube's host, another place
    `https://evil.com/?u=https://www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/redirect?q=https://evil.com&v=${ID}`,
    `https://www.youtube.com/channel/${ID}`,
    `https://youtu.be/${ID}/extra`,
    `https://youtube-nocookie.com/watch?v=${ID}`,
    `https://youtu.be/watch?v=${ID}`,
    // Not an id
    "https://www.youtube.com/watch?v=short",
    `https://www.youtube.com/watch?v=${ID}x`,
    "https://www.youtube.com/watch?v=dQw4w9WgXc%2F",
    "https://www.youtube.com/watch?v=<script>a</",
    `https://www.youtube.com/watch?v=${ID}&v=${DASHED}`,
    "https://www.youtube.com/embed/%2e%2e%2fadmin",
    "https://www.youtube.com/watch",
    "",
    "   ",
    `https://youtu.be/${ID}?${"a".repeat(2100)}`,
  ])("refuses %s", (link) => {
    expect(youtubeIdOf(link)).toBeNull()
  })

  it("builds every address to YouTube itself, from the id alone", () => {
    expect(youtubeEmbedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}`)
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`)
    expect(youtubeOembedUrl(ID)).toBe(
      `https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${ID}&format=json`
    )
    expect(youtubePosterUrls(ID)).toEqual([
      `https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
    ])
    expect(() => youtubeEmbedUrl("../../admin")).toThrow()
  })
})

describe("YouTube's title for an untitled video", () => {
  it("is one clean line of at most 200 characters, or none", () => {
    expect(titleFromYoutube("  Şef Bıçağı   bileme\nrehberi ")).toBe("Şef Bıçağı bileme rehberi")
    expect(titleFromYoutube("a\u202Eevil\u200B")).toBe("a evil")
    expect(titleFromYoutube("x".repeat(260))).toBe("x".repeat(200))
    expect(titleFromYoutube("   ")).toBeNull()
  })

  it("cuts a long title with emoji by the 200 units the title rule counts, never mid-emoji", () => {
    // 150 emoji are 300 UTF-16 units: 100 of them fit, whole
    const emoji = titleFromYoutube("🔪".repeat(150))
    expect(emoji).toBe("🔪".repeat(100))
    // An odd unit left over: the emoji that would be split is left out
    const odd = titleFromYoutube(`a${"🔪".repeat(150)}`)
    expect(odd).toBe(`a${"🔪".repeat(99)}`)
    expect(odd?.length).toBe(199)
    expect(odd?.endsWith("\uD83D")).toBe(false)
    expect(titleFromYoutube(`Şef bıçağı ${"😀 ".repeat(120)}`)?.length).toBeLessThanOrEqual(200)
    expect(titleFromYoutube(null)).toBeNull()
  })
})
