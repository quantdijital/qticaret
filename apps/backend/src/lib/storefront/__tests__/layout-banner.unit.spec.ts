import path from "node:path"
import { imagesOf, linksOf } from "../../../workflows/storefront/layout-check"
import { hydrateSection } from "../../../workflows/storefront/layout-hydrate"
import type { HydrateContext } from "../../../workflows/storefront/layout-hydrate"
import { layoutDocument } from "../layout"
import { BANNER_DEFAULTS, BANNER_SETTINGS, BANNER_TONES, banner } from "../sections/banner"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-banner.ts"
)

// Every body section shows on every screen unless the shop picks one (bilesen-standardi §2)
const ALWAYS = { visible: true, starts_at: null, ends_at: null, device: "all" }
const WIDE = { url: "http://localhost:9000/static/afis.webp", alt: "Afiş" }
const PHONE = { url: "http://localhost:9000/static/afis-dar.webp", alt: "Afiş yakın" }
const band = (more: Record<string, unknown> = {}, slide: Record<string, unknown> = {}) => ({
  id: "afis0001",
  type: "banner",
  slides: [{ image: WIDE, ...slide }],
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the picture band's settings (adr/0049 Ek 2026-11-14 §3.3 E2)", () => {
  it("reads a band stored before the settings as it was drawn: every step its default", () => {
    const doc = layoutDocument.parse({ home: [band()] })

    expect(doc.home[0]).toEqual({
      ...band(),
      ...ALWAYS,
      ...BANNER_DEFAULTS,
      // Today's band (adr/0077 Ek): the variants' default
      variant: "standard",
      slides: [
        {
          image: WIDE,
          mobile_image: null,
          heading: null,
          text: null,
          link: null,
          second_link: null,
          tone: "light",
        },
      ],
    })
  })

  it("keeps the shop's steps, a second button, a tone and a phone picture", () => {
    const shop = { kind: "system", target: "shop", label: "Mağazaya git" }
    const section = banner.parse(
      band(
        {
          width: "full",
          height: "high",
          text_position: "middle_center",
          overlay: "none",
          button_style: "outline",
        },
        { mobile_image: PHONE, link: shop, second_link: shop, tone: "dark" }
      )
    )

    expect(section).toMatchObject({
      width: "full",
      height: "high",
      text_position: "middle_center",
      overlay: "none",
      button_style: "outline",
      slides: [{ mobile_image: PHONE, second_link: shop, tone: "dark" }],
    })
  })

  it("refuses a step off its list with the section's error key, never a free number", () => {
    for (const more of [
      { overlay: 0.4 },
      { overlay: "max" },
      { height: 480 },
      { text_position: "left" },
      { width: "wide" },
      { button_style: "ghost" },
    ]) {
      expect(issues({ home: [band(more)] })).toContain("storefront_layout.section_invalid")
    }
    expect(issues({ home: [band({}, { tone: "grey" })] })).toContain(
      "storefront_layout.section_invalid"
    )
    expect(issues({ home: [band({ colour: "#fff" })] }).length).toBeGreaterThan(0)
  })

  it("names both buttons for the save's checks and both pictures for the media library", () => {
    const shop = { kind: "system", target: "shop", label: null } as const
    const category = { kind: "category", target: "pcat_01", label: "Bıçaklar" } as const
    const doc = layoutDocument.parse({
      home: [band({}, { mobile_image: PHONE, link: shop, second_link: category })],
    })

    const [home] = doc.home
    expect(home && linksOf(home)).toEqual([shop, category])
    expect(home && imagesOf(home)).toEqual([WIDE.url, PHONE.url])
  })

  it("prints the steps, the tone, the phone picture and a broken second button as none", async () => {
    const shop = { kind: "system", target: "shop", label: null } as const
    const gone = { kind: "product", target: "prod_01", label: null } as const
    const section = banner.parse(
      band({ overlay: "strong" }, { mobile_image: PHONE, link: shop, second_link: gone })
    )
    const [slide] = section.slides
    const shown = { label: null, kind: "system", target: "shop", path: null }
    const at = {
      values: {},
      images: new Map(),
      links: new Map<unknown, unknown>([
        [slide?.link, shown],
        [slide?.second_link, null],
      ]),
    } as unknown as HydrateContext

    expect(await hydrateSection(section, at)).toEqual({
      id: "afis0001",
      type: "banner",
      slides: [
        {
          image: { ...WIDE, width: null, height: null, derivatives: null },
          mobile_image: { ...PHONE, width: null, height: null, derivatives: null },
          heading: null,
          text: null,
          link: shown,
          second_link: null,
          tone: "light",
        },
      ],
      ...BANNER_DEFAULTS,
      overlay: "strong",
    })
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(BANNER_SETTINGS).toEqual(contract["BANNER_SETTINGS"])
    expect(BANNER_DEFAULTS).toEqual(contract["BANNER_DEFAULTS"])
    expect(BANNER_TONES).toEqual(contract["BANNER_TONES"])
  })
})
