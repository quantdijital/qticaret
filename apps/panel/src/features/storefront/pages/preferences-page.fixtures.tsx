import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { Mock } from "vitest"
import type { StorefrontSettings } from "@/features/settings/api/sections"
import { PreferencesPage } from "./preferences-page"

/** What the storefront preferences' specs share: the saved section, the server and the cards. */

export const URL = "/admin/platform-settings/storefront"

export const SAVED: StorefrontSettings = {
  announcements: ["1500 TL ve üzeri kargo bedava"],
  trust_badges: [{ icon: "truck", title: "Aynı gün kargo", text: null }],
  primary_color: null,
  hero: null,
  contact_form_path: "/iletisim",
  color_swatches: [],
}

export interface Init {
  method?: string
  body?: Partial<StorefrontSettings>
}

export type FetchMock = Mock<(url: string, init?: Init) => Promise<unknown>>

/** The shop's details as `GET /admin/shop-tokens` gives them (adr/0048); the address not given. */
export const SHOP_TOKENS = [
  { name: "mağaza_adı", value: "Örnek Bıçak" },
  { name: "telefon", value: "0212 123 45 67" },
  { name: "e_posta", value: "destek@ornek.com" },
  { name: "adres", value: null },
  { name: "whatsapp", value: "0532 123 45 67" },
  { name: "ücretsiz_kargo_eşiği", value: "₺1.500" },
]

/** The server answers every call with `stored` over the saved section, and a save over both; the details menu its list. */
export function answer(fetchMock: FetchMock, stored: Partial<StorefrontSettings> = {}) {
  fetchMock.mockImplementation((url: string, init?: Init) =>
    Promise.resolve(
      url === "/admin/shop-tokens"
        ? { tokens: SHOP_TOKENS }
        : {
            section: "storefront",
            values: { ...SAVED, ...stored, ...init?.body },
            version: 2,
          }
    )
  )
}

export const posts = (fetchMock: FetchMock) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")

export function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PreferencesPage />
    </QueryClientProvider>
  )
}

/** The card under a title; each has its own save button. */
export function card(title: string): HTMLElement {
  const section = screen.getByRole("heading", { name: title }).closest<HTMLElement>("section")
  if (!section) throw new Error(`No card titled ${title}`)
  return section
}
