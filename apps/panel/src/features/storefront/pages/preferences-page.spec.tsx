import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { URL, answer, renderPage } from "./preferences-page.fixtures"
import type { Init } from "./preferences-page.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const route = vi.hoisted(() => {
  const search: { part?: string } = {}
  return { search, navigate: vi.fn() }
})

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The open tab comes from the address (`?part=`); a tab chosen goes there
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useSearch: () => route.search,
  useNavigate: () => route.navigate,
}))

describe("PreferencesPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    route.navigate.mockReset()
    route.search = {}
    answer(fetchMock)
  })

  it("keeps only how the store behaves: the contact form first, the editor linked", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "İletişim formu" })).toBeVisible()
    const tabs = within(screen.getByRole("tablist", { name: "Vitrin tercihleri" }))
    expect(tabs.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "İletişim formu",
      "Ödeme ve kargo sayfaları",
      "Bakım modu",
    ])
    expect(screen.getByText(/Vitrinin görünüşü .* tema düzenleyicidedir/)).toBeVisible()
    // What the theme draws is the theme editor's (adr/0049 Ek 2026-11-06)
    for (const moved of ["Güven rozetleri", "Renk örnekleri", "Az kaldı rozeti"]) {
      expect(tabs.queryByRole("tab", { name: moved })).toBeNull()
      expect(screen.queryByRole("heading", { name: moved })).toBeNull()
    }
    expect(screen.queryByRole("textbox", { name: "1. rozetin başlığı" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Ana sayfa girişi" })).toBeNull()
    expect(screen.queryByRole("textbox", { name: "Ana renk" })).toBeNull()
    expect(screen.getByRole("link", { name: "Tema düzenleyiciyi aç" })).toHaveAttribute(
      "href",
      "/storefront/editor"
    )

    await userEvent.click(tabs.getByRole("tab", { name: "Bakım modu" }))
    expect(route.navigate).toHaveBeenCalledWith(expect.objectContaining({ to: ".", replace: true }))
    expect(fetchMock).toHaveBeenCalledWith(URL)
  })
})
