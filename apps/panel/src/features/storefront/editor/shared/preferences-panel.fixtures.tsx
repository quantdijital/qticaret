import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { Mock } from "vitest"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { PreferencesPanel } from "./preferences-panel"

/** What the storefront preferences panel's specs share: the saved section, the server and the forms. */

export const URL = "/admin/platform-settings/storefront"

export const SAVED: StorefrontSettings = {
  announcements: ["1500 TL ve üzeri kargo bedava"],
  trust_badges: [{ icon: "truck", title: "Aynı gün kargo", text: null }],
  primary_color: null,
  hero: null,
  contact_page_id: "cnt_iletisim",
  payment_page_id: "cnt_odeme",
  shipping_page_id: "cnt_kargo",
  contact_form_path: null,
  payment_info_path: null,
  shipping_info_path: null,
  color_swatches: [],
  low_stock_threshold: 3,
}

/** The shop's content pages in İçerik, as the role pickers list them. */
export const PAGES = [
  { id: "cnt_iletisim", title: "İletişim", handle: "iletisim", status: "published" },
  { id: "cnt_odeme", title: "Ödeme seçenekleri", handle: "odeme-secenekleri", status: "published" },
  { id: "cnt_kargo", title: "Kargo ve teslimat", handle: "kargo-ve-teslimat", status: "published" },
  { id: "cnt_destek", title: "Destek", handle: "destek", status: "draft" },
].map((page) => ({ ...page, kind: "page", path: `/${page.handle}` }))

export interface Init {
  method?: string
  body?: Partial<StorefrontSettings>
}

export type FetchMock = Mock<(url: string, init?: Init) => Promise<unknown>>

/**
 * İçerik answers with `pages` (a page by its id: 404 when none); every
 * other call with `stored` over the saved section, and a save over both.
 */
export function answer(
  fetchMock: FetchMock,
  stored: Partial<StorefrontSettings> = {},
  pages: typeof PAGES = PAGES
) {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/content") {
      return Promise.resolve({ entries: pages, count: pages.length })
    }
    if (url.startsWith("/admin/content/")) {
      const found = pages.find((page) => url === `/admin/content/${page.id}`)
      return found
        ? Promise.resolve({ entry: found })
        : Promise.reject(Object.assign(new Error("not found"), { status: 404 }))
    }
    return Promise.resolve({
      section: "storefront",
      values: { ...SAVED, ...stored, ...init?.body },
      version: 2,
    })
  })
}

export const posts = (fetchMock: FetchMock) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")

export function renderPanel(onBack: () => void = () => undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PreferencesPanel onBack={onBack} />
    </QueryClientProvider>
  )
}

/** One group's form, named by its title; each has its own save button. */
export const form = (title: string): HTMLElement => screen.getByRole("form", { name: title })
