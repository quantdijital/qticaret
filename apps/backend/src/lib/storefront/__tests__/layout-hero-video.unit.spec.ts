import path from "node:path"
import { hydrateHero } from "../../../workflows/storefront/layout-hydrate-catalog"
import { layoutDocument } from "../layout"
import { HERO_VIDEO_LIMITS, heroVideoOf } from "../sections/hero-video"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/hero-video.ts"
)

const YT = "dQw4w9WgXcQ"
const full = (more: Record<string, unknown> = {}) => ({
  id: "kapak00001",
  type: "hero",
  variant: "full_image",
  ...more,
})
const issues = (more: Record<string, unknown>) =>
  layoutDocument.safeParse({ home: [full(more)] }).error?.issues.map((issue) => issue.message) ?? []

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

  it.each(ACCEPTED)("keeps a YouTube or Vimeo link as written: %s", (link) => {
    const section = layoutDocument.parse({ home: [full({ video_url: link })] }).home[0]

    expect(section).toMatchObject({ video_url: link, video_label: null })
  })

  it.each(REFUSED)("refuses a link that is not one: %s", (link) => {
    expect(issues({ video_url: link })).toEqual(["storefront_layout.video_invalid"])
  })

  it("refuses a link longer than any real one, and the button's words past their limit", () => {
    const long = `https://youtu.be/${YT}?x=${"a".repeat(HERO_VIDEO_LIMITS.url)}`

    expect(issues({ video_url: long })).toEqual(["storefront_layout.video_invalid"])
    expect(issues({ video_label: "a".repeat(HERO_VIDEO_LIMITS.label + 1) })).not.toEqual([])
    expect(issues({ video_url: 42 })).not.toEqual([])
  })

  it("refuses its fields on the other openings", () => {
    const link = `https://youtu.be/${YT}`

    expect(
      layoutDocument.safeParse({ home: [{ id: "kapak00001", type: "hero", video_url: link }] })
        .success
    ).toBe(false)
    expect(
      layoutDocument.safeParse({
        home: [{ id: "kapak00001", type: "hero", variant: "category_list", video_url: link }],
      }).success
    ).toBe(false)
  })

  it("prints the link and the button's words for the storefront to read", () => {
    const section = layoutDocument.parse({
      home: [full({ video_url: ` https://youtu.be/${YT} `, video_label: "Tanıtım" })],
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
      video_url: `https://youtu.be/${YT}`,
      video_label: "Tanıtım",
    })
  })
})
