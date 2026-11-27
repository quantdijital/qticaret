import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { CONTENT_PAGE_SECTION_TYPES } from "@qticaret/types"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { PAGE_TYPES } from "@/features/storefront/layout/sections"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import { AddSectionDialog } from "./add-section-dialog"
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

// Each test types and picks through the whole editor, which draws itself anew
// on every key: CPU work a full run's load can stretch past the default 5 s.
// Nothing waits on the wall clock (holdClock), so this bounds work, not waiting
const HEAVY = { timeout: 15_000 }

let user: UserEvent

/** Opens a section's settings from its row in the tree: the panel's title. */
async function open(name: string) {
  const tree = await opened()
  await user.click(within(tree).getByRole("button", { name }))
  return within(await screen.findByRole("region")).getByRole("heading", { level: 2 })
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

describe("the section forms", HEAVY, () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    serve(fetchMock, admin)
    renderEditor()
  })
  afterEach(() => {
    releaseClock()
  })

  it("writes the hero's heading and a button picked from the menus' link picker", async () => {
    expect(await open("Giriş")).toHaveTextContent("Giriş")

    await user.type(screen.getByRole("textbox", { name: "Başlık" }), "Yeni sezon")
    // The buttons stand in their own group, closed under "İçerik"
    await openGroup(user, "Düğmeler")
    await user.click(screen.getByRole("button", { name: "Düğme ekle" }))
    const picker = await screen.findByRole("dialog", { name: "Bağlantı ekle" })
    await user.click(within(picker).getByRole("tab", { name: "Mağaza sayfası" }))
    await user.click(await within(picker).findByRole("button", { name: /Tüm ürünler/ }))
    expect(screen.queryByRole("dialog")).toBeNull()

    const label = screen.getByRole("textbox", {
      name: "Tüm ürünler bağlantısının görünen yazısı",
    })
    expect(label).toHaveAttribute("placeholder", "Tüm ürünler")
    await user.type(label, "Alışverişe başla")

    await saved((doc) => {
      expect(doc.home[0]).toMatchObject({
        heading: "Yeni sezon",
        eyebrow: null,
        text: null,
        links: [{ kind: "system", target: "shop", label: "Alışverişe başla" }],
      })
    })
    // The letters typed in a field undo as one step
    await user.click(screen.getByRole("button", { name: "Geri al" }))
    expect(label).toHaveValue("")
    expect(screen.getByRole("textbox", { name: "Başlık" })).toHaveValue("Yeni sezon")
  })

  it("switches a product list's source, holding the save until its category is chosen", async () => {
    await open("Ürün listesi")

    await user.click(screen.getByRole("radio", { name: "Bir kategorinin ürünleri" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Bir kategori seçin.")
    expect(screen.getByRole("status", { name: "Taslağın durumu" })).toHaveTextContent(
      "Düzeltilecek alan var"
    )

    await user.click(screen.getByRole("button", { name: "Kategori seç" }))
    const picker = await screen.findByRole("dialog", { name: "Kategori seç" })
    await user.click(
      await within(picker).findByRole("button", { name: /Şef bıçakları\s*Mutfak bıçakları/ })
    )
    expect(await screen.findByText("Şef bıçakları")).toBeVisible()
    expect(screen.queryByRole("alert")).toBeNull()

    await user.clear(screen.getByRole("spinbutton", { name: "Gösterilecek sayı" }))
    await user.type(screen.getByRole("spinbutton", { name: "Gösterilecek sayı" }), "40")
    await saved((doc) => {
      expect(doc.home[1]).toMatchObject({
        source: { kind: "category", category_id: "pcat_chefs" },
        // Held within the server's bounds
        limit: 24,
      })
    })

    await user.click(screen.getByRole("radio", { name: "Elle seçtiğim ürünler" }))
    expect(screen.getByRole("alert")).toHaveTextContent("En az bir ürün seçin.")
  })

  it("picks the best sellers over a window of days, then what is on sale, naming the list after each", async () => {
    await open("Ürün listesi")
    const title = screen.getByRole("textbox", { name: "Başlık" })

    await user.click(screen.getByRole("radio", { name: "Çok satanlar" }))
    expect(title).toHaveValue("Çok satanlar")
    const days = screen.getByRole("spinbutton", { name: "Kaç günün satışı" })
    expect(days).toHaveValue(90)
    expect(screen.getByText(/en yeni ürünlerle tamamlanır/)).toBeVisible()

    // On the way to "30": too few days hold the save until it is
    fireEvent.change(days, { target: { value: "3" } })
    expect(screen.getByRole("alert")).toHaveTextContent("En az 7, en çok 365 gün yazın.")
    fireEvent.change(days, { target: { value: "30" } })
    expect(screen.queryByRole("alert")).toBeNull()
    await saved((doc) => {
      expect(doc.home[1]).toMatchObject({
        title: "Çok satanlar",
        source: { kind: "best_sellers", days: 30 },
      })
    })
    // Left too few, the field takes the least
    fireEvent.change(days, { target: { value: "2" } })
    fireEvent.blur(days)
    expect(days).toHaveValue(7)

    // The list's name follows its source while the shop has not written its own
    await user.click(screen.getByRole("radio", { name: "İndirimde" }))
    expect(title).toHaveValue("İndirimde")
    expect(screen.queryByRole("spinbutton", { name: "Kaç günün satışı" })).toBeNull()
    expect(screen.getByText(/indirimi en büyük olan önce/)).toBeVisible()
    await saved((doc) => {
      expect(doc.home[1]).toMatchObject({ title: "İndirimde", source: { kind: "on_sale" } })
    })
  })

  it("lays a product list five across, saying what narrower screens show and a count that falls short", async () => {
    await open("Ürün listesi")
    await openGroup(user, "Diziliş")
    const three = screen.getByRole("radio", { name: "Satırda 3 ürün" })
    expect(three).toBeChecked()
    expect(screen.getByText(/yan yana 3 ürün, iki sıra \(6 ürün\)/)).toBeVisible()

    await user.click(screen.getByRole("radio", { name: "Satırda 5 ürün" }))
    expect(screen.getByRole("radio", { name: "Satırda 5 ürün" })).toBeChecked()
    expect(three).not.toBeChecked()
    expect(screen.getByText(/yan yana 5 ürün, iki sıra \(10 ürün\)/)).toBeVisible()
    // Twelve fill two rows of five: nothing to suggest
    expect(screen.queryByText(/yalnız dolu sıraları/)).toBeNull()

    // The count is the list's content, its hint stands by the columns
    await openTab(user, "content")
    fireEvent.change(screen.getByRole("spinbutton", { name: "Gösterilecek sayı" }), {
      target: { value: "8" },
    })
    await openTab(user, "style")
    expect(screen.getByText(/sayıyı en az 10 yapın/)).toBeVisible()
    await saved((doc) => {
      expect(doc.home[1]).toMatchObject({ type: "products", columns: 5, limit: 8 })
    })
  })

  it("frames a product list's cards over the theme's style, and gives it back (adr/0049 Ek 2026-11-14 §3.3)", async () => {
    await open("Ürün listesi")
    await openGroup(user, "Diziliş")
    const field = screen.getByRole("combobox", { name: "Kart biçimi" })
    expect(field).toHaveTextContent("Temadaki biçim")

    await user.click(field)
    await user.click(await screen.findByRole("option", { name: "Çerçeveli" }))
    await saved((doc) => {
      expect(doc.home[1]).toMatchObject({ type: "products", card_variant: "framed" })
    })

    await user.click(field)
    await user.click(await screen.findByRole("option", { name: "Temadaki biçim" }))
    await saved((doc) => {
      expect(doc.home[1]).toMatchObject({ type: "products", card_variant: null })
    })
  })

  it("schedules a section in local time, refusing an end before its start", async () => {
    await open("Blog yazıları")
    await openGroup(user, "Görünürlük")
    const starts = screen.getByLabelText("Başlangıç")
    const ends = screen.getByLabelText("Bitiş")

    fireEvent.change(starts, { target: { value: "2026-11-20T09:00" } })
    fireEvent.change(ends, { target: { value: "2026-11-19T09:00" } })
    expect(screen.getByRole("alert")).toHaveTextContent("Bitiş, başlangıçtan sonra olmalı.")
    expect(ends).toHaveAttribute("aria-invalid", "true")

    fireEvent.change(ends, { target: { value: "2026-11-30T18:30" } })
    expect(screen.queryByRole("alert")).toBeNull()
    await saved((doc) => {
      expect(doc.home[2]).toMatchObject({
        starts_at: new Date(2026, 10, 20, 9, 0).toISOString(),
        ends_at: new Date(2026, 10, 30, 18, 30).toISOString(),
      })
    })

    await user.click(screen.getByRole("button", { name: "Bölümlere dön" }))
    expect(screen.getByRole("button", { name: /Blog yazıları\s*Zamanlanmış/ })).toBeVisible()
  })

  it("features one product picked in its form, holding the save until it is (adr/0046 Ek 2026-11-05)", async () => {
    admin.product.list.mockResolvedValue({ products: PRODUCTS })
    await opened()
    await user.click(screen.getByRole("button", { name: "Bölüm ekle" }))
    const chooser = await screen.findByRole("dialog", { name: "Bölüm ekle" })
    await user.click(within(chooser).getByRole("button", { name: /Öne çıkan ürün/ }))

    expect(await screen.findByRole("heading", { name: "Öne çıkan ürün" })).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent("Bir ürün seçin.")
    expect(screen.getByText(/ürünün kendi sayfasından gelir/)).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Ürün seç" }))
    const picker = await screen.findByRole("dialog", { name: "Ürün seç" })
    await user.click(await within(picker).findByRole("button", { name: /Şef bıçağı 20 cm/ }))
    if (screen.queryByRole("dialog", { name: "Ürün seç" })) {
      await user.click(within(picker).getByRole("button", { name: "Tamam" }))
    }
    expect(screen.queryByRole("alert")).toBeNull()
    await user.type(screen.getByRole("textbox", { name: "Başlık" }), "Yakından")

    await saved((doc) => {
      expect(doc.home.at(-1)).toMatchObject({
        type: "featured_product",
        title: "Yakından",
        text: null,
        product_id: "prod_chef",
      })
    })
  })

  it("asks for a written line in the announcement bar before saving it", async () => {
    await open("Koyu şerit")

    await user.click(screen.getByRole("button", { name: "Duyuru ekle" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Bu satırı yazın ya da kaldırın.")
    await user.type(screen.getByRole("textbox", { name: "2. duyuru" }), "Aynı gün kargo")

    await saved((doc) => {
      const [bar] = doc.header
      expect(bar?.type === "announcement_bar" ? bar.lines : null).toEqual([
        "Kargo bedava",
        "Aynı gün kargo",
      ])
    })
  })
})

describe("a content page's section chooser (adr/0073 §3, Ek 2026-11-19 (2) K5)", () => {
  it("offers the page's text first, the home page's types but its opening and price bands, then the page's own", () => {
    const pick = vi.fn()
    render(
      <AddSectionDialog
        open
        page="pages"
        placement="bottom"
        taken={new Set(["contact"])}
        marqueeFull={false}
        onOpenChange={vi.fn()}
        onPick={pick}
      />
    )
    const chooser = screen.getByRole("dialog", { name: "Bölüm ekle" })
    expect(chooser).toHaveTextContent("Bu sayfaya, bölümlerin sonuna eklenir")
    expect(
      within(chooser)
        .getAllByRole("button")
        .map((button) => button.querySelector(".font-medium")?.textContent)
        .filter(Boolean)
    ).toEqual([
      "Sayfa metni",
      "Görsel bant",
      "Çapraz şeritler",
      "Kategoriler",
      "Ürün listesi",
      "Öne çıkan ürün",
      "Markalar",
      "Blog yazıları",
      "Müşteri yorumları",
      "Metin",
      "Sık sorulan sorular",
      "Rakam şeridi",
      "Numaralı adımlar",
      "Arama kutusu",
      "Fotoğraf kolajı",
      "Güven rozetleri",
      "Kayan yazı",
      "E-bülten",
      "Yardım kutusu",
      "İletişim",
      "Ödeme seçenekleri",
      "Kargo bilgileri",
    ])
    expect([...PAGE_TYPES].sort()).toEqual([...CONTENT_PAGE_SECTION_TYPES].sort())
    // The contact section stands once on a page: taken, it is not offered again
    const contact = within(chooser).getByRole("button", { name: /^İletişim/ })
    expect(contact).toBeDisabled()
    expect(contact).toHaveTextContent("Bu sayfada zaten var.")
    expect(within(chooser).getByRole("button", { name: /^Kargo bilgileri/ })).toBeEnabled()
  })
})
