import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { CatalogDefaults } from "@/features/products/wizard/catalog-defaults"
import { CatalogDefaultsCard } from "./catalog-defaults-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const DEFAULTS: CatalogDefaults = {
  new_product_kind: "physical",
  new_product_booking_mode: "none",
  dated_schema_type: "TouristTrip",
}

const URL = "/admin/platform-settings/catalog"

function serve(flags: { nonPhysical?: boolean; booking?: boolean }, saved = DEFAULTS) {
  fetchMock.mockImplementation((url: string, init?: { body?: Partial<CatalogDefaults> }) => {
    if (url === "/admin/features") {
      return Promise.resolve({
        features: [
          { key: "catalog.non_physical", enabled: flags.nonPhysical ?? false },
          { key: "catalog.booking", enabled: flags.booking ?? false },
        ],
      })
    }
    if (url === URL) {
      return Promise.resolve({ values: { ...saved, ...init?.body } })
    }
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

const renderCard = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CatalogDefaultsCard />
    </QueryClientProvider>
  )

const KIND = "Yeni ürün türü"
const DATED = "Yeni hizmet tarihli satılsın"
const SCHEMA = "Tarihli ürünün yapılandırılmış veri türü"

function saves(): unknown[] {
  return fetchMock.mock.calls
    .filter(
      ([url, init]) => url === URL && (init as { method?: string } | undefined)?.method === "POST"
    )
    .map(([, init]) => (init as { body: unknown }).body)
}

async function pick(trigger: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: trigger }))
  await userEvent.click(await screen.findByRole("option", { name: option }))
}

describe("CatalogDefaultsCard (adr/0076 §12)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows nothing and reads nothing while both flags are off", async () => {
    serve({})
    const { container } = renderCard()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/features")
    })
    expect(container).toBeEmptyDOMElement()
    expect(fetchMock).not.toHaveBeenCalledWith(URL)
  })

  it("offers only the kind without dated selling", async () => {
    serve({ nonPhysical: true }, { ...DEFAULTS, new_product_kind: "service" })
    renderCard()
    expect(await screen.findByRole("combobox", { name: KIND })).toHaveTextContent("Hizmet")
    expect(screen.queryByRole("switch", { name: DATED })).toBeNull()
    expect(screen.queryByRole("combobox", { name: SCHEMA })).toBeNull()
  })

  it("offers only the structured data while products are all physical", async () => {
    serve({ booking: true })
    renderCard()
    expect(await screen.findByRole("combobox", { name: SCHEMA })).toHaveTextContent(
      "Tur gezisi (TouristTrip)"
    )
    expect(screen.queryByRole("combobox", { name: KIND })).toBeNull()
    expect(screen.queryByRole("switch", { name: DATED })).toBeNull()
  })

  it("offers dated selling for a service only and saves it with the kind", async () => {
    serve({ nonPhysical: true, booking: true })
    renderCard()
    await screen.findByRole("combobox", { name: KIND })
    expect(screen.queryByRole("switch", { name: DATED })).toBeNull()
    await pick(KIND, "Hizmet")
    await userEvent.click(screen.getByRole("switch", { name: DATED }))
    await pick(SCHEMA, "Etkinlik (Event)")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(saves()).toEqual([
        {
          new_product_kind: "service",
          new_product_booking_mode: "departure",
          dated_schema_type: "Event",
        },
      ])
    })
  })

  it("drops dated selling when the kind is no longer a service", async () => {
    serve(
      { nonPhysical: true, booking: true },
      { ...DEFAULTS, new_product_kind: "service", new_product_booking_mode: "departure" }
    )
    renderCard()
    expect(await screen.findByRole("switch", { name: DATED })).toBeChecked()
    await pick(KIND, "Dijital ürün")
    expect(screen.queryByRole("switch", { name: DATED })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(saves()).toEqual([
        {
          new_product_kind: "digital",
          new_product_booking_mode: "none",
          dated_schema_type: "TouristTrip",
        },
      ])
    })
  })
})
