import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type * as SeoCardModule from "@/features/seo/components/seo-card"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import { DOC_WITH_PAGES, pageText, serveContent } from "./content-pages.fixtures"
import { ThemeEditorPage } from "./theme-editor-page"
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
// The search look's own card has its own tests: here it only stands in the panel
vi.mock("@/features/seo/components/seo-card", async (original) => ({
  ...(await original<typeof SeoCardModule>()),
  SeoCard: () => <p>Arama görünümü</p>,
}))

let user: UserEvent

const TEXT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Köklerimizden geleceğe." }] }],
}

/** A draft that lays out İade koşulları (a draft page) too. */
const WITH_DRAFT_PAGE: LayoutDocument = {
  ...DOC_WITH_PAGES,
  pages: [
    ...DOC_WITH_PAGES.pages,
    { page_id: "cnt_iade", sections: [pageText("iademetni", "On dört gün.")] },
  ],
}

function open(doc: LayoutDocument, content: string, more: { has_changes?: boolean } = {}) {
  serve(fetchMock, admin, layoutOf({ draft: doc, ...more }))
  serveContent(fetchMock)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ThemeEditorPage content={content} />
    </QueryClientProvider>
  )
  return opened()
}

const calls = (url: string, method: string) =>
  fetchMock.mock.calls.filter(([to, init]) => to === url && init?.method === method)

async function openSettings(tree: HTMLElement) {
  await user.click(await within(tree).findByRole("button", { name: "Sayfa ayarları" }))
  return screen.findByRole("region", { name: "Sayfa ayarları" })
}

/** adr/0073 Ek 2026-11-19 (2) K5: a page opened, set and deleted in the theme editor. */
describe("a content page's own settings in the theme editor", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
  })
  afterEach(() => {
    releaseClock()
  })

  it("opens a new page as a draft, picks it and gives it an empty page text", async () => {
    await open(DOC_WITH_PAGES, "cnt_hakkimizda")
    await user.click(screen.getByRole("combobox", { name: "Düzenlenen içerik sayfası" }))
    await user.click(await screen.findByRole("option", { name: "Yeni sayfa" }))
    const dialog = await screen.findByRole("dialog", { name: "Yeni sayfa" })
    await user.type(within(dialog).getByRole("textbox", { name: /Başlık/ }), "Kargo ve teslimat")
    // The address is made from the title unless written over
    expect(within(dialog).getByRole("textbox", { name: /Sayfa adresi/ })).toHaveAttribute(
      "placeholder",
      "kargo-ve-teslimat"
    )
    await user.click(within(dialog).getByRole("button", { name: "Oluştur" }))

    await waitFor(() => {
      expect(calls("/admin/content", "POST").at(-1)?.[1]?.body).toEqual({
        kind: "page",
        title: "Kargo ve teslimat",
      })
    })
    expect(await screen.findByRole("region", { name: "Sayfa metni" })).toBeVisible()
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.pages.at(-1)).toMatchObject({
        page_id: "cnt_yeni",
        sections: [{ type: "rich_text", variant: "article", outline: "auto", questions: "auto" }],
      })
    })
  })

  it("gives a page just made on the Sayfalar list its empty text, opened (told in memory)", async () => {
    serve(fetchMock, admin, layoutOf({ draft: DOC_WITH_PAGES }))
    serveContent(fetchMock)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ThemeEditorPage content="cnt_iade" open="new-page" />
      </QueryClientProvider>
    )
    await opened()
    expect(await screen.findByRole("region", { name: "Sayfa metni" })).toBeVisible()
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.pages.at(-1)).toMatchObject({
        page_id: "cnt_iade",
        sections: [{ type: "rich_text", variant: "article" }],
      })
    })
  })

  it.each([
    ["a live page whose text is shown from its body", "cnt_hakkimizda"],
    ["a draft page with text written", "cnt_iade"],
    ["a live page with no text", "cnt_iletisim"],
  ])("empties nothing when told a page is new that is not: %s", async (_, page) => {
    serve(fetchMock, admin, layoutOf({ draft: DOC }))
    serveContent(fetchMock, undefined, page === "cnt_iletisim" ? {} : { [page]: TEXT })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ThemeEditorPage content={page} open="new-page" />
      </QueryClientProvider>
    )
    const tree = await opened()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`/admin/content/${page}`)
    })
    if (page !== "cnt_iletisim") {
      // Its text shown as the storefront draws it, as before
      expect(await within(tree).findByRole("button", { name: "Sayfa metni" })).toBeVisible()
    }
    await pass(AUTOSAVE_MS)
    expect(screen.queryByRole("region", { name: "Sayfa metni" })).toBeNull()
    expect(postsTo(fetchMock)).toHaveLength(0)
  })

  it("saves the page's title and status at once, apart from the draft", async () => {
    const tree = await open(DOC_WITH_PAGES, "cnt_iade")
    const panel = await openSettings(tree)
    expect(panel).toHaveTextContent("Sayfa ayarları hemen kaydedilir")
    expect(await within(panel).findByText("Arama görünümü")).toBeVisible()

    const title = within(panel).getByRole("textbox", { name: /Başlık/ })
    await user.clear(title)
    await user.type(title, "İade ve değişim")
    // Each card saves on its own: the title's card
    const card = title.closest("form")
    if (!card) throw new Error("no card")
    await user.click(within(card).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(calls("/admin/content/cnt_iade", "POST").at(-1)?.[1]?.body).toEqual({
        title: "İade ve değişim",
      })
    })

    const live = within(panel).getByRole("switch", { name: "Yayında" })
    expect(live).not.toBeChecked()
    await user.click(live)
    await waitFor(() => {
      expect(calls("/admin/content/cnt_iade", "POST").at(-1)?.[1]?.body).toEqual({
        status: "published",
      })
    })
    // Nothing of these goes into the design's draft
    expect(postsTo(fetchMock)).toHaveLength(0)
  })

  it("deletes the page once asked, its layout out of the draft, the next page picked", async () => {
    const tree = await open(DOC_WITH_PAGES, "cnt_iletisim")
    const panel = await openSettings(tree)
    await user.click(await within(panel).findByRole("button", { name: "Sayfayı sil" }))
    const ask = await screen.findByRole("alertdialog", { name: '"İletişim" silinsin mi?' })
    // A page that was live answers 410 at its address
    expect(ask).toHaveTextContent("(410)")
    await user.click(within(ask).getByRole("button", { name: "Sil" }))

    await waitFor(() => {
      expect(calls("/admin/content/cnt_iletisim", "DELETE")).toHaveLength(1)
    })
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.pages.map((page) => page.page_id)).toEqual(["cnt_hakkimizda"])
    })
    expect(screen.queryByRole("region", { name: "Sayfa ayarları" })).toBeNull()
  })

  it("offers to put the draft pages it lays out live with the design, the edited one ticked", async () => {
    await open(WITH_DRAFT_PAGE, "cnt_iade", { has_changes: true })
    await user.click(screen.getByRole("button", { name: "Yayınla" }))
    const ask = await screen.findByRole("alertdialog", { name: "Tasarım yayınlansın mı?" })
    const also = await within(ask).findByRole("checkbox", {
      name: /İade koşulları sayfasını da yayına al/,
    })
    expect(also).toBeChecked()
    await user.click(within(ask).getByRole("button", { name: "Yayınla" }))
    await waitFor(() => {
      expect(postsTo(fetchMock, `${PATH}/publish`).at(-1)?.[1]?.body).toEqual({
        pages_live: ["cnt_iade"],
      })
    })
  })
})
