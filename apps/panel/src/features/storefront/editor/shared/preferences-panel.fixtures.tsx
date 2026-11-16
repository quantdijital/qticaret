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
  contact_form_path: "/iletisim",
  payment_info_path: "/odeme-secenekleri",
  shipping_info_path: "/kargo-ve-teslimat",
  color_swatches: [],
  low_stock_threshold: 3,
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
