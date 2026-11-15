import { screen, waitFor, within } from "@testing-library/react"
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

const frame = () => screen.findByTitle("Vitrin önizlemesi")

/** Picks a page in the bar's page selector. */
async function choosePage(name: string) {
  await user.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
  await user.click(await screen.findByRole("option", { name }))
}

describe("the main sections in the theme editor (adr/0049 Ek 2026-11-14 §5, §7)", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    serve(fetchMock, admin)
    admin.product.list.mockResolvedValue({ products: PRODUCTS })
  })
  afterEach(() => {
    releaseClock()
  })

  it("opens the header bar from its fixed row: its stickiness, the centred one in preparation, never removed", async () => {
    renderEditor()
    const tree = await opened()
    await frame()

    await user.click(within(tree).getByRole("button", { name: "Üst bilgi" }))
    const sticky = await screen.findByRole("switch", { name: /^Üst bilgi sabit kalsın/ })
    expect(sticky).toBeChecked()
    expect(screen.getByRole("radio", { name: "Ortada logo (hazırlanıyor)" })).toBeDisabled()
    expect(screen.getByRole("radio", { name: "Solda logo" })).toBeChecked()
    expect(
      screen.getByText(
        "Bu bölüm sayfanın sabit parçasıdır; gizlenemez, taşınamaz, kopyalanamaz ve kaldırılamaz."
      )
    ).toBeVisible()
    expect(screen.queryByRole("button", { name: "Bölümü kaldır" })).toBeNull()
    expect(screen.queryByText("Görünürlük")).toBeNull()

    await user.click(sticky)
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.header.at(-1)).toMatchObject({
        type: "header_bar",
        variant: "standard",
        sticky: false,
        visible: true,
      })
    })
  })

  it("opens the footer and the product's block with no choice of a single variant, and keeps them first", async () => {
    renderEditor()
    const tree = await opened()
    await frame()

    await user.click(within(tree).getByRole("button", { name: "Alt bilgi" }))
    expect(await screen.findByText(/İletişim bilgileriniz, menüleriniz/)).toBeVisible()
    expect(screen.queryByText("Biçim")).toBeNull()
    expect(screen.queryByRole("button", { name: "Bölümü kaldır" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Bölümlere dön" }))

    await choosePage("Ürün sayfası")
    await user.click(within(tree).getByRole("button", { name: "Ürünün kendi bilgileri" }))
    expect(await screen.findByText(/Fotoğraflar, fiyat, seçenekler/)).toBeVisible()
    expect(screen.queryByText("Biçim")).toBeNull()
    expect(screen.queryByRole("button", { name: "Çoğalt" })).toBeNull()
  })
  it("edits the footer's own settings and saves them with it (adr/0049 Ek 2026-11-15)", async () => {
    renderEditor()
    const tree = await opened()
    await frame()

    await user.click(within(tree).getByRole("button", { name: "Alt bilgi" }))
    await user.click(await screen.findByRole("radio", { name: "Simgeyle" }))
    await user.click(screen.getByRole("checkbox", { name: "Havale / EFT" }))
    await user.click(screen.getByRole("switch", { name: /Yukarı çık düğmesi/ }))
    expect(screen.getByRole("radio", { name: "Sağda" })).toBeChecked()
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(
        lastSaved(fetchMock)?.footer.find((section) => section.type === "footer_bar")
      ).toMatchObject({
        social: "icons",
        payment_badges: ["bank_transfer"],
        back_to_top: true,
        back_to_top_side: "right",
      })
    })
  })
})
