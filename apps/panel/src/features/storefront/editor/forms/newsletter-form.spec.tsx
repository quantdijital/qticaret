import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
import type { AnySection, NewsletterSection } from "@/features/storefront/api/layout"
import { newFooterNewsletter, newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { renderPanel } from "../section-panel.fixtures"
import { openGroup } from "../settings-groups.fixtures"
import { searchSettings } from "../settings-search"
import { previewField } from "./preview-fields"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const box = () => newHomeSection("newsletter", "ebultenkutu") as NewsletterSection

const search = (query: string, section: AnySection, group: "home" | "footer" = "home") =>
  searchSettings(query, [{ section, group, names: [] }], i18next.t.bind(i18next)).map(
    (hit) => hit.field?.key ?? null
  )

/** adr/0049 Ek 2026-11-17 e-bülten: the newsletter box's variants in the panel. */
describe("the newsletter box's settings", () => {
  it("starts a new box as today's, its line kept across a switch, each variant's own dropped", () => {
    expect(box()).toMatchObject({ variant: "standard", description: null })
    const split = switchVariant({ ...box(), description: "Haberler" }, "split")
    expect(split).toMatchObject({ variant: "split", description: "Haberler", show_note: true })
    const card = switchVariant({ ...split, note: "Ayda bir" }, "image_card")
    expect(card).toMatchObject({ variant: "image_card", note: null, image: null })
    expect(switchVariant(card, "standard")).toEqual({ ...box(), description: "Haberler" })
  })

  it("offers the footer column variant only to the footer's box", async () => {
    const user = userEvent.setup()
    renderPanel(box(), "home")
    await openGroup(user, "Biçim")
    expect(screen.getByRole("radio", { name: /Yan yana bant/ })).toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: /Alt bilgi sütununda/ })).toBeNull()
  })

  it("offers it in the footer, and shows each variant's own fields under İçerik", async () => {
    const user = userEvent.setup()
    const { changes } = renderPanel(newFooterNewsletter("altbulten1"), "footer")
    await openGroup(user, "Biçim")
    await user.click(screen.getByRole("radio", { name: /Alt bilgi sütununda/ }))
    expect(changes.at(-1)).toMatchObject({ variant: "in_footer" })
    await user.click(screen.getByRole("radio", { name: /Görselli kart/ }))
    expect(changes.at(-1)).toMatchObject({ variant: "image_card", show_note: true, image: null })

    await openGroup(user, "İçerik")
    fireEvent.change(screen.getByRole("textbox", { name: /Açıklama/ }), {
      target: { value: "Yeni modeller e-postanızda" },
    })
    expect(changes.at(-1)).toMatchObject({ description: "Yeni modeller e-postanızda" })
    expect(screen.getByRole("textbox", { name: /Onay metni/ })).toBeInTheDocument()
    expect(screen.getByText("Görsel")).toBeInTheDocument()
    await user.click(screen.getByRole("switch", { name: /Güvence satırı/ }))
    expect(changes.at(-1)).toMatchObject({ show_note: false })
    expect(screen.queryByRole("textbox", { name: /Güvence satırı yazısı/ })).toBeNull()
  })

  it("names the consent sentence for what it is, and hides the new fields on today's box", async () => {
    const user = userEvent.setup()
    renderPanel(box(), "home")
    await openGroup(user, "İçerik")
    expect(screen.getByRole("textbox", { name: /Onay metni/ })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: /Açıklama/ })).toBeNull()
    expect(screen.queryByRole("switch", { name: /Güvence satırı/ })).toBeNull()
  })

  it("is found by its words, and the preview lands on the fields the form shows", () => {
    const split = switchVariant(box(), "split")
    expect(search("güvence", split)).toContain("show_note")
    expect(search("güvence", box())).not.toContain("show_note")
    expect(search("sütun", newFooterNewsletter("altbulten1"), "footer")).toContain("variant")
    expect(previewField(split, "description")).toMatchObject({ group: "content" })
    expect(previewField(split, "note")).toMatchObject({ group: "content" })
    expect(previewField(split, "image")).toBeNull()
    expect(previewField(box(), "description")).toBeNull()
  })
})
