import { waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import {
  PRODUCTS,
  holdClock,
  lastSaved,
  opened,
  pass,
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

describe("the top strip in the editor's tree (owner 2026-11-27)", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    serve(fetchMock, admin)
    admin.product.list.mockResolvedValue({ products: PRODUCTS })
  })
  afterEach(() => {
    releaseClock()
  })

  it("lists the top strip apart from the header, the strip named by its design", async () => {
    renderEditor()
    const tree = await opened()
    const strip = within(tree).getByRole("group", { name: "Üst şerit" })
    const header = within(tree).getByRole("group", { name: "Üst bilgi" })
    expect(within(strip).getByRole("button", { name: "Koyu şerit" })).toBeVisible()
    expect(within(strip).getByRole("button", { name: "Kayan yazı ekle" })).toBeVisible()
    expect(within(header).queryByRole("button", { name: "Koyu şerit" })).toBeNull()
    expect(within(header).getByRole("button", { name: "Üst bilgi düzeni" })).toBeVisible()
    expect(within(tree).queryByRole("button", { name: "Üst bilgi" })).toBeNull()
  })

  it("hides the whole strip from its heading's eye and shows it again", async () => {
    renderEditor()
    const tree = await opened()
    const strip = within(tree).getByRole("group", { name: "Üst şerit" })
    const bar = () =>
      lastSaved(fetchMock)?.header.find((section) => section.type === "announcement_bar")

    await user.click(within(strip).getByRole("button", { name: "Üst şeridi gizle" }))
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(bar()).toMatchObject({ visible: false })
    })
    expect(within(strip).getByText(/^Üst şerit gizli/)).toBeVisible()

    await user.click(within(strip).getByRole("button", { name: "Üst şeridi göster" }))
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(bar()).toMatchObject({ visible: true })
    })
  })
})
