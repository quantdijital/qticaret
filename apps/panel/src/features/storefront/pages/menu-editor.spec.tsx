import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { Menu } from "@/features/storefront/api/menus"
import {
  COMPANY,
  HELP,
  MAIN,
  editor,
  link,
  posts,
  renderPage,
  rowOf,
  serve,
} from "./menus-page.fixtures"
import type { AdminMock, Init } from "./menus-page.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())
const admin = vi.hoisted<AdminMock>(() => ({
  productCategory: { list: vi.fn() },
  product: { list: vi.fn() },
  productCollection: { list: vi.fn() },
}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  getRouteApi: () => ({ useSearch: () => ({}) }),
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
}))

const KITCHEN = { kind: "category", target: "pcat_kitchen", label: null }
const CHEF = { kind: "product", target: "prod_chef", label: null }
const ABOUT = { kind: "page", target: "cnt_about", label: "Biz kimiz" }

/** The links the last save sent. */
async function savedItems(card: HTMLElement) {
  await userEvent.click(within(card).getByRole("button", { name: "Kaydet" }))
  await waitFor(() => {
    expect(posts(fetchMock)).toHaveLength(1)
  })
  const body = posts(fetchMock)[0]?.[1]?.body as { items: unknown }
  return body.items
}

describe("MenuEditor", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve(fetchMock, admin, [MAIN, COMPANY, HELP])
  })

  it("adds a category found by name, sent as a record link without a name of its own", async () => {
    renderPage()
    const card = await editor("Başlık menüsü")

    await userEvent.click(within(card).getByRole("button", { name: "Bağlantı ekle" }))
    const dialog = await screen.findByRole("dialog", { name: "Bağlantı ekle" })
    expect(within(dialog).getByRole("tab", { name: "Kategori" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await within(dialog).findByRole("button", { name: /Outlet/ })
    await userEvent.type(within(dialog).getByRole("searchbox", { name: "Ada göre ara" }), "şef")
    await waitFor(() => {
      expect(within(dialog).queryByRole("button", { name: /Outlet/ })).toBeNull()
    })
    // Under its parent, which names it
    await userEvent.click(
      await within(dialog).findByRole("button", { name: /Şef bıçakları\s*Mutfak bıçakları/ })
    )

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(rowOf(card, "Şef bıçakları")).toHaveTextContent("Kategori")
    expect(await savedItems(card)).toEqual([
      { link: KITCHEN, children: [CHEF] },
      { link: ABOUT, children: [] },
      { link: { kind: "category", target: "pcat_chefs", label: null }, children: [] },
    ])
  })

  it("adds an address with its own name, refusing a script first", async () => {
    renderPage()
    const card = await editor("Başlık menüsü")

    await userEvent.click(within(card).getByRole("button", { name: "Bağlantı ekle" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("tab", { name: "Dış adres" }))
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: /^Adres/ }),
      "javascript:alert(1)"
    )
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Görünen ad/ }), "Kampanyalar")
    await userEvent.click(within(dialog).getByRole("button", { name: "Bağlantıyı ekle" }))
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Adres / ile başlayan bir mağaza sayfası ya da https:// ile başlayan bir site olmalı."
    )

    const address = within(dialog).getByRole("textbox", { name: /^Adres/ })
    await userEvent.clear(address)
    await userEvent.type(address, " /kampanyalar ")
    await userEvent.click(within(dialog).getByRole("button", { name: "Bağlantıyı ekle" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(await savedItems(card)).toEqual([
      { link: KITCHEN, children: [CHEF] },
      { link: ABOUT, children: [] },
      { link: { kind: "url", url: "/kampanyalar", label: "Kampanyalar" }, children: [] },
    ])
  })

  it("sends a typed name over the record's, and an emptied one as the record's own", async () => {
    renderPage()
    const card = await editor("Başlık menüsü")

    await userEvent.type(
      within(card).getByRole("textbox", { name: "Mutfak bıçakları için görünen ad" }),
      " Bıçaklar "
    )
    await userEvent.clear(within(card).getByRole("textbox", { name: "Biz kimiz için görünen ad" }))

    expect(await savedItems(card)).toEqual([
      { link: { ...KITCHEN, label: "Bıçaklar" }, children: [CHEF] },
      { link: { ...ABOUT, label: null }, children: [] },
    ])
  })

  it("reorders and nests links with the keyboard's buttons", async () => {
    renderPage()
    const card = await editor("Başlık menüsü")
    const button = (name: string) => within(card).getByRole("button", { name })

    // The first link has nothing above it to go under
    expect(button("Mutfak bıçakları: üsttekinin altına al")).toBeDisabled()
    await userEvent.click(button("Mutfak bıçakları: aşağı taşı"))
    // With its child, under the link now above it; then the child back out
    await userEvent.click(button("Mutfak bıçakları: üsttekinin altına al"))
    await userEvent.click(button("Şef bıçağı: üst düzeye çıkar"))

    expect(await savedItems(card)).toEqual([
      { link: ABOUT, children: [KITCHEN] },
      { link: CHEF, children: [] },
    ])
  })

  it("moves a link by dragging it onto another", async () => {
    renderPage()
    const card = await editor("Başlık menüsü")
    const handle = rowOf(card, "Mutfak bıçakları").querySelector("[draggable=true]")
    if (!handle) throw new Error("no drag handle")
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn() }

    fireEvent.dragStart(handle, { dataTransfer })
    // Below the middle of the row: after it
    fireEvent.dragOver(rowOf(card, "Biz kimiz"), { dataTransfer, clientY: 10 })
    fireEvent.drop(rowOf(card, "Biz kimiz"), { dataTransfer, clientY: 10 })

    expect(await savedItems(card)).toEqual([
      { link: ABOUT, children: [] },
      { link: KITCHEN, children: [CHEF] },
    ])
  })

  it("changes where a link points, keeping its own name", async () => {
    admin.product.list.mockResolvedValue({
      products: [{ id: "prod_santoku", title: "Santoku", status: "draft" }],
    })
    renderPage()
    const card = await editor("Başlık menüsü")

    await userEvent.click(within(card).getByRole("button", { name: "Biz kimiz: hedefi değiştir" }))
    const dialog = await screen.findByRole("dialog", { name: "Bağlantının hedefini değiştir" })
    await userEvent.click(within(dialog).getByRole("tab", { name: "Ürün" }))
    await userEvent.click(await within(dialog).findByRole("button", { name: /Santoku/ }))

    // A draft product: kept, and marked as hidden until published
    expect(within(rowOf(card, "Biz kimiz")).getByText("Yayında değil")).toBeInTheDocument()
    expect(await savedItems(card)).toEqual([
      { link: KITCHEN, children: [CHEF] },
      { link: { kind: "product", target: "prod_santoku", label: "Biz kimiz" }, children: [] },
    ])
  })

  it("opens a long menu with its panels folded, and keeps a row moved under one in sight", async () => {
    const long: Menu = {
      ...MAIN,
      items: [
        link("sml_kitchen", {
          target: "pcat_kitchen",
          name: "Mutfak bıçakları",
          children: Array.from({ length: 12 }, (_, index) =>
            link(`sml_knife_${String(index)}`, {
              kind: "product",
              target: `prod_${String(index)}`,
              name: `Bıçak ${String(index + 1)}`,
            })
          ),
        }),
        ...MAIN.items.slice(1),
      ],
    }
    serve(fetchMock, admin, [long])
    renderPage()
    const card = await editor("Başlık menüsü")
    const knife = { name: "Bıçak 1 için görünen ad" }

    expect(within(card).queryByRole("textbox", knife)).toBeNull()
    expect(within(card).getByText("12 alt bağlantı")).toBeInTheDocument()
    const fold = within(card).getByRole("button", {
      name: "Mutfak bıçakları: alt bağlantıları göster",
    })
    expect(fold).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(fold)
    expect(within(card).getByRole("textbox", knife)).toBeInTheDocument()
    await userEvent.click(
      within(card).getByRole("button", { name: "Mutfak bıçakları: alt bağlantıları gizle" })
    )
    expect(within(card).queryByRole("textbox", knife)).toBeNull()

    // Under the folded panel, which opens to show it there
    await userEvent.click(
      within(card).getByRole("button", { name: "Biz kimiz: üsttekinin altına al" })
    )
    expect(rowOf(card, "Biz kimiz")).toHaveAttribute("data-depth", "1")
    expect(within(card).getByRole("textbox", knife)).toBeInTheDocument()
  })
})
