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

describe("the theme editor's pages", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    serve(fetchMock, admin)
    admin.product.list.mockResolvedValue({ products: PRODUCTS })
  })
  afterEach(() => {
    releaseClock()
  })

  it("offers the home, product, category and content pages, never one that is not ready", async () => {
    renderEditor()
    await opened()

    await user.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
    const options = await screen.findAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      "Ana sayfa",
      "Ürün sayfası",
      "Kategori sayfası",
      "İçerik sayfası",
    ])
    expect(screen.queryByText(/yakında/)).toBeNull()
  })

  it("shows a product page's sections and the draft on a live product, whose sample may change", async () => {
    renderEditor()
    const tree = await opened()
    await frame()

    await choosePage("Ürün sayfası")
    const list = within(tree).getByRole("list", { name: "Ürün sayfası" })
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((row) => row.textContent)
    ).toEqual(["Benzer ürünler"])
    expect(within(tree).queryByRole("list", { name: "Ana sayfa" })).toBeNull()
    expect(within(tree).getByText("Ürünün kendi bilgileri")).toBeVisible()
    await waitFor(() => {
      expect(screen.getByTitle("Vitrin önizlemesi")).toHaveAttribute(
        "src",
        "http://localhost:8000/onizleme/sfl_1?sayfa=%2Furun%2Fsef-bicagi-20-cm"
      )
    })
    expect(admin.product.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: ["published"] })
    )

    const sample = screen.getByRole("combobox", { name: "Önizlemedeki örnek ürün" })
    expect(sample).toHaveTextContent("Örnek: Şef bıçağı 20 cm")
    await user.click(sample)
    await user.click(await screen.findByRole("option", { name: /Ekmek bıçağı/ }))
    await waitFor(() => {
      expect(screen.getByTitle("Vitrin önizlemesi")).toHaveAttribute(
        "src",
        "http://localhost:8000/onizleme/sfl_1?sayfa=%2Furun%2Fekmek-bicagi"
      )
    })
  })

  it("adds to a product page only what a product page takes", async () => {
    renderEditor()
    const tree = await opened()
    await choosePage("Ürün sayfası")

    await user.click(within(tree).getByRole("button", { name: "Bölüm ekle" }))
    const chooser = await screen.findByRole("region", { name: "Bölüm ekle" })
    expect(
      within(chooser)
        .getAllByRole("button")
        .map((button) => button.querySelector(".font-medium")?.textContent)
        .filter(Boolean)
    ).toEqual([
      "Benzer ürünler",
      "Metin",
      "Görsel bant",
      "Sık sorulan sorular",
      "Güven rozetleri",
      "Kayan yazı",
      "Yardım kutusu",
      "E-bülten",
    ])
    await user.click(within(chooser).getByRole("button", { name: /Yardım kutusu/ }))

    expect(await screen.findByRole("heading", { name: "Yardım kutusu" })).toBeVisible()
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.product.map((section) => section.type)).toEqual([
        "product_main",
        "related_products",
        "help",
      ])
    })
  })

  it("lists a category page's sections above and below its products, and moves one across", async () => {
    renderEditor()
    const tree = await opened()
    await choosePage("Kategori sayfası")

    // The tree is drawn anew after a section's settings close: looked up each time
    const side = (name: string) =>
      within(screen.getByRole("list", { name }))
        .getAllByRole("listitem")
        .map((row) => row.textContent)
    expect(side("Izgaranın üstü")).toEqual(["Sık sorulan sorular"])
    expect(side("Izgaranın altı")).toEqual(["Yardım kutusu"])
    expect(within(tree).getByText("Ürün ızgarası")).toBeVisible()
    await waitFor(() => {
      expect(screen.getByTitle("Vitrin önizlemesi")).toHaveAttribute(
        "src",
        "http://localhost:8000/onizleme/sfl_1?sayfa=%2Fkategori%2Fmutfak-bicaklari"
      )
    })

    await user.click(
      within(tree).getByRole("button", { name: "Sık sorulan sorular için işlemler" })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Izgaranın altına taşı" }))
    expect(within(tree).queryByRole("list", { name: "Izgaranın üstü" })).toBeNull()
    expect(side("Izgaranın altı")).toEqual(["Sık sorulan sorular", "Yardım kutusu"])
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.category).toMatchObject([
        { id: "maincategory", type: "category_main" },
        { id: "kategorisss", placement: "bottom" },
        { id: "kategoriyardim", placement: "bottom" },
      ])
    })

    // Added above the grid from its own button
    await user.click(within(tree).getByRole("button", { name: "Üste bölüm ekle" }))
    const chooser = await screen.findByRole("region", { name: "Bölüm ekle" })
    expect(chooser).toHaveTextContent("ürün ızgarasının üstüne eklenir")
    expect(within(chooser).queryByRole("button", { name: /Benzer ürünler/ })).toBeNull()
    await user.click(within(chooser).getByRole("button", { name: /E-bülten/ }))
    await user.click(await screen.findByRole("button", { name: "Bölümlere dön" }))
    expect(side("Izgaranın üstü")).toEqual(["E-bülten"])
  })

  it("says what is missing when no product is live to preview on", async () => {
    admin.product.list.mockResolvedValue({ products: [] })
    renderEditor()
    await opened()
    await choosePage("Ürün sayfası")

    expect(await screen.findByText(/Önizleme için yayında bir ürün gerekli/)).toBeInTheDocument()
    expect(screen.queryByTitle("Vitrin önizlemesi")).toBeNull()
  })
})
