import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { Mock } from "vitest"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { StorefrontPage } from "./storefront-page"

/** What the storefront page's specs share: the saved section, the server and the cards. */

export const URL = "/admin/platform-settings/storefront"

export const SAVED: StorefrontSettings = {
  announcements: ["1500 TL ve üzeri kargo bedava"],
  top_links: [{ label: "Hakkımızda", href: "/hakkimizda" }],
  footer_groups: [
    { title: "Kurumsal", links: [{ label: "Mesafeli satış", href: "/mesafeli-satis" }] },
  ],
  trust_badges: [{ icon: "truck", title: "Aynı gün kargo", text: null }],
  whatsapp_phone: "+905321234567",
  menu: [],
  primary_color: null,
  hero: null,
  contact_form_path: "/iletisim",
}

export interface Init {
  method?: string
  body?: Partial<StorefrontSettings>
}

export type FetchMock = Mock<(url: string, init?: Init) => Promise<unknown>>

/** The server answers every call with `stored` over the saved section, and a save over both. */
export function answer(fetchMock: FetchMock, stored: Partial<StorefrontSettings> = {}) {
  fetchMock.mockImplementation((_url: string, init?: Init) =>
    Promise.resolve({
      section: "storefront",
      values: { ...SAVED, ...stored, ...init?.body },
      version: 2,
    })
  )
}

export const posts = (fetchMock: FetchMock) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")

export function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StorefrontPage />
    </QueryClientProvider>
  )
}

/** The card under a title; each has its own save button. */
export function card(title: string): HTMLElement {
  const section = screen.getByRole("heading", { name: title }).closest<HTMLElement>("section")
  if (!section) throw new Error(`No card titled ${title}`)
  return section
}
