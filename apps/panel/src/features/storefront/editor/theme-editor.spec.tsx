import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import {
  DESIGNS,
  DOC,
  holdClock,
  lastSaved,
  layoutOf,
  opened,
  pass,
  postsTo,
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

let user: UserEvent

describe("ThemeEditor", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    router.back.mockReset()
    vi.mocked(toast.success).mockReset()
    serve(fetchMock, admin)
  })
  afterEach(() => {
    releaseClock()
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

  it("saves a change made in one go at once, the whole draft, then reloads the preview", async () => {
    renderEditor()
    await opened()
    await frame()

    // Hiding is one click: saved without the pause typing waits for (adr/0065 §5)
    await user.click(screen.getByRole("button", { name: "Blog yazıları bölümünü gizle" }))
    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await pass(0)
    await waitFor(() => {
      expect(postsTo(fetchMock).length).toBeGreaterThanOrEqual(1)
    })
    await pass(0)
    const [hero, products, posts] = DOC.home
    await waitFor(() => {
      expect(lastSaved(fetchMock)).toEqual({
        ...DOC,
        home: [{ ...hero, visible: false }, products, { ...posts, visible: false }],
      })
    })
    // Fewer saves than a pause apart would need: never one per keystroke's pause
    expect(postsTo(fetchMock).length).toBeLessThanOrEqual(2)
    expect(await frame()).toHaveAttribute("src", expect.stringMatching(/\/onizleme\/sfl_[23]/))
    await waitFor(() => {
      expect(status()).toHaveTextContent(/Taslak kaydedildi \d\d:\d\d/)
    })
    expect(screen.getByRole("button", { name: "Yayınla" })).toBeEnabled()
  })

  it("carries the look the draft was given through its saves (adr/0064 Ek 2026-11-17)", async () => {
    const preset = { pack: "cutlery", code: "katalog", version: 1 }
    const design = { id: "sfd_look1", digest: "a".repeat(64) }
    serve(
      fetchMock,
      admin,
      layoutOf({ draft: { ...DOC, settings: { ...DOC.settings, preset, design } } })
    )
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await pass(0)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.home[0]).toMatchObject({ visible: false })
    })
    // Labels only, the server's to judge: the editor sends them back as they are
    expect(lastSaved(fetchMock)?.settings).toMatchObject({ preset, design })
  })

  it("keeps a refused change, says why, and sends it again on retry", async () => {
    let refuse = true
    serve(fetchMock, admin, layoutOf(), {
      refuse: () => (refuse ? "Bilinmeyen bir hedef var." : null),
    })
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Blog yazıları bölümünü gizle" }))
    const saving = status()
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(saving).toHaveTextContent("Kaydedilemedi: Bilinmeyen bir hedef var.")
    })
    // The change stays on screen; it is not sent again by itself
    await pass(10 * AUTOSAVE_MS)
    expect(screen.getByRole("button", { name: "Blog yazıları bölümünü göster" })).toBeVisible()
    expect(postsTo(fetchMock)).toHaveLength(1)

    refuse = false
    await user.click(within(saving).getByRole("button", { name: "Tekrar dene" }))
    await waitFor(() => {
      expect(saving).toHaveTextContent(/Taslak kaydedildi/)
    })
    expect(postsTo(fetchMock)).toHaveLength(2)
    expect(lastSaved(fetchMock)?.home[2]).toMatchObject({ id: "blogyazilari", visible: false })
  })

  it("publishes once asked, storing what waits first", async () => {
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await user.click(screen.getByRole("button", { name: "Yayınla" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Tasarım yayınlansın mı?" })
    expect(dialog).toHaveTextContent("Vitrinde en geç bir dakikada görünür.")
    await user.click(within(dialog).getByRole("button", { name: "Yayınla" }))

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

    await user.click(screen.getByRole("button", { name: "Değişiklikleri at" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Değişiklikleri at" }))

    expect(await within(tree).findByRole("button", { name: "Blog yazıları" })).toBeVisible()
    expect(postsTo(fetchMock, `${PATH}/discard`)).toHaveLength(1)
    // What the server holds is not sent back
    expect(postsTo(fetchMock)).toEqual([])
  })

  it("loads a published version into the draft, asking first when the draft has changes", async () => {
    serve(fetchMock, admin, layoutOf({ has_changes: true }))
    renderEditor()
    const tree = await opened()

    // The publication history is the looks menu's safety net (adr/0064 Ek 2026-11-17)
    await user.click(screen.getByRole("button", { name: "Görünümler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Yayın geçmişi" }))
    const sheet = await screen.findByRole("dialog", { name: "Yayın geçmişi" })
    expect(within(sheet).getByText("Yayında")).toBeInTheDocument()
    await user.click(within(sheet).getByRole("button", { name: "1. yayını taslağa geri yükle" }))
    const confirm = await screen.findByRole("alertdialog", {
      name: "1. yayın taslağa yüklensin mi?",
    })
    expect(confirm).toHaveTextContent("şimdiki taslak 'Kayıtlı görünümlerim'e otomatik kaydedilir")
    await user.click(within(confirm).getByRole("button", { name: "Taslağa yükle" }))

    await waitFor(() => {
      expect(postsTo(fetchMock, `${PATH}/revisions/1/restore`)).toHaveLength(1)
    })
    // The restored version has no announcement bar
    expect(await within(tree).findByRole("button", { name: "Duyuru şeridi ekle" })).toBeVisible()
    // The draft it replaced was kept: the toast says so
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("1. yayın taslağa yüklendi.", {
        description: "Önceki taslak 'Kayıtlı görünümlerim'e otomatik kaydedildi.",
      })
    })
  })

  it("keeps a publication, or the draft, as a saved look under a name", async () => {
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Görünümler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Yayın geçmişi" }))
    const sheet = await screen.findByRole("dialog", { name: "Yayın geçmişi" })
    await user.click(
      within(sheet).getByRole("button", { name: "1. yayını kayıtlı görünümlere ekle" })
    )
    const naming = await screen.findByRole("dialog", { name: "Görünümü kaydet" })
    const field = within(naming).getByRole<HTMLInputElement>("textbox", { name: "Ad" })
    // jest-dom's toHaveValue compares with lodash and ignores asymmetric matchers
    expect(field.value).toMatch(/^1\. yayın, \d{1,2} \S+$/)
    await user.clear(field)
    await user.type(field, "Bayram vitrini")
    await user.click(within(naming).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(postsTo(fetchMock, DESIGNS).map(([, init]) => init?.body)).toEqual([
        { name: "Bayram vitrini", revision: 1 },
      ])
    })
    await user.keyboard("{Escape}")

    // The draft itself, what waits stored first
    await user.click(screen.getByRole("button", { name: "Görünümler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Bu görünümü kaydet" }))
    const draft = await screen.findByRole("dialog", { name: "Görünümü kaydet" })
    expect(within(draft).getByRole<HTMLInputElement>("textbox", { name: "Ad" }).value).toMatch(
      /^Görünümüm, /
    )
    await user.click(within(draft).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(postsTo(fetchMock, DESIGNS)).toHaveLength(2)
    })
    expect(postsTo(fetchMock, DESIGNS).at(-1)?.[1]?.body).toEqual({
      name: expect.stringMatching(/^Görünümüm, /) as string,
    })
  })

  it("undoes and redoes a change, and brings a removed section back from its notice", async () => {
    renderEditor()
    const tree = await opened()

    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await user.click(screen.getByRole("button", { name: "Geri al" }))
    expect(screen.getByRole("button", { name: "Giriş bölümünü gizle" })).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Yinele" }))
    expect(screen.getByRole("button", { name: "Giriş bölümünü göster" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Blog yazıları için işlemler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Kaldır" }))
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

    await user.click(screen.getByRole("button", { name: "Ürün listesi bölümünü yukarı taşı" }))
    expect(names()).toEqual(["Giriş", "Ürün listesi", "Blog yazıları"])
    expect(screen.getByRole("button", { name: "Giriş bölümünü yukarı taşı" })).toBeDisabled()
  })

  it("adds a section from the chooser and opens it; a mistake holds the save back", async () => {
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Bölüm ekle" }))
    const chooser = await screen.findByRole("dialog", { name: "Bölüm ekle" })
    await user.click(within(chooser).getByRole("button", { name: /Görsel bant/ }))

    expect(await screen.findByRole("heading", { name: "Görsel bant" })).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent("En az bir görsel ekleyin.")
    expect(status()).toHaveTextContent("Düzeltilecek alan var")
    // Its basics in "Diziliş", its width and buttons in "Görünüm", both under Stil (denetim 1.4)
    await openTab(user, "style")
    expect(screen.getByRole("button", { name: "Görünüm" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
    const layout = await openGroup(user, "Diziliş")
    for (const name of ["Yükseklik height", "Yazının yeri position", "Perde gücü overlay"]) {
      expect(within(layout).getByRole("radiogroup", { name })).toBeVisible()
    }
    // However long it waits
    await pass(10 * AUTOSAVE_MS)
    expect(postsTo(fetchMock)).toEqual([])

    await user.click(screen.getByRole("button", { name: "Bölümlere dön" }))
    expect(
      within(screen.getByRole("list", { name: "Ana sayfa" })).getByRole("button", {
        name: /Görsel bant\s*Düzeltilecek alan var/,
      })
    ).toBeVisible()
  })

  it("leaves for where it was opened from once what waits is stored", async () => {
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await user.click(screen.getByRole("button", { name: "Çık" }))

    await waitFor(() => {
      expect(router.back).toHaveBeenCalledWith({ ignoreBlocker: true })
    })
    expect(postsTo(fetchMock)).toHaveLength(1)
  })
})
