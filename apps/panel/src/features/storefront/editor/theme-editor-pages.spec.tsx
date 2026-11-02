import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
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
const frame = () => screen.findByTitle("Vitrin önizlemesi")

/** Picks a page in the bar's page selector. */
async function choosePage(name: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
  await userEvent.click(await screen.findByRole("option", { name }))
}

describe("the theme editor's pages", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve(fetchMock, admin)
    admin.product.list.mockResolvedValue({ products: PRODUCTS })
  })

  it("offers the home, product and category pages, never one that is not ready", async () => {
    renderEditor()
    await opened()

    await userEvent.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
    const options = await screen.findAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      "Ana sayfa",
      "Ürün sayfası",
      "Kategori sayfası",
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
    await waitFor(async () => {
      expect(await frame()).toHaveAttribute(
        "src",
        "http://localhost:8000/onizleme/sfl_1?sayfa=%2Furun%2Fsef-bicagi-20-cm"
      )
    })
    expect(admin.product.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: ["published"] })
    )

    const sample = screen.getByRole("combobox", { name: "Önizlemedeki örnek ürün" })
    expect(sample).toHaveTextContent("Örnek: Şef bıçağı 20 cm")
    await userEvent.click(sample)
    await userEvent.click(await screen.findByRole("option", { name: /Ekmek bıçağı/ }))
    await waitFor(async () => {
      expect(await frame()).toHaveAttribute(
        "src",
        "http://localhost:8000/onizleme/sfl_1?sayfa=%2Furun%2Fekmek-bicagi"
      )
    })
  })

  it("adds to a product page only what a product page takes", async () => {
    renderEditor()
    const tree = await opened()
    await choosePage("Ürün sayfası")

    await userEvent.click(within(tree).getByRole("button", { name: "Bölüm ekle" }))
    const chooser = await screen.findByRole("dialog", { name: "Bölüm ekle" })
    expect(
      within(chooser)
        .getAllByRole("button")
        .map((button) => button.querySelector(".font-medium")?.textContent)
        .filter(Boolean)
    ).toEqual([
      "Benzer ürünler",
      "Metin",
      "Görsel slayt",
      "Sık sorulan sorular",
      "Güven rozetleri",
      "Yardım kutusu",
      "E-bülten",
    ])
    await userEvent.click(within(chooser).getByRole("button", { name: /Yardım kutusu/ }))

    expect(await screen.findByRole("heading", { name: "Yardım kutusu" })).toBeVisible()
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.product.map((section) => section.type)).toEqual([
        "related_products",
        "help",
      ])
    }, SAVED)
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
    await waitFor(async () => {
      expect(await frame()).toHaveAttribute(
        "src",
        "http://localhost:8000/onizleme/sfl_1?sayfa=%2Fkategori%2Fmutfak-bicaklari"
      )
    })

    await userEvent.click(
      within(tree).getByRole("button", { name: "Sık sorulan sorular için işlemler" })
    )
    await userEvent.click(await screen.findByRole("menuitem", { name: "Izgaranın altına taşı" }))
    expect(within(tree).queryByRole("list", { name: "Izgaranın üstü" })).toBeNull()
    expect(side("Izgaranın altı")).toEqual(["Sık sorulan sorular", "Yardım kutusu"])
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.category).toMatchObject([
        { id: "kategorisss", placement: "bottom" },
        { id: "kategoriyardim", placement: "bottom" },
      ])
    }, SAVED)

    // Added above the grid from its own button
    await userEvent.click(within(tree).getByRole("button", { name: "Üste bölüm ekle" }))
    const chooser = await screen.findByRole("dialog", { name: "Bölüm ekle" })
    expect(chooser).toHaveTextContent("ürün ızgarasının üstüne eklenir")
    expect(within(chooser).queryByRole("button", { name: /Benzer ürünler/ })).toBeNull()
    await userEvent.click(within(chooser).getByRole("button", { name: /E-bülten/ }))
    await userEvent.click(await screen.findByRole("button", { name: "Bölümlere dön" }))
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
