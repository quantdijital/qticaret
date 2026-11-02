import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import {
  DOC,
  lastSaved,
  layoutOf,
  opened,
  postsTo,
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
const router = vi.hoisted(() => ({ back: vi.fn(), navigate: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Leaving goes back where the editor was opened from; the guard is the router's
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useRouter: () => ({ history: { back: router.back } }),
  useCanGoBack: () => true,
  useNavigate: () => router.navigate,
  useBlocker: () => ({ status: "idle" }),
}))

const PATH = "/admin/storefront-layout"
const frame = () => screen.findByTitle("Vitrin önizlemesi")
const status = () => screen.getByRole("status", { name: "Taslağın durumu" })

describe("ThemeEditor", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    router.back.mockReset()
    vi.mocked(toast.success).mockReset()
    serve(fetchMock, admin)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows the page's parts top to bottom and the saved draft in the preview", async () => {
    renderEditor()
    const tree = await opened()

    expect(screen.getByRole("heading", { level: 1, name: "Tema düzenleyici" })).toBeVisible()
    const home = within(within(tree).getByRole("list", { name: "Ana sayfa" }))
    expect(home.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "Giriş",
      "Ürün listesi",
      "Blog yazıları",
    ])
    expect(within(tree).getByRole("button", { name: "Kargo bedava" })).toBeInTheDocument()
    expect(within(tree).getAllByRole("link", { name: "Mağaza profili" })).toHaveLength(2)
    expect(await frame()).toHaveAttribute(
      "src",
      expect.stringMatching(/^http:\/\/localhost:8000\/onizleme\/sfl_1$/)
    )
    // Nothing changed: nothing saved, nothing to publish or throw away
    expect(postsTo(fetchMock)).toEqual([])
    expect(screen.getByRole("button", { name: "Yayınla" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Değişiklikleri at" })).toBeNull()
    expect(status()).toHaveTextContent("Taslak kayıtlı")
  })

  it("saves the default design at once on first open, so the preview has a draft", async () => {
    serve(fetchMock, admin, layoutOf({ is_default: true, revision: 0, revisions: [] }))
    renderEditor()

    await waitFor(() => {
      expect(lastSaved(fetchMock)).toEqual(DOC)
    })
    expect(await frame()).toHaveAttribute("src", expect.stringContaining("/onizleme/sfl_1"))
    const calls = fetchMock.mock.calls.map(([url]) => url)
    expect(calls.indexOf(PATH, 1)).toBeLessThan(calls.indexOf(`${PATH}/preview`))
  })

  it("saves a change once nothing changed for a moment, the whole draft, then reloads the preview", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderEditor()
    await opened()
    await frame()

    await user.click(screen.getByRole("button", { name: "Blog yazıları bölümünü gizle" }))
    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    expect(status()).toHaveTextContent("Kaydediliyor…")
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(postsTo(fetchMock)).toEqual([])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })
    await waitFor(() => {
      expect(postsTo(fetchMock)).toHaveLength(1)
    })
    const [hero, products, posts] = DOC.home
    expect(lastSaved(fetchMock)).toEqual({
      ...DOC,
      home: [{ ...hero, visible: false }, products, { ...posts, visible: false }],
    })
    expect(await frame()).toHaveAttribute("src", expect.stringContaining("/onizleme/sfl_2"))
    expect(status()).toHaveTextContent(/Taslak kaydedildi \d\d:\d\d/)
    expect(screen.getByRole("button", { name: "Yayınla" })).toBeEnabled()
  })

  it("keeps a refused change, says why, and sends it again on retry", async () => {
    let refuse = true
    serve(fetchMock, admin, layoutOf(), {
      refuse: () => (refuse ? "Bilinmeyen bir hedef var." : null),
    })
    renderEditor()
    await opened()

    await userEvent.click(screen.getByRole("button", { name: "Blog yazıları bölümünü gizle" }))
    const saving = status()
    await waitFor(
      () => {
        expect(saving).toHaveTextContent("Kaydedilemedi: Bilinmeyen bir hedef var.")
      },
      { timeout: 3000 }
    )
    // The change stays on screen; it is not sent again by itself
    expect(screen.getByRole("button", { name: "Blog yazıları bölümünü göster" })).toBeVisible()
    expect(postsTo(fetchMock)).toHaveLength(1)

    refuse = false
    await userEvent.click(within(saving).getByRole("button", { name: "Tekrar dene" }))
    await waitFor(() => {
      expect(saving).toHaveTextContent(/Taslak kaydedildi/)
    })
    expect(postsTo(fetchMock)).toHaveLength(2)
    expect(lastSaved(fetchMock)?.home[2]).toMatchObject({ id: "blogyazilari", visible: false })
  })

  it("publishes once asked, storing what waits first", async () => {
    renderEditor()
    await opened()

    await userEvent.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await userEvent.click(screen.getByRole("button", { name: "Yayınla" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Tasarım yayınlansın mı?" })
    expect(dialog).toHaveTextContent("Vitrinde en geç bir dakikada görünür.")
    await userEvent.click(within(dialog).getByRole("button", { name: "Yayınla" }))

    await waitFor(() => {
      expect(postsTo(fetchMock, `${PATH}/publish`)).toEqual([
        [`${PATH}/publish`, { method: "POST", body: {} }],
      ])
    })
    const calls = fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`)
    expect(calls.indexOf(`POST ${PATH}`)).toBeLessThan(calls.indexOf(`POST ${PATH}/publish`))
    expect(lastSaved(fetchMock)?.home[0]).toMatchObject({ visible: false })
    expect(toast.success).toHaveBeenCalledWith("Yayınlandı; vitrinde en geç bir dakikada görünür.")
  })

  it("throws the draft's changes away once asked, showing the live design", async () => {
    serve(
      fetchMock,
      admin,
      layoutOf({ has_changes: true, draft: { ...DOC, home: DOC.home.slice(0, 1) } })
    )
    renderEditor()
    const tree = await opened()
    expect(within(tree).queryByRole("button", { name: "Blog yazıları" })).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Değişiklikleri at" }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Değişiklikleri at" }))

    expect(await within(tree).findByRole("button", { name: "Blog yazıları" })).toBeVisible()
    expect(postsTo(fetchMock, `${PATH}/discard`)).toHaveLength(1)
    // What the server holds is not sent back
    expect(postsTo(fetchMock)).toEqual([])
  })

  it("loads a published version into the draft, asking first when the draft has changes", async () => {
    serve(fetchMock, admin, layoutOf({ has_changes: true }))
    renderEditor()
    const tree = await opened()

    await userEvent.click(screen.getByRole("button", { name: "Sürümler" }))
    const sheet = await screen.findByRole("dialog", { name: "Yayınlanan sürümler" })
    expect(within(sheet).getByText("Yayında")).toBeInTheDocument()
    await userEvent.click(
      within(sheet).getByRole("button", { name: "1. sürümü taslağa geri yükle" })
    )
    const confirm = await screen.findByRole("alertdialog", {
      name: "1. sürüm taslağa yüklensin mi?",
    })
    await userEvent.click(within(confirm).getByRole("button", { name: "Taslağa yükle" }))

    await waitFor(() => {
      expect(postsTo(fetchMock, `${PATH}/revisions/1/restore`)).toHaveLength(1)
    })
    // The restored version has no announcement bar
    expect(await within(tree).findByRole("button", { name: "Duyuru şeridi ekle" })).toBeVisible()
  })

  it("undoes and redoes a change, and brings a removed section back from its notice", async () => {
    renderEditor()
    const tree = await opened()

    await userEvent.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }))
    expect(screen.getByRole("button", { name: "Giriş bölümünü gizle" })).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Yinele" }))
    expect(screen.getByRole("button", { name: "Giriş bölümünü göster" })).toBeVisible()

    await userEvent.click(screen.getByRole("button", { name: "Blog yazıları için işlemler" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Kaldır" }))
    expect(within(tree).queryByRole("button", { name: "Blog yazıları" })).toBeNull()
    const [message, options] = vi.mocked(toast.success).mock.calls.at(-1) ?? []
    expect(message).toBe("Blog yazıları kaldırıldı.")
    act(() => {
      ;(options as unknown as { action: { onClick: () => void } }).action.onClick()
    })
    expect(within(tree).getByRole("button", { name: "Blog yazıları" })).toBeVisible()
  })

  it("moves a home section by dragging its handle, or with its arrow buttons", async () => {
    renderEditor()
    const tree = await opened()
    const list = within(tree).getByRole("list", { name: "Ana sayfa" })
    const names = () =>
      within(list)
        .getAllByRole("listitem")
        .map((row) => row.textContent)
    const row = (name: string) => {
      const item = within(list).getByRole("button", { name }).closest("li")
      if (!item) throw new Error(`No row ${name}`)
      return item
    }
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: "" }

    // The blog's handle dropped on the hero's row (its lower half: jsdom has no pointer place)
    const handle = row("Blog yazıları").querySelector("[draggable=true]")
    if (!handle) throw new Error("No handle")
    fireEvent.dragStart(handle, { dataTransfer })
    fireEvent.dragOver(row("Giriş"), { dataTransfer })
    fireEvent.drop(row("Giriş"), { dataTransfer })
    fireEvent.dragEnd(handle, { dataTransfer })
    expect(names()).toEqual(["Giriş", "Blog yazıları", "Ürün listesi"])

    await userEvent.click(screen.getByRole("button", { name: "Ürün listesi bölümünü yukarı taşı" }))
    expect(names()).toEqual(["Giriş", "Ürün listesi", "Blog yazıları"])
    expect(screen.getByRole("button", { name: "Giriş bölümünü yukarı taşı" })).toBeDisabled()
  })

  it("adds a section from the chooser and opens it; a mistake holds the save back", async () => {
    renderEditor()
    await opened()

    await userEvent.click(screen.getByRole("button", { name: "Bölüm ekle" }))
    const chooser = await screen.findByRole("dialog", { name: "Bölüm ekle" })
    await userEvent.click(within(chooser).getByRole("button", { name: /Görsel slayt/ }))

    expect(await screen.findByRole("heading", { name: "Görsel slayt" })).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent("En az bir görsel ekleyin.")
    expect(status()).toHaveTextContent("Düzeltilecek alan var")
    await new Promise((resolve) => setTimeout(resolve, 1700))
    expect(postsTo(fetchMock)).toEqual([])

    await userEvent.click(screen.getByRole("button", { name: "Bölümlere dön" }))
    expect(
      within(screen.getByRole("list", { name: "Ana sayfa" })).getByRole("button", {
        name: /Görsel slayt\s*Düzeltilecek alan var/,
      })
    ).toBeVisible()
  })

  it("leaves for where it was opened from once what waits is stored", async () => {
    renderEditor()
    await opened()

    await userEvent.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await userEvent.click(screen.getByRole("button", { name: "Çık" }))

    await waitFor(() => {
      expect(router.back).toHaveBeenCalledWith({ ignoreBlocker: true })
    })
    expect(postsTo(fetchMock)).toHaveLength(1)
  })
})
