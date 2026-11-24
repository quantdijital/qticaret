import path from "node:path"
import { hydrateHero } from "../../../workflows/storefront/layout-hydrate-catalog"
import { AdminPostStorefrontLayout } from "../../../api/admin/storefront-layout/validators"
import { layoutDocument, readStoredLayout } from "../layout"
import { HERO_VIDEO_LIMITS, heroVideoLinkOf, heroVideoOf } from "../sections/hero-video"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/hero-video.ts"
)

const YT = "dQw4w9WgXcQ"
const SHORT_YT = `https://youtu.be/${YT}`
const SHORT_VIMEO = "https://vimeo.com/76979871"
const full = (more: Record<string, unknown> = {}) => ({
  id: "kapak00001",
  type: "hero",
  variant: "full_image",
  ...more,
})
const issues = (more: Record<string, unknown>) =>
  layoutDocument.safeParse({ home: [full(more)] }).error?.issues.map((issue) => issue.message) ?? []

/** The link the layout keeps for a pasted one. */
const kept = (link: unknown): unknown => {
  const section = layoutDocument.parse({ home: [full({ video_url: link })] }).home[0]
  return section && "video_url" in section ? section.video_url : undefined
}

const ACCEPTED = [
  `https://www.youtube.com/watch?v=${YT}`,
  `https://youtube.com/watch?v=${YT}&t=42s`,
  `https://youtu.be/${YT}`,
  `youtu.be/${YT}`,
  `https://www.youtube.com/embed/${YT}`,
  `https://www.youtube.com/shorts/${YT}`,
  `https://www.youtube-nocookie.com/embed/${YT}`,
  "https://vimeo.com/76979871",
  "vimeo.com/76979871",
  "https://player.vimeo.com/video/76979871",
]

const REFUSED = [
  `https://example.com/watch?v=${YT}`,
  `https://youtube.com.evil.com/watch?v=${YT}`,
  `https://youtube.com@evil.com/watch?v=${YT}`,
  `https://www.youtube.com:8443/watch?v=${YT}`,
  "javascript:alert(1)//youtu.be/dQw4w9WgXcQ",
  `data:text/html,https://youtu.be/${YT}`,
  `https://youtu.be/${YT}x`,
  "https://youtu.be/dQw4w9WgX.Q",
  `https://www.youtube.com/watch?v=${YT}&v=aaaaaaaaaaa`,
  "https://vimeo.com/7697987a",
  "https://vimeo.com.evil.com/76979871",
  "https://vimeo.com/channels/staffpicks",
]

describe("the full image opening's video (hero-video.ts)", () => {
  it("reads every link as the contract's parser does", () => {
    const contract = jest.requireActual<{
      HERO_VIDEO_LIMITS: unknown
      heroVideoOf: (input: unknown) => unknown
    }>(CONTRACT_FILE)

    expect(HERO_VIDEO_LIMITS).toEqual(contract.HERO_VIDEO_LIMITS)
    for (const link of [...ACCEPTED, ...REFUSED, "", null, 42]) {
      expect(heroVideoOf(link)).toEqual(contract.heroVideoOf(link))
    }
  })

  it.each(ACCEPTED)("keeps a YouTube or Vimeo link as the host's own short link: %s", (link) => {
    expect(kept(link)).toBe(link.includes("vimeo") ? SHORT_VIMEO : SHORT_YT)
  })

  it("keeps nothing of the pasted link but the video's id", () => {
    expect(kept(`https://www.youtube.com/watch?v=${YT}&si=izleme123&t=42s`)).toBe(SHORT_YT)
    expect(kept(`https://youtube.com/shorts/${YT}?feature=share`)).toBe(SHORT_YT)
    expect(kept("https://player.vimeo.com/video/76979871?h=abc&autoplay=1")).toBe(SHORT_VIMEO)
    // A dirty query and a direction mark: none of it reaches what is stored and served
    expect(kept(`https://youtu.be/${YT}?x=<img src=x onerror=alert(1)>"‮`)).toBe(SHORT_YT)
    // The short link reads back as itself
    expect(kept(SHORT_YT)).toBe(SHORT_YT)
    expect(kept(SHORT_VIMEO)).toBe(SHORT_VIMEO)
    expect(heroVideoLinkOf("https://example.com/v")).toBeNull()
  })

  it("reads a stored link back as the short one", () => {
    const doc = readStoredLayout({
      home: [full({ video_url: `https://www.youtube.com/watch?v=${YT}&si=x` })],
    })

    expect(doc.home[0]).toMatchObject({ video_url: SHORT_YT })
  })

  it.each(REFUSED)("refuses a link that is not one: %s", (link) => {
    expect(issues({ video_url: link })).toEqual(["storefront_layout.video_invalid"])
  })

  it("refuses a link with a NUL or another control character as invalid input", () => {
    for (const link of [`https://youtu.be/${YT}?x=\u0000`, `https://youtu.be/${YT}\u0007`]) {
      expect(issues({ video_url: link })).toEqual(["storefront_layout.video_invalid"])
      // The request body's validator refuses it (a 400): nothing reaches jsonb
      const body = { document: { home: [full({ video_url: link })] } }
      expect(AdminPostStorefrontLayout.safeParse(body).success).toBe(false)
    }
  })

  it("refuses a link longer than any real one, and the button's words past their limit", () => {
    const long = `https://youtu.be/${YT}?x=${"a".repeat(HERO_VIDEO_LIMITS.url)}`

    expect(issues({ video_url: long })).toEqual(["storefront_layout.video_invalid"])
    expect(issues({ video_label: "a".repeat(HERO_VIDEO_LIMITS.label + 1) })).not.toEqual([])
    expect(issues({ video_url: 42 })).not.toEqual([])
  })

  it("refuses its fields on the other openings", () => {
    expect(
      layoutDocument.safeParse({ home: [{ id: "kapak00001", type: "hero", video_url: SHORT_YT }] })
        .success
    ).toBe(false)
    expect(
      layoutDocument.safeParse({
        home: [{ id: "kapak00001", type: "hero", variant: "category_list", video_url: SHORT_YT }],
      }).success
    ).toBe(false)
  })

  it("prints the short link and the button's words for the storefront to read", () => {
    const section = layoutDocument.parse({
      home: [full({ video_url: ` https://youtu.be/${YT}?si=abc `, video_label: "Tanıtım" })],
    }).home[0]
    if (section?.type !== "hero") {
      throw new Error("no hero")
    }
    const readers = {
      fill: (text: string | null) => text,
      link: () => null,
      image: () => null,
    }

    expect(hydrateHero(section, readers as never)).toMatchObject({
      video_url: SHORT_YT,
      video_label: "Tanıtım",
    })
  })
})
