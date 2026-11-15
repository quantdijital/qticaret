import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import i18next from "i18next"
import type { ReactNode } from "react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AnnouncementBar, AnySection } from "@/features/storefront/api/layout"
import { newAnnouncementBar } from "@/features/storefront/layout/sections"
import { SectionPanel } from "../section-panel"
import { searchSettings } from "../settings-search"
import { FIELD_IDS, sectionFields } from "./field-registry"

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
const field = (setting: "mode" | "interval" | "pause_button" | "hover_pause") =>
  document.getElementById(FIELD_IDS.announcement("duyuru0001", setting))

/** docs/tema/bilesen-denetimi (b) 6: how several announcements show and turn. */
describe("the announcement bar's settings", () => {
  it("start as the first line alone, offered only once there are several lines", () => {
    renderPanel(bar({ lines: ["Kargo bedava"] }))
    expect(field("mode")).toBeNull()
    expect(screen.queryByRole("button", { name: "Hareket" })).toBeNull()
  })

  it("show the turning's settings in an open Hareket group once the lines take turns", async () => {
    const changes = renderPanel(bar())
    const mode = field("mode")
    if (!mode) throw new Error("no mode field")
    expect(
      within(mode)
        .getAllByRole("radio")
        .map((radio) => radio.textContent)
    ).toEqual(["Yalnız ilki", "Sırayla dönsün", "Yan yana"])
    expect(field("interval")).toBeNull()

    await userEvent.click(screen.getByRole("radio", { name: /Sırayla dönsün/ }))
    expect(changes.at(-1)).toMatchObject({ mode: "rotate" })
    expect(screen.getByRole("button", { name: "Hareket" })).toHaveAttribute("aria-expanded", "true")
    await userEvent.click(screen.getByRole("radio", { name: /Hızlı/ }))
    expect(changes.at(-1)).toMatchObject({ interval: "fast" })
    await userEvent.click(screen.getByRole("radio", { name: /Üzerine gelince/ }))
    expect(changes.at(-1)).toMatchObject({ pause_button: "hover" })
    expect(screen.getByText(/Düğme tamamen kaldırılamaz/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("switch", { name: /Üzerine gelince dur/ }))
    expect(changes.at(-1)).toMatchObject({ hover_pause: "off" })
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
