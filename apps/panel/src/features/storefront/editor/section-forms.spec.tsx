import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import { lastSaved, opened, renderEditor, serve } from "./theme-editor.fixtures"
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

// Each test types, picks and waits for a save: under a full run's load
// that takes longer than the default 5 s, though the autosave's pause is skipped
const HEAVY = { timeout: 15_000 }
const SAVED = { timeout: 4000 }

let user: UserEvent

/** Opens a section's settings from its row in the tree: the panel's title. */
async function open(name: string) {
  const tree = await opened()
  await user.click(within(tree).getByRole("button", { name }))
  return within(await screen.findByRole("region")).getByRole("heading", { level: 2 })
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

describe("the section forms", () => {
  beforeEach(() => {
    // The clock still runs (Radix and the queries need it); the tests jump the autosave's pause
    vi.useFakeTimers({ shouldAdvanceTime: true })
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    fetchMock.mockReset()
    serve(fetchMock, admin)
    renderEditor()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it(
    "writes the hero's heading and a button picked from the menus' link picker",
    HEAVY,
    async () => {
      expect(await open("Giriş")).toHaveTextContent("Giriş")

      await user.type(screen.getByRole("textbox", { name: "Başlık" }), "Yeni sezon")
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
    }
  )

  it(
    "switches a product list's source, holding the save until its category is chosen",
    HEAVY,
    async () => {
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
    }
  )

  it("schedules a section in local time, refusing an end before its start", HEAVY, async () => {
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

    await user.click(screen.getByRole("button", { name: "Bölümlere dön" }))
    expect(screen.getByRole("button", { name: /Blog yazıları\s*Zamanlanmış/ })).toBeVisible()
  })

  it("asks for a written line in the announcement bar before saving it", HEAVY, async () => {
    await open("Kargo bedava")

    await user.click(screen.getByRole("button", { name: "Duyuru ekle" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Bu satırı yazın ya da kaldırın.")
    await user.type(screen.getByRole("textbox", { name: "2. duyuru" }), "Aynı gün kargo")

    await saved((doc) => {
      expect(doc.header[0]?.lines).toEqual(["Kargo bedava", "Aynı gün kargo"])
    })
  })
})
