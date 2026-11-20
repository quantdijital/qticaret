import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import { DOC_WITH_PAGES, FULL_PAGES, pageSection, serveContent } from "./content-pages.fixtures"
import type { EditorSearch } from "./editor-search"
import { ThemeEditorPage } from "./theme-editor-page"
import {
  DOC,
  holdClock,
  lastSaved,
  layoutOf,
  opened,
  pass,
  releaseClock,
  serve,
} from "./theme-editor.fixtures"
import type { AdminMock, Init, ServeOptions } from "./theme-editor.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const navigate = vi.hoisted(() => vi.fn())
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
  useNavigate: () => navigate,
  useBlocker: () => ({ status: "idle" }),
}))

let user: UserEvent

const TEXT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "İade on dört gün içinde." }] }],
}

/** The editor on the shop's design, opened on `content` as a reload of `?icerik=` would. */
function open(
  doc: LayoutDocument,
  content: string | null = null,
  options: ServeOptions = {},
  bodies: Record<string, JSONContent> = {}
) {
  serve(fetchMock, admin, layoutOf({ draft: doc }), options)
  serveContent(fetchMock, undefined, bodies)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ThemeEditorPage content={content} />
    </QueryClientProvider>
  )
  return opened()
}

/** The content page the editor's address names now. */
const inAddress = () => {
  const call = navigate.mock.calls.at(-1)?.[0] as
    { search: (was: EditorSearch) => EditorSearch; replace: boolean } | undefined
  return call?.search({ open: "preferences" })
}

const picker = () => screen.getByRole("combobox", { name: "Düzenlenen içerik sayfası" })
const frame = () => screen.getByTitle("Vitrin önizlemesi")
const rows = (tree: HTMLElement) =>
  within(within(tree).getByRole("list", { name: "Sayfadaki bölümler" }))
    .getAllByRole("listitem")
    .map((row) => row.textContent)

async function chooseContentPage() {
  await user.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
  await user.click(await screen.findByRole("option", { name: "İçerik sayfası" }))
}

/** adr/0073 Ek 2026-11-19 (2) K1, K5: a content page is the theme editor's, one list of sections. */
describe("the theme editor's content pages", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    navigate.mockReset()
  })
  afterEach(() => {
    releaseClock()
  })

  it("picks a page beside the page choice, a new one first, drafts tagged, kept in the address", async () => {
    await open(DOC_WITH_PAGES)
    await chooseContentPage()

    // The shop's first page until another is picked
    await waitFor(() => {
      expect(picker()).toHaveTextContent("Hakkımızda")
    })
    expect(inAddress()).toEqual({ open: "preferences", icerik: "cnt_hakkimizda" })
    await user.click(picker())
    const options = await screen.findAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      "Yeni sayfa",
      "Hakkımızda/hakkimizda",
      "İletişim/iletisim",
      "İade koşulları/iade-kosullariTaslak",
    ])
    const refund = options[3]
    if (!refund) throw new Error("no pages listed")
    expect(within(refund).queryByRole("img", { name: "Kendi düzeni var" })).toBeNull()

    await user.click(refund)
    expect(picker()).toHaveTextContent("İade koşulları")
    expect(inAddress()).toEqual({ open: "preferences", icerik: "cnt_iade" })
    // A draft page goes to the preview with its id (only the editor's session shows it)
    await waitFor(() => {
      expect(frame()).toHaveAttribute(
        "src",
        expect.stringContaining("?sayfa=%2Fiade-kosullari&icerik=cnt_iade") as string
      )
    })
  })

  it("lists the page's sections as one list, its contact section among them, edited in place", async () => {
    const tree = await open(DOC_WITH_PAGES, "cnt_iletisim")

    expect(await within(tree).findByRole("group", { name: "İletişim" })).toBeVisible()
    expect(rows(tree)).toEqual(["Sık sorulan sorular", "İletişim"])
    expect(within(tree).queryByRole("list", { name: "Üstte" })).toBeNull()
    expect(within(tree).getByRole("button", { name: "Sayfa ayarları" })).toBeVisible()

    await user.click(within(tree).getByRole("button", { name: "İletişim" }))
    await screen.findByRole("region", { name: "İletişim" })
    const form = screen.getByRole("switch", { name: "İletişim formu" })
    expect(form).toBeChecked()
    await user.click(form)
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.pages[1]?.sections[1]).toMatchObject({
        type: "contact",
        form: "off",
        imprint: "on",
      })
    })
    // One list: nothing of the old places goes to the server
    expect(JSON.stringify(lastSaved(fetchMock)?.pages)).not.toContain("placement")
  })

  it("shows a page with no layout its text as sections, made the page's with the first change", async () => {
    const tree = await open(DOC, "cnt_iade", {}, { cnt_iade: TEXT })

    expect(await within(tree).findByRole("button", { name: "Sayfa metni" })).toBeVisible()
    await pass(AUTOSAVE_MS)
    expect(lastSaved(fetchMock)?.pages ?? []).toEqual([])

    await user.click(within(tree).getByRole("button", { name: "Sayfa metni" }))
    await screen.findByRole("heading", { level: 2, name: "Sayfa metni" })
    await user.click(screen.getByRole("switch", { name: "İçindekiler" }))
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.pages).toMatchObject([
        {
          page_id: "cnt_iade",
          sections: [{ type: "rich_text", variant: "article", outline: "off", body: TEXT }],
        },
      ])
    })
  })

  it("shows the contact page with no layout as its contact section, by the page's id", async () => {
    const tree = await open(
      DOC,
      "cnt_iletisim",
      { storefront: { contact_page_id: "cnt_iletisim" } },
      { cnt_iletisim: TEXT }
    )
    await within(tree).findByRole("list", { name: "Sayfadaki bölümler" })
    expect(rows(tree)).toEqual(["İletişim"])
  })

  it("adds a section after the page's last, without a place", async () => {
    const tree = await open(DOC_WITH_PAGES, "cnt_hakkimizda")
    await within(tree).findByRole("list", { name: "Sayfadaki bölümler" })

    await user.click(within(tree).getByRole("button", { name: "Bölüm ekle" }))
    const chooser = await screen.findByRole("dialog", { name: "Bölüm ekle" })
    expect(chooser).toHaveTextContent("Bu sayfaya, bölümlerin sonuna eklenir")
    expect(within(chooser).queryByRole("button", { name: /Giriş/ })).toBeNull()
    await user.click(within(chooser).getByRole("button", { name: /Yardım kutusu/ }))
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.pages[0]?.sections.map((each) => each.type)).toEqual([
        "rich_text",
        "help",
        "reviews",
        "help",
      ])
    })
    expect(lastSaved(fetchMock)?.pages[0]?.sections[3]).not.toHaveProperty("placement")
  })

  it("says no other page takes a layout while fifty have one, its text only shown", async () => {
    const tree = await open({ ...DOC, pages: FULL_PAGES }, "cnt_hakkimizda")
    expect(await within(tree).findByRole("button", { name: "Bölüm ekle" })).toBeDisabled()
    expect(tree).toHaveTextContent("Kendi düzeni olan en çok 50 sayfa olabilir.")
    await user.click(picker())
    const list = await screen.findByRole("dialog")
    expect(within(list).getByText(/Kendi düzeni olan en çok 50 sayfa/)).toBeVisible()
  })

  it("says a page with text and no room is only shown", async () => {
    const tree = await open({ ...DOC, pages: FULL_PAGES }, "cnt_iade", {}, { cnt_iade: TEXT })
    expect(await within(tree).findByRole("button", { name: "Sayfa metni" })).toBeVisible()
    expect(tree).toHaveTextContent("Sayfa sınırı dolu: bu sayfanın metni yalnız gösteriliyor.")
    expect(within(tree).getByRole("button", { name: "Bölüm ekle" })).toBeDisabled()
  })

  it("says so when the address names a page the shop no longer has, adding nothing to it", async () => {
    const tree = await open(DOC, "cnt_silindi")
    expect(await screen.findByText(/Bu sayfa bulunamadı/)).toBeVisible()
    expect(tree).toHaveTextContent("Bölüm eklemek için yukarıdan bir sayfa seçin")
    expect(within(tree).queryByRole("button", { name: "Bölüm ekle" })).toBeNull()
  })

  it("adds no thirteenth section to a page", async () => {
    const twelve = Array.from({ length: 12 }, (_, at) =>
      pageSection("help", `yardim${String(at).padStart(4, "0")}`)
    )
    const tree = await open(
      { ...DOC, pages: [{ page_id: "cnt_hakkimizda", sections: twelve }] },
      "cnt_hakkimizda"
    )
    expect(await within(tree).findByRole("button", { name: "Bölüm ekle" })).toBeDisabled()
    expect(tree).toHaveTextContent("Bir sayfada en çok 12 bölüm olabilir.")
  })
})
