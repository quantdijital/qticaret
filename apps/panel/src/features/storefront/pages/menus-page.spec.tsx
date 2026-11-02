import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import {
  COMPANY,
  HELP,
  MAIN,
  MAIN_ITEMS,
  editor,
  posts,
  renderPage,
  serve,
} from "./menus-page.fixtures"
import type { AdminMock, Init } from "./menus-page.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const admin = vi.hoisted<AdminMock>(() => ({
  productCategory: { list: vi.fn() },
  product: { list: vi.fn() },
  productCollection: { list: vi.fn() },
}))
const route = vi.hoisted(() => {
  const search: { menu?: string } = {}
  return { search, navigate: vi.fn() }
})

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The open menu comes from the address; leaving with changes is asked about by the router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  getRouteApi: () => ({ useSearch: () => route.search }),
  useNavigate: () => route.navigate,
  useBlocker: () => ({ status: "idle" }),
}))

describe("MenusPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    route.navigate.mockReset()
    route.search = {}
    serve(fetchMock, admin, [MAIN, COMPANY, HELP])
  })

  it("lists the menus by where they show, says what shows where there is none, and opens the first", async () => {
    renderPage()

    const card = await editor("Başlık menüsü")
    expect(screen.getByRole("button", { name: /Başlık menüsü/ })).toHaveAttribute(
      "aria-current",
      "true"
    )
    expect(screen.getByRole("list", { name: "Ana menü" })).toHaveTextContent("3 bağlantı")
    expect(
      screen.getByText("Üst bağlantı yok; menünün üstünde bağlantı satırı görünmüyor.")
    ).toBeInTheDocument()
    const columns = within(screen.getByRole("list", { name: "Alt bilgi sütunları" }))
    expect(columns.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Kurumsal"),
      expect.stringContaining("Yardım"),
    ])
    // A column with links the storefront hides is marked in the list
    expect(columns.getByLabelText("2 bağlantı vitrinde görünmüyor")).toBeInTheDocument()
    // The record's name shows under the shop's own wording
    expect(within(card).getByRole("textbox", { name: "Biz kimiz için görünen ad" })).toHaveValue(
      "Biz kimiz"
    )
    expect(
      within(card).getByRole("textbox", { name: "Mutfak bıçakları için görünen ad" })
    ).toHaveAttribute("placeholder", "Mutfak bıçakları")
    expect(within(card).getByText("/mutfak-bicaklari")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Kaydet" })).toBeDisabled()
    expect(within(card).getByRole("button", { name: "Değişiklikleri at" })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-menus")
  })

  it("explains what the storefront shows while there is no menu at all", async () => {
    serve(fetchMock, admin, [])
    renderPage()

    expect(await screen.findByRole("heading", { name: "Henüz menü yok" })).toBeInTheDocument()
    expect(screen.getByText(/başlıkta kategori ağacınızı, alt bilgide/)).toBeInTheDocument()
    expect(
      screen.getByText(
        "Sütun yok; vitrin alt bilgide kategorilerinizi ve yardım sütununu gösteriyor."
      )
    ).toBeInTheDocument()
  })

  it("marks a link the storefront hides: not live, or its record gone", async () => {
    route.search = { menu: "smenu_company" }
    renderPage()

    const card = await editor("Kurumsal")
    const draft = within(card)
      .getByRole("textbox", { name: "Bileme rehberi için görünen ad" })
      .closest("li")
    const gone = within(card)
      .getByRole("textbox", { name: "Silinmiş kayıt için görünen ad" })
      .closest("li")
    const legal = within(card)
      .getByRole("textbox", { name: "Mesafeli Satış Sözleşmesi için görünen ad" })
      .closest("li")
    if (!draft || !gone || !legal) throw new Error("rows missing")

    expect(within(draft).getByText("Yayında değil")).toBeInTheDocument()
    expect(within(draft).getByText(/vitrinde gizli/)).toBeInTheDocument()
    expect(within(gone).getByText("Bulunamadı")).toBeInTheDocument()
    expect(within(gone).getByText(/Kayıt silinmiş/)).toBeInTheDocument()
    expect(within(legal).queryByText("Yayında değil")).toBeNull()
    expect(within(legal).getByText("Yasal metin")).toBeInTheDocument()
  })

  it("shows the server's refusal and keeps the changes", async () => {
    renderPage()
    const card = await editor("Başlık menüsü")
    fetchMock.mockRejectedValueOnce({
      status: 400,
      message: "Bağlantılardan birinin gösterdiği kayıt artık yok; bağlantıyı yeniden seçin.",
    })

    await userEvent.type(within(card).getByRole("textbox", { name: /^Menü adı/ }), " 2")
    await userEvent.click(within(card).getByRole("button", { name: "Kaydet" }))

    expect(await within(card).findByRole("alert")).toHaveTextContent(
      "Bağlantılardan birinin gösterdiği kayıt artık yok; bağlantıyı yeniden seçin."
    )
    expect(within(card).getByRole("textbox", { name: /^Menü adı/ })).toHaveValue("Başlık menüsü 2")
    expect(within(card).getByRole("button", { name: "Kaydet" })).toBeEnabled()
  })

  it("refuses an empty title before saving and sends nothing", async () => {
    renderPage()
    const card = await editor("Başlık menüsü")

    await userEvent.clear(within(card).getByRole("textbox", { name: /^Menü adı/ }))
    await userEvent.click(within(card).getByRole("button", { name: "Kaydet" }))

    expect(await within(card).findByText("Bu alan boş bırakılamaz.")).toBeInTheDocument()
    expect(posts(fetchMock)).toEqual([])
  })

  it("deletes a menu only once asked, then opens another", async () => {
    renderPage()
    const card = await editor("Başlık menüsü")

    await userEvent.click(within(card).getByRole("button", { name: "Menüyü sil" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("“Başlık menüsü” ve içindeki bağlantılar silinir")
    expect(fetchMock).not.toHaveBeenCalledWith(expect.anything(), { method: "DELETE" })

    await userEvent.click(within(dialog).getByRole("button", { name: "Menüyü sil" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-menus/smenu_main", {
        method: "DELETE",
      })
    })
    await waitFor(() => {
      expect(route.navigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: {}, ignoreBlocker: true })
      )
    })
  })

  it("moves a footer column up by sending both columns whole with their new places", async () => {
    renderPage()
    await editor("Başlık menüsü")

    await userEvent.click(screen.getByRole("button", { name: "Yardım sütununu yukarı taşı" }))

    await waitFor(() => {
      expect(posts(fetchMock)).toHaveLength(2)
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-menus/smenu_help", {
      method: "POST",
      body: {
        title: "Yardım",
        location: "footer",
        rank: 0,
        items: [
          { link: { kind: "system", target: "order_lookup", label: null }, children: [] },
          {
            link: { kind: "url", url: "https://kargo.example.com", label: "Kargo takibi" },
            children: [],
          },
        ],
      },
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/storefront-menus/smenu_company",
      expect.objectContaining({ body: expect.objectContaining({ rank: 1 }) as unknown })
    )
  })

  it("adds a menu in a free place only, and opens it", async () => {
    renderPage()
    await editor("Başlık menüsü")

    await userEvent.click(screen.getByRole("button", { name: "Menü ekle" }))
    const dialog = await screen.findByRole("dialog")
    // The header's menu exists: the top links are the first free place
    expect(within(dialog).getByRole("radio", { name: /Ana menü/ })).toBeDisabled()
    expect(within(dialog).getByRole("radio", { name: /Üst bağlantılar/ })).toBeChecked()
    expect(within(dialog).getByRole("textbox", { name: /^Menü adı/ })).toHaveValue(
      "Üst bağlantılar"
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "Menüyü oluştur" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-menus", {
        method: "POST",
        body: { title: "Üst bağlantılar", location: "top", rank: 0, items: [] },
      })
    })
    await waitFor(() => {
      expect(route.navigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: { menu: "smenu_new" } })
      )
    })
  })

  it("sends a menu saved unchanged but for its title with its links as they were", async () => {
    renderPage()
    const card = await editor("Başlık menüsü")

    await userEvent.type(within(card).getByRole("textbox", { name: /^Menü adı/ }), " 2")
    await userEvent.click(within(card).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-menus/smenu_main", {
        method: "POST",
        body: { title: "Başlık menüsü 2", location: "main", rank: 0, items: MAIN_ITEMS },
      })
    })
  })
})
