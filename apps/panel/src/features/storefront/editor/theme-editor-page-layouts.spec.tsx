import { screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import { DOC_WITH_PAGES, PAGE_LAYOUTS } from "./content-pages.fixtures"
import {
  DOC,
  PATH,
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

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const admin = vi.hoisted<AdminMock>(() => ({
  productCategory: { list: vi.fn() },
  product: { list: vi.fn() },
  productCollection: { list: vi.fn() },
}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useRouter: () => ({ history: { back: vi.fn() } }),
  useCanGoBack: () => true,
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
}))

let user: UserEvent

/** The next draft save's document, once the autosave has sent it. */
async function savedAfter(count: number): Promise<LayoutDocument | undefined> {
  await pass(AUTOSAVE_MS)
  await waitFor(() => {
    expect(postsTo(fetchMock)).toHaveLength(count)
  })
  return lastSaved(fetchMock)
}

/**
 * A save never wipes the content pages' layouts it did not touch (adr/0073
 * §1, S2): they go out as they came in, through edits, undo and redo,
 * publishing, a discard and a restore.
 */
describe("the content pages' layouts through the editor", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    vi.mocked(toast.info).mockReset()
  })
  afterEach(() => {
    releaseClock()
  })

  it("saves the other pages' layouts as they were, through a change, undo and redo", async () => {
    serve(fetchMock, admin, layoutOf({ draft: DOC_WITH_PAGES }))
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    expect((await savedAfter(1))?.pages).toEqual(PAGE_LAYOUTS)
    await user.click(screen.getByRole("button", { name: "Geri al" }))
    expect((await savedAfter(2))?.pages).toEqual(PAGE_LAYOUTS)
    await user.click(screen.getByRole("button", { name: "Yinele" }))
    const saved = await savedAfter(3)
    expect(saved?.pages).toEqual(PAGE_LAYOUTS)
    expect(saved?.home[0]).toMatchObject({ visible: false })
  })

  it("keeps them after publishing, the draft read back from the server", async () => {
    serve(fetchMock, admin, layoutOf({ draft: DOC_WITH_PAGES, has_changes: true }))
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Yayınla" }))
    const dialog = await screen.findByRole("alertdialog", { name: "Tasarım yayınlansın mı?" })
    await user.click(within(dialog).getByRole("button", { name: "Yayınla" }))
    await waitFor(() => {
      expect(postsTo(fetchMock, `${PATH}/publish`)).toHaveLength(1)
    })
    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    expect((await savedAfter(1))?.pages).toEqual(PAGE_LAYOUTS)
  })

  it("takes a discarded draft's layouts as the server gives them", async () => {
    serve(fetchMock, admin, layoutOf({ draft: { ...DOC, pages: [] }, has_changes: true }))
    const inner = fetchMock.getMockImplementation()
    // The live design has Hakkımızda's layout: the discard brings it back
    fetchMock.mockImplementation((url: string, init?: Init) =>
      url === `${PATH}/discard`
        ? Promise.resolve({
            layout: layoutOf({ draft: { ...DOC, pages: PAGE_LAYOUTS.slice(0, 1) } }),
            auto_saved: null,
            dropped_pages: 0,
          })
        : (inner?.(url, init) ?? Promise.reject(new Error(url)))
    )
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Değişiklikleri at" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Değişiklikleri at" }))
    await waitFor(() => {
      expect(postsTo(fetchMock, `${PATH}/discard`)).toHaveLength(1)
    })
    await user.click(await screen.findByRole("button", { name: "Giriş bölümünü gizle" }))
    expect((await savedAfter(1))?.pages).toEqual(PAGE_LAYOUTS.slice(0, 1))
    expect(toast.info).not.toHaveBeenCalled()
  })

  it("reads a draft from before page layouts as none, and saves none", async () => {
    const older: Partial<LayoutDocument> = { ...DOC_WITH_PAGES }
    delete older.pages
    serve(fetchMock, admin, layoutOf({ draft: older as LayoutDocument }))
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    expect((await savedAfter(1))?.pages).toEqual([])
  })

  it("says so when the server left out a deleted page's layout, and stops sending it", async () => {
    serve(fetchMock, admin, layoutOf({ draft: DOC_WITH_PAGES }))
    const inner = fetchMock.getMockImplementation()
    // İletişim was deleted in another tab: the server saves the draft without its layout
    fetchMock.mockImplementation((url: string, init?: Init) => {
      if (url === PATH && init?.method === "POST") {
        const { document } = init.body as { document: LayoutDocument }
        const pages = document.pages.filter((page) => page.page_id !== "cnt_iletisim")
        const dropped = document.pages.length - pages.length
        return Promise.resolve({
          layout: layoutOf({ draft: { ...document, pages }, has_changes: true }),
          dropped_pages: dropped,
        })
      }
      return inner?.(url, init) ?? Promise.reject(new Error(url))
    })
    renderEditor()
    await opened()

    await user.click(screen.getByRole("button", { name: "Giriş bölümünü gizle" }))
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith("Silinmiş 1 sayfanın düzeni kaldırıldı.")
    })
    expect(postsTo(fetchMock)[0]?.[1]?.body).toMatchObject({
      document: { pages: PAGE_LAYOUTS },
    })
    // The editor holds it no more: the next save goes without it, said once
    await user.click(screen.getByRole("button", { name: "Blog yazıları bölümünü gizle" }))
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.home[2]).toMatchObject({ visible: false })
    })
    expect(lastSaved(fetchMock)?.pages.map((page) => page.page_id)).toEqual(["cnt_hakkimizda"])
    expect(toast.info).toHaveBeenCalledTimes(1)
  })
})
