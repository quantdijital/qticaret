import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import type { BannerSection } from "@/features/storefront/api/layout"
import { lookFieldsFor } from "@/features/storefront/layout/look"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { BANNER_LAYOUT_SETTINGS, BANNER_OTHER_SETTINGS } from "./banner-groups"
import { BannerSettings } from "./banner-settings"
import { FIELD_IDS, sectionFields } from "./field-registry"

const slide = {
  image: { url: "http://localhost:9000/static/a.webp", alt: "Afiş" },
  mobile_image: null,
  heading: null,
  text: null,
  link: null,
  second_link: null,
  tone: "light" as const,
}
const newBand = () =>
  ({ ...newHomeSection("banner", "gorselbant"), slides: [slide] }) as BannerSection

function renderSettings(section = newBand()) {
  const changes: BannerSection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <BannerSettings
        section={value}
        settings={[...BANNER_LAYOUT_SETTINGS, ...BANNER_OTHER_SETTINGS]}
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
      />
    )
  }
  render(<Holder />)
  return changes
}

/** adr/0049 Ek 2026-11-14 §3.3 E2: the picture band's settings in the theme editor. */
describe("BannerSettings", () => {
  it("starts a new band with the band's old drawing: every step its default", () => {
    expect(newBand()).toMatchObject({
      width: "boxed",
      height: "medium",
      text_position: "bottom_left",
      overlay: "medium",
      button_style: "solid",
    })
  })

  it("names each setting in Turkish with its term small, and sets a step", async () => {
    const changes = renderSettings()
    expect(screen.getByText("Perde gücü")).toBeInTheDocument()
    expect(screen.getByText("overlay")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("radio", { name: "Güçlü" }))
    await userEvent.click(screen.getByRole("radio", { name: "Sağ üst" }))

    expect(changes.at(-1)).toMatchObject({ overlay: "strong", text_position: "top_right" })
    const [resetPlace] = screen.getAllByRole("button", { name: "Varsayılana dön" })
    expect(resetPlace).toBeDefined()
    if (resetPlace) await userEvent.click(resetPlace)
    expect(changes.at(-1)).toMatchObject({ text_position: "bottom_left" })
  })

  it('keeps the basics open in "Diziliş" and the rarer ones closed (denetim 1.4)', () => {
    expect(BANNER_LAYOUT_SETTINGS).toEqual(["height", "text_position", "overlay"])
    expect(BANNER_OTHER_SETTINGS).toEqual(["width", "button_style"])
  })

  it("is found by the settings search in its groups, and offers no second width", () => {
    const fields = sectionFields(newBand(), "home")
    const keys = fields.map((field) => field.key)
    expect(keys).toEqual(
      expect.arrayContaining(["banner.width", "banner.overlay", "banner.text_position"])
    )
    expect(keys).not.toContain("look.width")
    expect(lookFieldsFor("banner")).not.toContain("width")
    expect(fields.find((field) => field.key === "banner.overlay")).toMatchObject({
      group: "layout",
      target: FIELD_IDS.banner("gorselbant", "overlay"),
    })
    expect(fields.find((field) => field.key === "banner.button_style")).toMatchObject({
      group: "look",
    })
  })

  it("holds a phone picture's alt text and a second button's label like the first's", () => {
    const flawed = {
      ...newBand(),
      slides: [
        {
          ...slide,
          mobile_image: { url: "http://localhost:9000/static/b.webp", alt: "x".repeat(400) },
          second_link: { kind: "url" as const, url: "https://ornek.com", label: "" },
        },
      ],
    }
    const problems = sectionProblems(flawed)
    expect(problems["slides.0.mobile_image"]).toBeDefined()
    expect(problems["slides.0.second_link"]).toBe("linkLabel")
  })
})
