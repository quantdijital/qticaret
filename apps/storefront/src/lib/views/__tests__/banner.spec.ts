import { describe, expect, it, vi } from "vitest"
import type { StoreBannerSection } from "@qticaret/types"
import { t } from "@/lib/i18n"

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }))

const { bannerView } = await import("../banner")

const image = (name: string) => ({
  url: `http://localhost:9000/static/${name}.jpg`,
  alt: name,
  width: 1600,
  height: 900,
  derivatives: null,
})
const link = (path: string) => ({ label: path, kind: "url" as const, target: null, path })

describe("the picture band's view (adr/0049 Ek 2026-11-14 §3.3 E2)", () => {
  it("reads a band from a backend before the settings as it was drawn", () => {
    const view = bannerView(
      {
        id: "afis1",
        type: "banner",
        slides: [{ image: image("genis"), heading: "Kış", text: null, link: link("/kis") }],
      },
      t
    )

    expect(view).toMatchObject({
      width: "boxed",
      height: "medium",
      text_position: "bottom_left",
      overlay: "medium",
      button_style: "solid",
      slides: [{ mobileImage: null, secondLink: null, tone: "light", link: { path: "/kis" } }],
    })
  })

  it("carries the shop's steps, a phone picture and two buttons; an unknown step reads as the default", () => {
    const view = bannerView(
      {
        id: "afis1",
        type: "banner",
        slides: [
          {
            image: image("genis"),
            mobile_image: image("dar"),
            heading: null,
            text: null,
            link: link("/a"),
            second_link: link("/b"),
            tone: "dark",
          },
        ],
        width: "full",
        height: "low",
        text_position: "top_right",
        overlay: "glow",
        button_style: "text",
      } as unknown as StoreBannerSection,
      t
    )

    expect(view).toMatchObject({
      width: "full",
      height: "low",
      text_position: "top_right",
      overlay: "medium",
      button_style: "text",
    })
    expect(view.slides[0]?.mobileImage?.src).toContain("dar")
    expect(view.slides[0]).toMatchObject({
      link: { path: "/a" },
      secondLink: { path: "/b" },
      tone: "dark",
    })
    expect(view.slides[0]).not.toHaveProperty("secondFirst")
  })

  it("moves a second button up when the first one is broken", () => {
    const view = bannerView(
      {
        id: "afis1",
        type: "banner",
        slides: [
          { image: image("genis"), heading: null, text: null, link: null, second_link: link("/b") },
        ],
      },
      t
    )

    expect(view.slides[0]).toMatchObject({ link: { path: "/b" }, secondLink: null })
    // The editor's field mark names the design's second button (adr/0065 Faz 2b)
    expect(view.slides[0]?.secondFirst).toBe(true)
  })
})

describe("the split band's hand note", () => {
  const split = (more: Partial<StoreBannerSection>): StoreBannerSection => ({
    id: "afis2",
    type: "banner",
    variant: "split",
    slides: [{ image: image("genis"), heading: "Kış", text: null, link: link("/kis") }],
    ...more,
  })

  it("carries the note on a split only, in the accent face when asked", () => {
    expect(bannerView(split({ note: " Sizi bekliyoruz! " }), t, true).note).toEqual({
      text: "Sizi bekliyoruz!",
      hand: true,
    })
    expect(bannerView(split({ note: "Merhaba" }), t).note).toEqual({ text: "Merhaba", hand: false })
    // None: no note in the view at all; today's band never carries one
    expect(bannerView(split({ note: null }), t)).not.toHaveProperty("note")
    expect(bannerView(split({ variant: "standard", note: "Merhaba" }), t, true)).not.toHaveProperty(
      "note"
    )
  })
})
