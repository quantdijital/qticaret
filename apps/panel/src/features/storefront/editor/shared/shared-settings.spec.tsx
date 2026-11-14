import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import {
  DOC,
  SETTINGS,
  holdClock,
  lastSaved,
  layoutOf,
  opened,
  pass,
  postsTo,
  releaseClock,
  renderEditor,
  serve,
} from "../theme-editor.fixtures"
import type { AdminMock, Init } from "../theme-editor.fixtures"

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

const ALWAYS = { visible: true, starts_at: null, ends_at: null }

let user: UserEvent

const panel = (name: string) => screen.findByRole("region", { name })

/** The fixture's design with a trust strip on the home and the product page. */
const withStrips = () => ({
  ...DOC,
  home: [
    ...DOC.home,
    { id: "guvenserit", type: "trust_badges" as const, variant: "strip" as const, ...ALWAYS },
  ],
  product: [
    ...DOC.product,
    { id: "urunguven", type: "trust_badges" as const, variant: "strip" as const, ...ALWAYS },
  ],
})

/** Opens the home page's trust strip: its form, where the badges are written. */
async function openStrip(tree: HTMLElement) {
  const home = within(within(tree).getByRole("list", { name: "Ana sayfa" }))
  await user.click(home.getByRole("button", { name: "Güven rozetleri" }))
  return panel("Güven rozetleri")
}

/**
 * The theme's shared settings in the editor, drafted with the design
 * (adr/0049 Ek 2026-11-06): the trust badges in every strip's form, the
 * stock line and colour names under Tema.
 */
describe("the theme's shared settings", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    serve(fetchMock, admin)
  })
  afterEach(() => {
    releaseClock()
  })

  it("edits the trust badges in a trust strip section's form, in the draft", async () => {
    serve(fetchMock, admin, layoutOf({ draft: withStrips() }))
    renderEditor()
    const tree = await opened()
    // The badges are a section's, not a theme setting: the home strip's row alone
    expect(within(tree).getAllByRole("button", { name: "Güven rozetleri" })).toHaveLength(1)

    const badges = within(await openStrip(tree))
    expect(
      badges.getByText(
        "Bu rozetler sitenin her yerinde aynı görünür: ürün sayfası, sepet, kargo sayfası."
      )
    ).toBeVisible()
    const title = badges.getByRole("textbox", { name: "1. rozetin başlığı" })
    expect(title).toHaveValue("Aynı gün kargo")
    await user.type(title, " bugün")
    await user.type(
      badges.getByRole("textbox", { name: "1. rozetin açıklaması (isteğe bağlı)" }),
      "14.00'e kadar"
    )
    await user.click(badges.getByRole("button", { name: "Rozet ekle" }))
    await user.type(badges.getByRole("textbox", { name: "2. rozetin başlığı" }), "Kolay iade")

    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.settings.trust_badges).toEqual([
        { icon: "truck", title: "Aynı gün kargo bugün", text: "14.00'e kadar" },
        // The next icon no badge has yet
        { icon: "clock", title: "Kolay iade", text: null },
      ])
    })
    expect(lastSaved(fetchMock)).toMatchObject({ product: withStrips().product })
    expect(postsTo(fetchMock, SETTINGS)).toEqual([])
  })

  it("undoes a badge's title as one step, as a section's field", async () => {
    serve(fetchMock, admin, layoutOf({ draft: withStrips() }))
    renderEditor()
    const tree = await opened()

    const badges = within(await openStrip(tree))
    const title = badges.getByRole("textbox", { name: "1. rozetin başlığı" })
    await user.type(title, " bugün")
    expect(title).toHaveValue("Aynı gün kargo bugün")
    await user.click(screen.getByRole("button", { name: "Geri al" }))
    expect(title).toHaveValue("Aynı gün kargo")
  })

  it("holds a badge the server would refuse and marks every strip's row", async () => {
    serve(fetchMock, admin, layoutOf({ draft: withStrips() }))
    renderEditor()
    const tree = await opened()

    const badges = within(await openStrip(tree))
    // `{{` is user-event's way to type a brace
    await user.type(badges.getByRole("textbox", { name: "1. rozetin başlığı" }), " {{kargo}")

    expect(await badges.findByRole("alert")).toHaveTextContent(
      "Süslü parantez içinde tanınmayan bir bilgi var"
    )
    const marked = "Güven rozetleriDüzeltilecek alan var"
    const home = within(within(tree).getByRole("list", { name: "Ana sayfa" }))
    expect(home.getByRole("button", { name: marked })).toBeVisible()
    // The product page's strip shows the same list, so the same mark
    await user.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
    await user.click(await screen.findByRole("option", { name: "Ürün sayfası" }))
    const product = within(within(tree).getByRole("list", { name: "Ürün sayfası" }))
    expect(product.getByRole("button", { name: marked })).toBeVisible()
    // However long it waits
    await pass(10 * AUTOSAVE_MS)
    expect(postsTo(fetchMock)).toEqual([])
  })

  it("turns 'Az kaldı' off and keeps the colour names one each", async () => {
    renderEditor()
    const tree = await opened()
    const theme = within(tree)

    await user.click(theme.getByRole("button", { name: "Stok ve renk örnekleri" }))
    const looks = within(await panel("Stok ve renk örnekleri"))
    expect(looks.getByRole("spinbutton", { name: "Kaç adet ve altında" })).toHaveValue(3)
    expect(looks.getByRole("textbox", { name: "1. rengin adı" })).toHaveValue("Siyah")

    await user.click(looks.getByRole("button", { name: "Renk ekle" }))
    await user.type(looks.getByRole("textbox", { name: "2. rengin adı" }), "SİYAH")
    expect(await looks.findByText("Bu renk adı listede zaten var.")).toBeVisible()
    await user.clear(looks.getByRole("textbox", { name: "2. rengin adı" }))
    await user.type(looks.getByRole("textbox", { name: "2. rengin adı" }), "Lacivert")
    const code = looks.getByRole("textbox", { name: "2. rengin kodu" })
    await user.clear(code)
    await user.type(code, "#1E3A8A")
    await user.click(looks.getByRole("switch", { name: /Az kaldı/ }))
    expect(looks.queryByRole("spinbutton", { name: "Kaç adet ve altında" })).toBeNull()

    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.settings).toEqual({
        trust_badges: DOC.settings.trust_badges,
        color_swatches: [...DOC.settings.color_swatches, { label: "Lacivert", hex: "#1e3a8a" }],
        // The threshold is kept for when it is turned on again
        low_stock: { enabled: false, threshold: 3 },
        // The theme's settings and the menus are left as they were (adr/0063 §3)
        theme: DOC.settings.theme,
        menus: null,
      })
    })
  })

  it("opens the one list from the product page's buy box, without a strip there", async () => {
    renderEditor()
    await opened()
    await user.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
    await user.click(await screen.findByRole("option", { name: "Ürün sayfası" }))

    expect(
      screen.getByText(
        "Satın alma kutusunun altındaki rozetler, Güven rozetleri bileşeninden düzenlenir."
      )
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Rozetleri düzenle" }))
    const dialog = within(await screen.findByRole("dialog", { name: "Güven rozetleri" }))
    await user.type(dialog.getByRole("textbox", { name: "1. rozetin başlığı" }), " bugün")
    await user.click(dialog.getByRole("button", { name: "Tamam" }))

    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.settings.trust_badges).toEqual([
        { icon: "truck", title: "Aynı gün kargo bugün", text: null },
      ])
    })
  })
})
