import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import i18next from "i18next"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnnouncementSetting } from "@qticaret/types"
import type { AnnouncementBar, AnySection } from "@/features/storefront/api/layout"
import { newAnnouncementBar } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { searchSettings } from "../settings-search"
import { FIELD_IDS, sectionFields } from "./field-registry"
import { openGroup, openTab } from "../settings-groups.fixtures"

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

/** The bar's panel as the editor holds it: every change kept. */
function renderPanel(section: AnySection) {
  const changes: AnySection[] = []
  function Holder() {
    const [value, setValue] = useState(section)
    return (
      <SectionPanel
        section={value}
        group="header"
        problems={{}}
        canDuplicate
        onChange={(next) => {
          changes.push(next)
          setValue(next)
        }}
        onPlace={vi.fn()}
        onBack={vi.fn()}
        onDuplicate={vi.fn()}
        onRemove={vi.fn()}
        badges={[]}
        onBadges={vi.fn()}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Holder />
    </QueryClientProvider>
  )
  return changes
}

const bar = (over: Partial<AnnouncementBar> = {}): AnnouncementBar => ({
  ...newAnnouncementBar("duyuru0001"),
  lines: ["Kargo bedava", "Aynı gün kargo"],
  ...over,
})
const field = (setting: AnnouncementSetting) =>
  document.getElementById(FIELD_IDS.announcement("duyuru0001", setting))

/** docs/tema/bilesen-denetimi (b) 6: how several announcements show and turn. */
describe("the announcement bar's settings", () => {
  it("start as the first line alone, offered only once there are several lines", () => {
    renderPanel(bar({ lines: ["Kargo bedava"] }))
    expect(field("mode")).toBeNull()
    expect(screen.queryByRole("button", { name: "Hareket" })).toBeNull()
  })

  it("show the turning's settings in Stil › Hareket once the lines take turns", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(bar())
    const mode = field("mode")
    if (!mode) throw new Error("no mode field")
    expect(
      within(mode)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Yalnız ilki", "Sırayla dönsün", "Yan yana"])
    expect(field("interval")).toBeNull()

    await user.click(screen.getByRole("radio", { name: /Sırayla dönsün/ }))
    expect(changes.at(-1)).toMatchObject({ mode: "rotate" })
    // The group comes in "Stil", closed as every group but the variant
    expect(field("interval")).not.toBeNull()
    await openTab(user, "style")
    expect(screen.getByRole("button", { name: "Hareket" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    await openGroup(user, "Hareket")
    await user.click(screen.getByRole("radio", { name: /Hızlı/ }))
    expect(changes.at(-1)).toMatchObject({ interval: "fast" })
    await user.click(screen.getByRole("radio", { name: /Üzerine gelince/ }))
    expect(changes.at(-1)).toMatchObject({ pause_button: "hover" })
    expect(screen.getByText(/Düğme tamamen kaldırılamaz/)).toBeInTheDocument()
    await user.click(screen.getByRole("switch", { name: /Üzerine gelince dur/ }))
    expect(changes.at(-1)).toMatchObject({ hover_pause: "off" })
  })

  it("offer where the lines sit and the bar's size alone in Stil, open, even for one line", async () => {
    const user = userEvent.setup()
    const changes = renderPanel(bar({ lines: ["Kargo bedava"] }))
    await openTab(user, "style")
    // "Yazı ve zemin" is the tab's one group: open, with no header to fold it
    expect(screen.queryByRole("button", { name: "Yazı ve zemin" })).toBeNull()
    expect(screen.getByRole("group", { name: "Yazı ve zemin" })).toBeInTheDocument()
    const align = field("align")
    const size = field("size")
    if (!align || !size) throw new Error("no align or size field")
    expect(
      within(align)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Otomatik", "Sol", "Orta", "Sağ"])
    expect(
      within(size)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Küçük", "Orta", "Büyük"])
    // The bar as it was is chosen: Otomatik and Orta, nothing to reset
    expect(within(align).getByRole("radio", { name: "Otomatik" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    expect(within(size).getByRole("radio", { name: "Orta" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    expect(screen.queryByRole("button", { name: "Varsayılana dön" })).toBeNull()

    await user.click(within(align).getByRole("radio", { name: "Orta" }))
    expect(changes.at(-1)).toMatchObject({ align: "center", size: "medium" })
    await user.click(within(size).getByRole("radio", { name: "Büyük" }))
    expect(changes.at(-1)).toMatchObject({ align: "center", size: "large" })
    expect(screen.getByText(/bağlantılara değecekse hemen soluna kayar/)).toBeInTheDocument()

    await user.click(within(align).getByRole("button", { name: "Varsayılana dön" }))
    expect(changes.at(-1)).toMatchObject({ align: "auto", size: "large" })
  })

  it("hide the turning's settings side by side", () => {
    renderPanel(bar({ mode: "inline" }))
    expect(field("mode")).not.toBeNull()
    expect(field("interval")).toBeNull()
  })

  it("are found by the search as the bar stands", () => {
    const t = i18next.t.bind(i18next)
    const keys = (section: AnnouncementBar, query: string) =>
      searchSettings(query, [{ section, group: "header", names: [] }], t).map(
        (hit) => hit.field?.key ?? null
      )

    expect(keys(bar(), "birden çok")).toContain("announcement.mode")
    expect(keys(bar({ lines: ["Kargo bedava"] }), "hizalama")).toContain("announcement.align")
    expect(keys(bar(), "Büyük")).toContain("announcement.size")
    expect(keys(bar(), "interval")).not.toContain("announcement.interval")
    expect(keys(bar({ mode: "rotate" }), "geçiş süresi")).toContain("announcement.interval")
    expect(keys(bar({ mode: "rotate" }), "durdur")).toContain("announcement.pause_button")
    expect(
      sectionFields(bar({ mode: "rotate" }), "header").find(
        (each) => each.key === "announcement.hover_pause"
      )?.group
    ).toBe("motion")
  })
})
