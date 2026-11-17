import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { FOOTER_BAR_DEFAULTS, FOOTER_COLUMNS_DEFAULTS } from "@qticaret/types"
import { i18next } from "@/lib/i18n"
import type { AnySection, FooterBarSection } from "@/features/storefront/api/layout"
import { switchVariant } from "@/features/storefront/layout/variants"
import { renderPanel } from "../section-panel.fixtures"
import { openGroup } from "../settings-groups.fixtures"
import { searchSettings } from "../settings-search"
import { VariantField } from "./variant-field"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const ledger = {
  id: "mainfooter",
  type: "footer_bar",
  visible: true,
  starts_at: null,
  ends_at: null,
  variant: "ledger",
  ...FOOTER_BAR_DEFAULTS,
  payment_badges: [],
} as FooterBarSection

const columns = () => switchVariant(ledger, "brand_columns")

const search = (query: string, section: AnySection) =>
  searchSettings(query, [{ section, group: "footer", names: [] }], i18next.t.bind(i18next)).map(
    (hit) => hit.field?.key ?? null
  )

/** adr/0049 Ek 2026-11-17: the brand columns footer in the panel. */
describe("the brand columns footer's settings", () => {
  it("is offered beside the ledger, each drawn in small", async () => {
    const picked: string[] = []
    const { container } = render(
      <VariantField
        id="v"
        type="footer_bar"
        value="ledger"
        onChange={(next) => picked.push(next)}
      />
    )
    expect(screen.getByRole("radio", { name: /Standart/ })).toBeChecked()
    expect(container.querySelectorAll("svg [data-sketch-frame]")).toHaveLength(3)
    // adr/0070: the free rows footer is listed, not offered, until its drawing and editor land
    expect(screen.getByRole("radio", { name: /Serbest düzen/ })).toBeDisabled()
    await userEvent.click(screen.getByRole("radio", { name: /Marka ve sütunlar/ }))
    expect(picked).toEqual(["brand_columns"])
  })

  it("starts a switched footer from the defaults, keeps the common settings, drops its own back", () => {
    const switched = switchVariant({ ...ledger, social: "icons" }, "brand_columns")
    expect(switched).toEqual({
      ...ledger,
      social: "icons",
      variant: "brand_columns",
      ...FOOTER_COLUMNS_DEFAULTS,
    })
    expect(switchVariant({ ...switched, ground: "stage" } as FooterBarSection, "ledger")).toEqual({
      ...ledger,
      social: "icons",
    })
  })

  it("writes the strip and the short line under İçerik, the ground and logos under Stil", async () => {
    const user = userEvent.setup()
    const { changes } = renderPanel(columns(), "footer")
    await openGroup(user, "İçerik")
    await user.click(screen.getByRole("switch", { name: /Üst şerit/ }))
    expect(changes.at(-1)).toMatchObject({ top_strip: false })
    fireEvent.change(screen.getByRole("textbox", { name: /Kısa tanıtım/ }), {
      target: { value: "Aynı gün kargo" },
    })
    expect(changes.at(-1)).toMatchObject({ about: "Aynı gün kargo" })

    await openGroup(user, "Yazı ve zemin")
    await user.click(screen.getByRole("radio", { name: "Koyu" }))
    expect(changes.at(-1)).toMatchObject({ ground: "stage" })
    await user.click(screen.getByRole("radio", { name: "Yalın" }))
    expect(changes.at(-1)).toMatchObject({ badge_style: "plain" })
  })

  it("is found by its everyday words only while the footer is drawn as it", () => {
    expect(search("zemin", columns())).toContain("footer.ground")
    expect(search("tanıtım", columns())).toContain("footer.about")
    expect(search("yalın", columns())).toContain("footer.badge_style")
    expect(search("zemin", ledger)).not.toContain("footer.ground")
  })
})
