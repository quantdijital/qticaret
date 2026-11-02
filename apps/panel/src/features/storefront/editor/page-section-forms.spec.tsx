import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import { PRODUCTS, lastSaved, opened, renderEditor, serve } from "./theme-editor.fixtures"
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

// Each test switches the page, types, picks and waits for a save: under a
// full run's load that takes longer than the default 5 s
const HEAVY = { timeout: 15_000 }
const SAVED = { timeout: 4000 }
const status = () => screen.getByRole("status", { name: "Taslağın durumu" })

let user: UserEvent

/** Opens a page's section from its row in the tree. */
async function openOn(page: string, name: string) {
  const tree = await opened()
  await user.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
  await user.click(await screen.findByRole("option", { name: page }))
  await user.click(within(tree).getByRole("button", { name }))
  return screen.findByRole("heading", { level: 2, name })
}

/** The draft once the autosave has sent it with `check` holding; its pause is not waited out. */
async function saved(check: (doc: LayoutDocument) => void) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS)
  })
  await waitFor(() => {
    const doc = lastSaved(fetchMock)
    expect(doc).toBeDefined()
    if (doc) check(doc)
  }, SAVED)
}

describe("the product and category pages' section forms", () => {
  beforeEach(() => {
    // The clock still runs (Radix and the queries need it); the tests jump the autosave's pause
    vi.useFakeTimers({ shouldAdvanceTime: true })
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    fetchMock.mockReset()
    serve(fetchMock, admin)
    admin.product.list.mockResolvedValue({ products: PRODUCTS })
    renderEditor()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it(
    "writes FAQ questions and answers, an answer with the shop's details, and orders them",
    HEAVY,
    async () => {
      await openOn("Kategori sayfası", "Sık sorulan sorular")
      expect(screen.getByRole("radio", { name: "Izgaranın üstü" })).toBeChecked()

      await user.click(screen.getByRole("button", { name: "Soru ekle" }))
      expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
        "Soruyu yazın.",
        "Cevabı yazın.",
      ])
      expect(status()).toHaveTextContent("Düzeltilecek alan var")

      await user.type(
        screen.getByRole("textbox", { name: /^2\. sorunun metni/ }),
        "Siparişimi nasıl sorarım?"
      )
      const answer = screen.getByRole("textbox", { name: /^2\. sorunun cevabı/ })
      await user.type(answer, "Bizi arayın: ")
      // The shop's details come from the field's own menu
      const item = answer.closest("li")
      if (!item) throw new Error("No question row")
      await user.click(within(item).getByRole("button", { name: "Bilgi ekle" }))
      await user.click(await screen.findByRole("menuitem", { name: /Telefon/ }))
      expect(answer).toHaveValue("Bizi arayın: {telefon}")
      expect(screen.queryByRole("alert")).toBeNull()

      await user.click(screen.getByRole("button", { name: "2. soru: yukarı taşı" }))
      await saved((doc) => {
        expect(doc.category[0]).toMatchObject({
          id: "kategorisss",
          placement: "top",
          items: [
            { question: "Siparişimi nasıl sorarım?", answer: "Bizi arayın: {telefon}" },
            { question: "Kargo ne zaman çıkar?", answer: "Aynı gün kargoya veririz." },
          ],
        })
      })
      // The last question stays: a FAQ holds at least one
      await user.click(screen.getByRole("button", { name: "2. soru: kaldır" }))
      expect(screen.getByRole("button", { name: "1. soru: kaldır" })).toBeDisabled()
    }
  )

  it("moves a category page's section below the products from its settings", HEAVY, async () => {
    await openOn("Kategori sayfası", "Sık sorulan sorular")

    await user.click(screen.getByRole("radio", { name: "Izgaranın altı" }))
    await saved((doc) => {
      expect(doc.category.map((section) => [section.id, section.placement])).toEqual([
        ["kategorisss", "bottom"],
        ["kategoriyardim", "bottom"],
      ])
    })
  })

  it(
    "switches related products between the product's category and picked products, within 12",
    HEAVY,
    async () => {
      await openOn("Ürün sayfası", "Benzer ürünler")
      expect(screen.getByRole("radio", { name: "Ürünün kendi kategorisinden" })).toBeChecked()
      expect(screen.getByText(/o ürünün kategorisindeki diğer ürünler/)).toBeVisible()

      await user.click(screen.getByRole("radio", { name: "Elle seçtiğim ürünler" }))
      expect(screen.getByRole("alert")).toHaveTextContent("En az bir ürün seçin.")
      expect(screen.getByText("En çok 12 kayıt.")).toBeVisible()
      await user.click(screen.getByRole("button", { name: "Ürün ekle" }))
      const picker = await screen.findByRole("dialog", { name: "Ürün seç" })
      await user.click(await within(picker).findByRole("button", { name: /Ekmek bıçağı/ }))
      await user.click(within(picker).getByRole("button", { name: "Tamam" }))
      expect(screen.queryByRole("alert")).toBeNull()

      const limit = screen.getByRole("spinbutton", { name: "Gösterilecek sayı" })
      await user.clear(limit)
      await user.type(limit, "30")
      await saved((doc) => {
        expect(doc.product[0]).toMatchObject({
          type: "related_products",
          source: { kind: "manual", product_ids: ["prod_bread"] },
          // Held within the server's bounds
          limit: 12,
        })
      })

      await user.click(screen.getByRole("radio", { name: "Bir koleksiyonun ürünleri" }))
      expect(screen.getByRole("alert")).toHaveTextContent("Bir koleksiyon seçin.")
    }
  )
})
