import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BannerSection, PostsSection } from "@/features/storefront/api/layout"
import { sectionProblems } from "@/features/storefront/layout/problems"
import { newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { renderPanel } from "../section-panel.fixtures"
import { openGroup } from "../settings-groups.fixtures"
import { sectionFields } from "./field-registry"
import { previewField } from "./preview-fields"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const PHOTO = { url: "http://localhost:9000/static/vadi.webp", alt: "Vadi" }
const guides = () =>
  ({ ...newHomeSection("posts", "yazilar01"), title: "Gezi yazıları" }) as PostsSection
const band = () =>
  ({
    ...newHomeSection("banner", "kampanya1"),
    slides: [
      {
        image: PHOTO,
        mobile_image: null,
        heading: "Sıradaki maceranız",
        text: null,
        link: null,
        second_link: null,
        tone: "light",
      },
    ],
  }) as BannerSection

/** adr/0077 Ek (Vadi): the posts' intro panel in the panel. */
describe("the posts' intro panel", () => {
  it("starts as today's tiles; a switch keeps the title and count and starts the panel's own", () => {
    expect(guides()).toMatchObject({ variant: "grid", limit: 3 })
    const panel = switchVariant(guides(), "intro_panel")
    expect(panel).toMatchObject({
      variant: "intro_panel",
      title: "Gezi yazıları",
      limit: 3,
      eyebrow: null,
      intro: null,
      link: null,
    })
    expect(switchVariant({ ...panel, eyebrow: "İlham" }, "grid")).toEqual(guides())
  })

  it("is picked in Biçim, drawn small, and shows its words and button under İçerik", async () => {
    const user = userEvent.setup()
    const { changes } = renderPanel(guides(), "home")
    await openGroup(user, "Biçim")
    const variants = screen.getByRole("group", { name: "Biçim" })
    expect(within(variants).getByRole("radio", { name: /Kutucuklar/ })).toBeChecked()
    const panel = within(variants).getByRole("radio", { name: /Tanıtım paneli/ })
    expect(panel.querySelector("svg")).not.toBeNull()
    await user.click(panel)
    expect(changes.at(-1)).toMatchObject({ variant: "intro_panel", eyebrow: null })
  })

  it("shows the upper line, intro and button on the panel only", async () => {
    const user = userEvent.setup()
    const { changes } = renderPanel(switchVariant(guides(), "intro_panel"), "home")
    await openGroup(user, "İçerik")
    await user.type(screen.getByLabelText(/Üst satır/), "İ")
    expect(changes.at(-1)).toMatchObject({ eyebrow: "İ", title: "Gezi yazıları" })
    expect(screen.getByLabelText(/Giriş/)).toBeInTheDocument()
    expect(screen.getByText("Düğme")).toBeInTheDocument()
  })

  it("shows none of them on the tiles", async () => {
    const user = userEvent.setup()
    renderPanel(guides(), "home")
    await openGroup(user, "İçerik")
    expect(screen.queryByLabelText(/Üst satır/)).toBeNull()
    expect(screen.queryByLabelText(/Giriş/)).toBeNull()
  })

  it("checks the panel's words and lands the preview's marks on their fields", () => {
    const panel = switchVariant(guides(), "intro_panel")
    expect(sectionProblems(panel)).toEqual({})
    expect(sectionProblems({ ...panel, intro: "x".repeat(201) })).toEqual({ intro: "tooLong" })
    expect(sectionProblems({ ...guides(), intro: "x".repeat(201) })).toEqual({})
    expect(previewField(panel, "eyebrow")).toEqual({
      target: "yazilar01-eyebrow",
      group: "content",
    })
    expect(previewField(panel, "link")).toMatchObject({ target: "yazilar01-link" })
    expect(previewField(guides(), "eyebrow")).toBeNull()
  })
})

/** adr/0077 Ek (Vadi): the split band in the panel. */
describe("the split band", () => {
  it("starts as today's band; a switch keeps the slides and steps, starts a straight edge", () => {
    expect(band()).toMatchObject({ variant: "standard", height: "medium" })
    const split = switchVariant(band(), "split")
    expect(split).toMatchObject({ variant: "split", eyebrow: null, edge: "straight" })
    expect(split.slides).toEqual(band().slides)
    expect(switchVariant({ ...split, edge: "curved" }, "standard")).toEqual(band())
  })

  it("is picked in Biçim, shows its upper line, and its edge beside the height", async () => {
    const user = userEvent.setup()
    const { changes } = renderPanel(band(), "home")
    await openGroup(user, "Biçim")
    const variants = screen.getByRole("group", { name: "Biçim" })
    expect(within(variants).getByRole("radio", { name: /Görsel üstü yazı/ })).toBeChecked()
    await user.click(within(variants).getByRole("radio", { name: /Bölünmüş bant/ }))
    expect(changes.at(-1)).toMatchObject({ variant: "split", edge: "straight" })
  })

  it("offers the edge and hides the words' place and veil on the split", async () => {
    const user = userEvent.setup()
    const { changes } = renderPanel(switchVariant(band(), "split"), "home")
    await openGroup(user, "Diziliş")
    expect(screen.queryByText("Perde gücü")).toBeNull()
    await user.click(screen.getByRole("radio", { name: "Yuvarlak" }))
    expect(changes.at(-1)).toMatchObject({ edge: "curved" })
    await openGroup(user, "İçerik")
    expect(screen.getByLabelText(/Üst satır/)).toBeInTheDocument()
    expect(screen.getByText(/yalnız ilk görseli/)).toBeInTheDocument()
  })

  it("lists the edge in the settings search on the split only", () => {
    const keys = (section: BannerSection) => sectionFields(section, "home").map((f) => f.key)
    expect(keys(band())).toContain("banner.overlay")
    expect(keys(band())).not.toContain("banner.edge")
    const split = keys(switchVariant(band(), "split"))
    expect(split).toContain("banner.edge")
    expect(split).not.toContain("banner.overlay")
    expect(split).not.toContain("banner.text_position")
  })

  it("checks the upper line and lands its mark on its field", () => {
    const split = switchVariant(band(), "split")
    expect(sectionProblems({ ...split, eyebrow: "x".repeat(41) })).toEqual({ eyebrow: "tooLong" })
    expect(previewField(split, "eyebrow")).toEqual({
      target: "kampanya1-eyebrow",
      group: "content",
    })
    expect(previewField(band(), "eyebrow")).toBeNull()
  })
})
