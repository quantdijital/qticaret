import { screen, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import {
  holdClock,
  layoutOf,
  opened,
  releaseClock,
  renderEditor,
  serve,
} from "./theme-editor.fixtures"
import type { AdminMock, Init } from "./theme-editor.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const admin = vi.hoisted<AdminMock>(() => ({
  productCategory: { list: vi.fn() },
  product: { list: vi.fn() },
  productCollection: { list: vi.fn() },
}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useRouter: () => ({ history: { back: vi.fn() } }),
  useCanGoBack: () => true,
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
}))

let user: UserEvent

/** The looks are the owner's alone (2026-11-23): the editor offers them to no one else. */
describe("ThemeEditor's looks by role", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
  })
  afterEach(() => {
    releaseClock()
  })

  it("gives an admin the publication history alone, nothing kept as a look", async () => {
    serve(fetchMock, admin, layoutOf(), { role: "admin" })
    renderEditor()
    await opened()

    const history = await screen.findByRole("button", { name: "Yayın geçmişi" })
    expect(screen.queryByRole("button", { name: "Görünümler" })).not.toBeInTheDocument()
    await user.click(history)
    const sheet = await screen.findByRole("dialog", { name: "Yayın geçmişi" })
    expect(
      within(sheet).getByRole("button", { name: "1. yayını taslağa geri yükle" })
    ).toBeInTheDocument()
    expect(
      within(sheet).queryByRole("button", { name: "1. yayını kayıtlı görünümlere ekle" })
    ).not.toBeInTheDocument()
    expect(sheet).not.toHaveTextContent("Kayıtlı görünümlerim")
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith("/admin/storefront-designs"))).toBe(
      false
    )
  })

  it("gives the owner the looks menu", async () => {
    serve(fetchMock, admin)
    renderEditor()
    await opened()

    await user.click(await screen.findByRole("button", { name: "Görünümler" }))
    expect(await screen.findByRole("menuitem", { name: "Bu görünümü kaydet" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Tüm görünümler" })).toBeInTheDocument()
  })
})
