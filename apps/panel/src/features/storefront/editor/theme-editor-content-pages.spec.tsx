import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { AUTOSAVE_MS } from "@/features/storefront/layout/use-autosave"
import {
  DOC_WITH_PAGES,
  FULL_PAGES,
  PAGE_LAYOUTS,
  pageSection,
  serveContent,
} from "./content-pages.fixtures"
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
  Link: ({
    to,
    params,
    children,
  }: {
    to: string
    params?: { id: string }
    children: ReactNode
  }) => <a href={params ? to.replace("$id", params.id) : to}>{children}</a>,
  useRouter: () => ({ history: { back: vi.fn() } }),
  useCanGoBack: () => true,
  useNavigate: () => navigate,
  useBlocker: () => ({ status: "idle" }),
}))

let user: UserEvent

/** The editor on the shop's design, opened on `content` as a reload of `?icerik=` would. */
function open(doc: LayoutDocument, content: string | null = null, options: ServeOptions = {}) {
  serve(fetchMock, admin, layoutOf({ draft: doc }), options)
  serveContent(fetchMock)
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

async function chooseContentPage() {
  await user.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
  await user.click(await screen.findByRole("option", { name: "İçerik sayfası" }))
}

/** adr/0073 §5: a content page's own layout, picked beside the page choice. */
describe("the theme editor's content pages", () => {
  beforeEach(() => {
    user = holdClock()
    fetchMock.mockReset()
    navigate.mockReset()
  })
  afterEach(() => {
    releaseClock()
  })

  it("picks a page beside the page choice, drafts tagged, own layouts marked, kept in the address", async () => {
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
      "Hakkımızda/hakkimizda",
      "İletişim/iletisim",
      "İade koşulları/iade-kosullariTaslak",
    ])
    const [about, , refund] = options
    if (!about || !refund) throw new Error("no pages listed")
    expect(within(about).getByRole("img", { name: "Kendi düzeni var" })).toBeTruthy()
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

    // Back on a template, the address names no page
    await user.click(screen.getByRole("combobox", { name: "Düzenlenen sayfa" }))
    await user.click(await screen.findByRole("option", { name: "Ana sayfa" }))
    expect(inAddress()).toEqual({ open: "preferences" })
  })

  it("opens on the page the address names, the contact page's text named with its form", async () => {
    const tree = await open(DOC_WITH_PAGES, "cnt_iletisim", {
      storefront: { contact_form_path: "/iletisim" },
    })

    expect(await within(tree).findByRole("group", { name: "İletişim" })).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Düzenlenen sayfa" })).toHaveTextContent(
      "İçerik sayfası"
    )
    const side = (name: string) =>
      within(screen.getByRole("list", { name }))
        .getAllByRole("listitem")
        .map((row) => row.textContent)
    expect(side("Üstte")).toEqual(["Sık sorulan sorular"])
    expect(within(tree).queryByRole("list", { name: "Altta" })).toBeNull()
    await waitFor(() => {
      expect(frame()).toHaveAttribute(
        "src",
        expect.stringContaining("?sayfa=%2Filetisim") as string
      )
    })
    expect(frame().getAttribute("src")).not.toContain("icerik=")

    await user.click(
      await within(tree).findByRole("button", { name: "İletişim bilgileri ve form" })
    )
    expect(await screen.findByText(/iletişim bilgileri Mağaza profilinde/)).toBeVisible()
    expect(screen.getByRole("link", { name: "İçerik'te düzenle" })).toHaveAttribute(
      "href",
      "/content/cnt_iletisim"
    )
  })

  it("makes the page's layout with its first section and takes it away with its last", async () => {
    const tree = await open(DOC_WITH_PAGES, "cnt_iade")
    expect(await within(tree).findByRole("button", { name: "Sayfanın metni" })).toBeVisible()

    await user.click(within(tree).getByRole("button", { name: "Üste bölüm ekle" }))
    const chooser = await screen.findByRole("dialog", { name: "Bölüm ekle" })
    expect(chooser).toHaveTextContent("sayfanın metninin üstüne eklenir")
    expect(within(chooser).queryByRole("button", { name: /Giriş/ })).toBeNull()
    await user.click(within(chooser).getByRole("button", { name: /Yardım kutusu/ }))
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.pages.map((page) => page.page_id)).toEqual([
        "cnt_hakkimizda",
        "cnt_iletisim",
        "cnt_iade",
      ])
    })
    expect(lastSaved(fetchMock)?.pages[2]?.sections).toMatchObject([
      { type: "help", placement: "top" },
    ])
    expect(lastSaved(fetchMock)?.pages.slice(0, 2)).toEqual(PAGE_LAYOUTS)

    await user.click(await screen.findByRole("button", { name: "Bölümlere dön" }))
    await user.click(within(tree).getByRole("button", { name: "Yardım kutusu için işlemler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Kaldır" }))
    await pass(AUTOSAVE_MS)
    await waitFor(() => {
      expect(lastSaved(fetchMock)?.pages).toEqual(PAGE_LAYOUTS)
    })
  })

  it("says no other page takes a layout while twenty have one", async () => {
    const tree = await open({ ...DOC, pages: FULL_PAGES }, "cnt_hakkimizda")
    const add = await within(tree).findByRole("button", { name: "Alta bölüm ekle" })
    expect(add).toBeDisabled()
    expect(within(tree).getByRole("button", { name: "Üste bölüm ekle" })).toBeDisabled()
    expect(tree).toHaveTextContent("Kendi düzeni olan en çok 20 sayfa olabilir.")

    await user.click(picker())
    const list = await screen.findByRole("dialog")
    expect(within(list).getByText(/Kendi düzeni olan en çok 20 sayfa/)).toBeVisible()
  })

  it("says so when the address names a page İçerik no longer has, adding nothing to it", async () => {
    const tree = await open(DOC, "cnt_silindi")
    expect(await screen.findByText(/Bu sayfa bulunamadı/)).toBeVisible()
    expect(tree).toHaveTextContent("Bölüm eklemek için yukarıdan bir sayfa seçin")
    expect(within(tree).queryByRole("button", { name: "Üste bölüm ekle" })).toBeNull()
  })

  it("adds no thirteenth section to a page", async () => {
    const twelve = Array.from({ length: 12 }, (_, at) =>
      pageSection("help", `yardim${String(at).padStart(4, "0")}`)
    )
    const tree = await open(
      { ...DOC, pages: [{ page_id: "cnt_hakkimizda", sections: twelve }] },
      "cnt_hakkimizda"
    )
    expect(await within(tree).findByRole("button", { name: "Alta bölüm ekle" })).toBeDisabled()
    expect(tree).toHaveTextContent("Bir sayfada en çok 12 bölüm olabilir.")
  })
})
