import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument } from "@/features/storefront/api/layout"
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
import { openGroup, openTab } from "./settings-groups.fixtures"

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

const status = () => screen.getByRole("status", { name: "Taslağın durumu" })

// Each test types and picks through the whole editor, which draws itself anew
// on every key: CPU work a full run's load can stretch past the default 5 s.
// Nothing waits on the wall clock (holdClock), so this bounds work, not waiting
const HEAVY = { timeout: 15_000 }

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
  await pass(AUTOSAVE_MS)
  await waitFor(() => {
    const doc = lastSaved(fetchMock)
    expect(doc).toBeDefined()
    if (doc) check(doc)
  })
}

describe("the product and category pages' section forms", HEAVY, () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    serve(fetchMock, admin)
    admin.product.list.mockResolvedValue({ products: PRODUCTS })
    renderEditor()
  })
  afterEach(() => {
    releaseClock()
  })

  it("writes FAQ questions and answers, an answer with the shop's details, and orders them", async () => {
    await openOn("Kategori sayfası", "Sık sorulan sorular")
    // Where it stands is under "Stil", its questions under "İçerik"
    await openGroup(user, "Yeri")
    expect(screen.getByRole("radio", { name: "Izgaranın üstü" })).toBeChecked()
    await openTab(user, "content")

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
      expect(doc.category[1]).toMatchObject({
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
  })

  it("moves a category page's section below the products from its settings", async () => {
    await openOn("Kategori sayfası", "Sık sorulan sorular")

    await openGroup(user, "Yeri")
    await user.click(screen.getByRole("radio", { name: "Izgaranın altı" }))
    await saved((doc) => {
      // The grid (the main section) stays first, in no place
      expect(
        doc.category.map((section) => [
          section.id,
          "placement" in section ? section.placement : null,
        ])
      ).toEqual([
        ["maincategory", null],
        ["kategorisss", "bottom"],
        ["kategoriyardim", "bottom"],
      ])
    })
  })

  it("switches related products between the product's category and picked products, within 12", async () => {
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
      expect(doc.product[1]).toMatchObject({
        type: "related_products",
        source: { kind: "manual", product_ids: ["prod_bread"] },
        // Held within the server's bounds
        limit: 12,
      })
    })

    await user.click(screen.getByRole("radio", { name: "Bir koleksiyonun ürünleri" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Bir koleksiyon seçin.")
  })

  it("stands related products' cards in a row in Stil › Diziliş, as a product rail's (denetim 1.15)", async () => {
    await openOn("Ürün sayfası", "Benzer ürünler")
    const content = screen.getByRole("group", { name: "İçerik" })
    expect(within(content).queryByRole("radiogroup", { name: /Satırda ürün/ })).toBeNull()
    await openTab(user, "advanced")
    expect(screen.getByRole("button", { name: "Boşluk" })).toHaveAttribute("aria-expanded", "false")
    await openTab(user, "style")
    expect(screen.getByRole("button", { name: "Diziliş" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    const layout = await openGroup(user, "Diziliş")
    expect(within(layout).getByRole("button", { name: "Diziliş" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )

    const columns = within(layout).getByRole("radiogroup", { name: "Satırda ürün columns" })
    await user.click(within(columns).getByRole("radio", { name: "Satırda 5 ürün" }))
    await saved((doc) => {
      expect(doc.product[1]).toMatchObject({ type: "related_products", columns: 5 })
    })
  })
})
