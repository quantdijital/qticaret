import { DEFAULT_APPEARANCE } from "@qticaret/types"
import type { AppearanceSettings } from "@qticaret/types"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { Mock } from "vitest"
import type { LegalSettings, StoreSettings } from "@/features/settings/api/sections"
import { StorePage } from "./store-page"

/** What the store profile's specs share: the saved sections, the server and the cards. */

export const STORE: StoreSettings = {
  contact_email: "destek@ornek.com",
  contact_phone: "+902121234567",
  whatsapp_phone: null,
  opening_hours: [{ day: 1, opens: "09:00", closes: "18:00" }],
  map_url: null,
  etbis_qr_url: null,
  timezone: "Europe/Istanbul",
  weight_unit: "g",
  dimension_unit: "cm",
}

export const LEGAL: LegalSettings = {
  company_title: "Örnek Bıçak Ltd. Şti.",
  mersis: null,
  tax_office: "Kadıköy",
  tax_number: "1234567890",
  address: null,
  kep: null,
  etbis: null,
  same_as: ["https://instagram.com/ornek"],
  document_name: null,
  document_number: null,
  document_holder: null,
}

export const APPEARANCE: AppearanceSettings = {
  ...DEFAULT_APPEARANCE,
  logo_light_url: "https://cdn.ornek.com/logo.png",
}

export const SAVED: Record<string, object> = {
  store: STORE,
  legal: LEGAL,
  appearance: APPEARANCE,
}

export interface Init {
  method?: string
  body?: Record<string, unknown>
}

export type FetchMock = Mock<(url: string, init?: Init) => Promise<unknown>>

/** Each section as saved (`saved`, these by default), a save answered with the body over it. */
export function answer(fetchMock: FetchMock, saved: Record<string, object> = SAVED) {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    const section = url.replace("/admin/platform-settings/", "")
    return Promise.resolve({
      section,
      values: { ...saved[section], ...init?.body },
      version: init?.method === "POST" ? 2 : 1,
    })
  })
}

export const posts = (fetchMock: FetchMock) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")

export function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StorePage />
    </QueryClientProvider>
  )
}

/** The card under a title; each has its own save button. */
export function card(title: string): HTMLElement {
  const section = screen.getByRole("heading", { name: title }).closest<HTMLElement>("section")
  if (!section) throw new Error(`No card titled ${title}`)
  return section
}
