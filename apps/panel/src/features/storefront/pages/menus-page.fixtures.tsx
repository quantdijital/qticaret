import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import type { Mock } from "vitest"
import type { AdminLink, Menu } from "@/features/storefront/api/menus"
import { MenusPage } from "./menus-page"

/** What the menus page's specs share: the shop's menus, the server and the editor. */

export const link = (id: string, more: Partial<AdminLink> = {}): AdminLink => ({
  id,
  kind: "category",
  target: null,
  url: null,
  label: null,
  name: null,
  path: null,
  broken: false,
  children: [],
  ...more,
})

export const MAIN: Menu = {
  id: "smenu_main",
  title: "Başlık menüsü",
  location: "main",
  rank: 0,
  items: [
    link("sml_kitchen", {
      target: "pcat_kitchen",
      name: "Mutfak bıçakları",
      path: "/mutfak-bicaklari",
      children: [
        link("sml_chef", {
          kind: "product",
          target: "prod_chef",
          name: "Şef bıçağı",
          path: "/urun/sef-bicagi",
        }),
      ],
    }),
    link("sml_about", {
      kind: "page",
      target: "cnt_about",
      label: "Biz kimiz",
      name: "Hakkımızda",
      path: "/hakkimizda",
    }),
  ],
}

/** The main menu's links as the server takes them back unchanged. */
export const MAIN_ITEMS = [
  {
    link: { kind: "category", target: "pcat_kitchen", label: null },
    children: [{ kind: "product", target: "prod_chef", label: null }],
  },
  { link: { kind: "page", target: "cnt_about", label: "Biz kimiz" }, children: [] },
]

export const COMPANY: Menu = {
  id: "smenu_company",
  title: "Kurumsal",
  location: "footer",
  rank: 0,
  items: [
    link("sml_legal", {
      kind: "legal",
      target: "distance_sales",
      name: "Mesafeli Satış Sözleşmesi",
    }),
    // A draft post: still named, hidden until published
    link("sml_draft", { kind: "post", target: "cnt_draft", name: "Bileme rehberi", broken: true }),
    // A deleted brand: no name left
    link("sml_gone", { kind: "brand", target: "brand_gone", broken: true }),
  ],
}

export const HELP: Menu = {
  id: "smenu_help",
  title: "Yardım",
  location: "footer",
  rank: 1,
  items: [
    link("sml_lookup", { kind: "system", target: "order_lookup" }),
    link("sml_track", {
      kind: "url",
      url: "https://kargo.example.com",
      label: "Kargo takibi",
      path: "https://kargo.example.com",
    }),
  ],
}

export const CATEGORIES = [
  { id: "pcat_kitchen", name: "Mutfak bıçakları", parent_category_id: null },
  { id: "pcat_chefs", name: "Şef bıçakları", parent_category_id: "pcat_kitchen" },
  { id: "pcat_outlet", name: "Outlet", parent_category_id: null, is_active: false },
].map((category) => ({ is_active: true, is_internal: false, ...category }))

export interface Init {
  method?: string
  body?: unknown
}
export type FetchMock = Mock<(url: string, init?: Init) => Promise<unknown>>
export interface AdminMock {
  productCategory: { list: Mock }
  product: { list: Mock }
  productCollection: { list: Mock }
}

/** The server: the menus, each save answered with the menu as it was, the picker's records. */
export function serve(fetchMock: FetchMock, admin: AdminMock, menus: Menu[]) {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/storefront-menus") {
      return Promise.resolve(
        init?.method === "POST"
          ? { menu: { id: "smenu_new", ...(init.body as object), items: [] } }
          : { menus }
      )
    }
    const id = url.replace("/admin/storefront-menus/", "")
    const menu = menus.find((each) => each.id === id)
    if (menu) {
      return Promise.resolve(
        init?.method === "DELETE" ? { id, object: "storefront_menu", deleted: true } : { menu }
      )
    }
    // The picker's other kinds: nothing written yet
    const empty: Record<string, unknown> = {
      "/admin/content": { entries: [], count: 0 },
      "/admin/landings": { landings: [], count: 0 },
      "/admin/brands": { brands: [], count: 0 },
      "/admin/legal-documents": { documents: [] },
    }
    return url in empty
      ? Promise.resolve(empty[url])
      : Promise.reject(new Error(`unexpected ${url}`))
  })
  admin.productCategory.list.mockResolvedValue({ product_categories: CATEGORIES })
  admin.product.list.mockResolvedValue({ products: [] })
  admin.productCollection.list.mockResolvedValue({ collections: [] })
}

export const posts = (fetchMock: FetchMock) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")

export function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MenusPage />
    </QueryClientProvider>
  )
}

/** The open menu's card, found by its title. */
export async function editor(title: string): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { level: 2, name: title })
  const section = heading.closest<HTMLElement>("section")
  if (!section) throw new Error(`No editor titled ${title}`)
  return section
}

/** A row of the editor, by the name its field is labelled with. */
export function rowOf(card: HTMLElement, name: string): HTMLElement {
  const item = within(card)
    .getByRole("textbox", { name: `${name} için görünen ad` })
    .closest("li")
  if (!item) throw new Error(`No row named ${name}`)
  return item
}
