import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument } from "@/features/storefront/api/layout"
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

const SAVED = { timeout: 4000 }
const status = () => screen.getByRole("status", { name: "Taslağın durumu" })

/** Opens a page's section from its row in the tree. */
async function openOn(page: string, name: string) {
  const tree = await opened()
  await userEvent.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
  await userEvent.click(await screen.findByRole("option", { name: page }))
  await userEvent.click(within(tree).getByRole("button", { name }))
  return screen.findByRole("heading", { level: 2, name })
}

async function saved(check: (doc: LayoutDocument) => void) {
  await waitFor(() => {
    const doc = lastSaved(fetchMock)
    expect(doc).toBeDefined()
    if (doc) check(doc)
  }, SAVED)
}

describe("the product and category pages' section forms", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve(fetchMock, admin)
    admin.product.list.mockResolvedValue({ products: PRODUCTS })
    renderEditor()
  })

  it("writes FAQ questions and answers, an answer with the shop's details, and orders them", async () => {
    await openOn("Kategori sayfası", "Sık sorulan sorular")
    expect(screen.getByRole("radio", { name: "Izgaranın üstü" })).toBeChecked()

    await userEvent.click(screen.getByRole("button", { name: "Soru ekle" }))
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
      "Soruyu yazın.",
      "Cevabı yazın.",
    ])
    expect(status()).toHaveTextContent("Düzeltilecek alan var")

    await userEvent.type(
      screen.getByRole("textbox", { name: /^2\. sorunun metni/ }),
      "Siparişimi nasıl sorarım?"
    )
    const answer = screen.getByRole("textbox", { name: /^2\. sorunun cevabı/ })
    await userEvent.type(answer, "Bizi arayın: ")
    // The shop's details come from the field's own menu
    const item = answer.closest("li")
    if (!item) throw new Error("No question row")
    await userEvent.click(within(item).getByRole("button", { name: "Bilgi ekle" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /Telefon/ }))
    expect(answer).toHaveValue("Bizi arayın: {telefon}")
    expect(screen.queryByRole("alert")).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "2. soru: yukarı taşı" }))
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
    await userEvent.click(screen.getByRole("button", { name: "2. soru: kaldır" }))
    expect(screen.getByRole("button", { name: "1. soru: kaldır" })).toBeDisabled()
  })

  it("moves a category page's section below the products from its settings", async () => {
    await openOn("Kategori sayfası", "Sık sorulan sorular")

    await userEvent.click(screen.getByRole("radio", { name: "Izgaranın altı" }))
    await saved((doc) => {
      expect(doc.category.map((section) => [section.id, section.placement])).toEqual([
        ["kategorisss", "bottom"],
        ["kategoriyardim", "bottom"],
      ])
    })
  })

  it("switches related products between the product's category and picked products, within 12", async () => {
    await openOn("Ürün sayfası", "Benzer ürünler")
    expect(screen.getByRole("radio", { name: "Ürünün kendi kategorisinden" })).toBeChecked()
    expect(screen.getByText(/o ürünün kategorisindeki diğer ürünler/)).toBeVisible()

    await userEvent.click(screen.getByRole("radio", { name: "Elle seçtiğim ürünler" }))
    expect(screen.getByRole("alert")).toHaveTextContent("En az bir ürün seçin.")
    expect(screen.getByText("En çok 12 kayıt.")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Ürün ekle" }))
    const picker = await screen.findByRole("dialog", { name: "Ürün seç" })
    await userEvent.click(await within(picker).findByRole("button", { name: /Ekmek bıçağı/ }))
    await userEvent.click(within(picker).getByRole("button", { name: "Tamam" }))
    expect(screen.queryByRole("alert")).toBeNull()

    const limit = screen.getByRole("spinbutton", { name: "Gösterilecek sayı" })
    await userEvent.clear(limit)
    await userEvent.type(limit, "30")
    await saved((doc) => {
      expect(doc.product[0]).toMatchObject({
        type: "related_products",
        source: { kind: "manual", product_ids: ["prod_bread"] },
        // Held within the server's bounds
        limit: 12,
      })
    })

    await userEvent.click(screen.getByRole("radio", { name: "Bir koleksiyonun ürünleri" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Bir koleksiyon seçin.")
  })
})
