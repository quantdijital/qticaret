import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { SETTINGS, lastSaved, opened, postsTo, renderEditor, serve } from "./theme-editor.fixtures"
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

// The autosave waits 1.5 s after the last change
const SAVED = { timeout: 4000 }

/** Opens a section's settings from its row in the tree. */
async function open(name: string) {
  const tree = await opened()
  await userEvent.click(within(tree).getByRole("button", { name }))
  return screen.findByRole("heading", { level: 2 })
}

/** The draft once the autosave has sent it with `check` holding. */
async function saved(check: (doc: LayoutDocument) => void) {
  await waitFor(() => {
    const doc = lastSaved(fetchMock)
    expect(doc).toBeDefined()
    if (doc) check(doc)
  }, SAVED)
}

describe("the section forms", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve(fetchMock, admin)
    renderEditor()
  })

  it("writes the hero's heading and a button picked from the menus' link picker", async () => {
    expect(await open("Giriş")).toHaveTextContent("Giriş")

    await userEvent.type(screen.getByRole("textbox", { name: "Başlık" }), "Yeni sezon")
    await userEvent.click(screen.getByRole("button", { name: "Düğme ekle" }))
    const picker = await screen.findByRole("dialog", { name: "Bağlantı ekle" })
    await userEvent.click(within(picker).getByRole("tab", { name: "Mağaza sayfası" }))
    await userEvent.click(await within(picker).findByRole("button", { name: /Tüm ürünler/ }))
    expect(screen.queryByRole("dialog")).toBeNull()

    const label = screen.getByRole("textbox", {
      name: "Tüm ürünler bağlantısının görünen yazısı",
    })
    expect(label).toHaveAttribute("placeholder", "Tüm ürünler")
    await userEvent.type(label, "Alışverişe başla")

    await saved((doc) => {
      expect(doc.home[0]).toMatchObject({
        heading: "Yeni sezon",
        eyebrow: null,
        text: null,
        links: [{ kind: "system", target: "shop", label: "Alışverişe başla" }],
      })
    })
    // The letters typed in a field undo as one step
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }))
    expect(label).toHaveValue("")
    expect(screen.getByRole("textbox", { name: "Başlık" })).toHaveValue("Yeni sezon")
  })

  it("switches a product list's source, holding the save until its category is chosen", async () => {
    await open("Ürün listesi")

    await userEvent.click(screen.getByRole("radio", { name: "Bir kategorinin ürünleri" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Bir kategori seçin.")
    expect(screen.getByRole("status", { name: "Taslağın durumu" })).toHaveTextContent(
      "Düzeltilecek alan var"
    )

    await userEvent.click(screen.getByRole("button", { name: "Kategori seç" }))
    const picker = await screen.findByRole("dialog", { name: "Kategori seç" })
    await userEvent.click(
      await within(picker).findByRole("button", { name: /Şef bıçakları\s*Mutfak bıçakları/ })
    )
    expect(await screen.findByText("Şef bıçakları")).toBeVisible()
    expect(screen.queryByRole("alert")).toBeNull()

    await userEvent.clear(screen.getByRole("spinbutton", { name: "Gösterilecek sayı" }))
    await userEvent.type(screen.getByRole("spinbutton", { name: "Gösterilecek sayı" }), "40")
    await saved((doc) => {
      expect(doc.home[1]).toMatchObject({
        source: { kind: "category", category_id: "pcat_chefs" },
        // Held within the server's bounds
        limit: 24,
      })
    })

    await userEvent.click(screen.getByRole("radio", { name: "Elle seçtiğim ürünler" }))
    expect(screen.getByRole("alert")).toHaveTextContent("En az bir ürün seçin.")
  })

  it("schedules a section in local time, refusing an end before its start", async () => {
    await open("Blog yazıları")
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

    await userEvent.click(screen.getByRole("button", { name: "Bölümlere dön" }))
    expect(screen.getByRole("button", { name: /Blog yazıları\s*Zamanlanmış/ })).toBeVisible()
  })

  it("asks for a written line in the announcement bar before saving it", async () => {
    await open("Kargo bedava")

    await userEvent.click(screen.getByRole("button", { name: "Duyuru ekle" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Bu satırı yazın ya da kaldırın.")
    await userEvent.type(screen.getByRole("textbox", { name: "2. duyuru" }), "Aynı gün kargo")

    await saved((doc) => {
      expect(doc.header[0]?.lines).toEqual(["Kargo bedava", "Aynı gün kargo"])
    })
  })

  it("saves the main colour at once, outside the draft, in lower case", async () => {
    const tree = await opened()
    await userEvent.click(within(tree).getByRole("button", { name: "Tema ayarları" }))
    const code = await screen.findByRole("textbox", { name: "Renk kodu" })
    expect(screen.getByRole("button", { name: "Temanın rengine dön" })).toBeDisabled()

    await userEvent.type(code, "#0B5C9")
    expect(screen.getByRole("alert")).toHaveTextContent("# ile başlayan 6 haneli bir kod")
    expect(screen.getByRole("button", { name: "Rengi kaydet" })).toBeDisabled()
    await userEvent.type(code, "9")
    await userEvent.click(screen.getByRole("button", { name: "Rengi kaydet" }))

    await waitFor(() => {
      expect(postsTo(fetchMock, SETTINGS)).toEqual([
        [SETTINGS, expect.objectContaining({ method: "POST", body: { primary_color: "#0b5c99" } })],
      ])
    })
    expect(postsTo(fetchMock)).toEqual([])
  })
})
