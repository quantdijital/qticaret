import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { i18next } from "@/lib/i18n"
import type {
  AnySection,
  FooterNewsletter,
  NewsletterSection,
} from "@/features/storefront/api/layout"
import { newFooterNewsletter, newHomeSection } from "@/features/storefront/layout/sections"
import { switchVariant } from "@/features/storefront/layout/variants"
import { renderPanel } from "../section-panel.fixtures"
import { openGroup } from "../settings-groups.fixtures"
import { searchSettings } from "../settings-search"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const band = () => switchVariant<FooterNewsletter>(newFooterNewsletter("altbulten1"), "split")

const search = (query: string, section: AnySection, group: "home" | "footer") =>
  searchSettings(query, [{ section, group, names: [] }], i18next.t.bind(i18next)).map(
    (hit) => hit.field?.key ?? null
  )

/** adr/0070 §4 Ek: the footer box's band on the free rows footer's ground, under "Stil". */
describe("the footer box's joined band", () => {
  it("turns on and off under Stil, off as the field's absence", async () => {
    const user = userEvent.setup()
    const { changes } = renderPanel(band(), "footer")
    await user.click(screen.getByRole("tab", { name: /^Stil/ }))
    await openGroup(user, "Yeri")
    const toggle = screen.getByRole("switch", { name: /Alt bilgiyle birleşik/ })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(changes.at(-1)).toMatchObject({ variant: "split", joined: true })
    await user.click(screen.getByRole("switch", { name: /Alt bilgiyle birleşik/ }))
    expect(changes.at(-1)).not.toHaveProperty("joined")
  })

  it("is offered on the footer's bands only, and found by the settings search", () => {
    expect(search("birlesik", band(), "footer")).toContain("joined")
    expect(search("birlesik", newFooterNewsletter("altbulten1"), "footer")).not.toContain("joined")
    const page = switchVariant(
      newHomeSection("newsletter", "ebultenkutu") as NewsletterSection,
      "split"
    )
    expect(search("birlesik", page, "home")).not.toContain("joined")
  })

  it("drops it when the box leaves the bands", () => {
    const joined = { ...band(), joined: true }
    expect(switchVariant(joined, "standard")).not.toHaveProperty("joined")
  })
})
