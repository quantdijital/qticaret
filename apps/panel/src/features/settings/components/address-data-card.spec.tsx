import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { ADDRESS_DATA_KEY } from "@/features/settings/api/address-data"
import type { AddressDataJob, AddressDataStatus } from "@/features/settings/api/address-data"
import { AddressDataCard } from "./address-data-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const job = (extra: Partial<AddressDataJob>): AddressDataJob => ({
  id: "ajob_1",
  type: "tr_address.sync",
  status: "succeeded",
  progress: 100,
  progress_key: null,
  result_summary: null,
  error_code: null,
  error_message: null,
  created_at: "2026-11-04T10:00:00.000Z",
  finished_at: "2026-11-04T10:01:00.000Z",
  expires_at: null,
  has_result: false,
  ...extra,
})

const LOADED: AddressDataStatus = {
  provinces: 81,
  districts: 973,
  neighborhoods: 50_462,
  villages: 18_183,
  source: "turkiyeapi",
  dataset_version: "2025",
  last_updated: "2026-05-21",
  last_sync_at: "2026-11-04T10:01:00.000Z",
  job: null,
}

const EMPTY: AddressDataStatus = {
  ...LOADED,
  provinces: 0,
  districts: 0,
  neighborhoods: 0,
  villages: 0,
  source: null,
  dataset_version: null,
  last_updated: null,
  last_sync_at: null,
}

function renderCard(status: AddressDataStatus, { owner = true } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(STAFF_KEY, {
    user_id: "user_1",
    role: owner ? "owner" : "admin",
    can: { trAddressSync: owner },
    mfa: { available: true, required: false, enabled: true, passed: true },
  })
  client.setQueryData(ADDRESS_DATA_KEY, status)
  fetchMock.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/admin/tr-address/sync"
        ? { async_job: job({ status: "queued", progress: null }) }
        : status
    )
  )
  render(
    <QueryClientProvider client={client}>
      <AddressDataCard />
    </QueryClientProvider>
  )
}

describe("AddressDataCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
  })

  it("shows the counts, the dataset and where the data comes from", () => {
    renderCard(LOADED)

    expect(screen.getByText("81")).toBeInTheDocument()
    expect(screen.getByText("973")).toBeInTheDocument()
    expect(screen.getByText("50.462")).toBeInTheDocument()
    expect(screen.getByText(/TürkiyeAPI, 2025 veri seti/)).toBeInTheDocument()
    expect(screen.getByText(/TÜİK ve PTT kaynaklı açık veri/)).toBeInTheDocument()
  })

  it("says the data is not loaded and lets the owner load it", async () => {
    renderCard(EMPTY)

    expect(screen.getByText(/Adres verisi yüklenmedi/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Şimdi güncelle" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/tr-address/sync", { method: "POST", body: {} })
  })

  it("follows a running sync and keeps the button off meanwhile", () => {
    renderCard({
      ...LOADED,
      job: job({ status: "running", progress: 40, progress_key: "tr_address.sync.downloading" }),
    })

    expect(screen.getByText("TürkiyeAPI'den indiriliyor… %40")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Şimdi güncelle" })).toBeDisabled()
  })

  it("tells what the last sync changed, or that the data was current", () => {
    renderCard({
      ...LOADED,
      job: job({
        result_summary: {
          skipped: false,
          provinces: { created: 0, updated: 0, deactivated: 0, unchanged: 81 },
          districts: { created: 1, updated: 2, deactivated: 0, unchanged: 970 },
          neighborhoods: { created: 10, updated: 5, deactivated: 3, unchanged: 50_000 },
        },
      }),
    })

    expect(
      screen.getByText("Güncellendi: 11 eklendi, 7 değişti, 3 kaldırıldı.")
    ).toBeInTheDocument()
  })

  it("says why a sync failed", () => {
    renderCard({
      ...LOADED,
      job: job({
        status: "failed",
        error_code: "tr_address.source_unavailable",
        error_message: "TürkiyeAPI'ye ulaşılamadı; adres verisi değişmedi.",
      }),
    })

    expect(screen.getByText(/TürkiyeAPI'ye ulaşılamadı/)).toBeInTheDocument()
  })

  it("leaves the button to the owner", () => {
    renderCard(LOADED, { owner: false })

    expect(screen.queryByRole("button", { name: "Şimdi güncelle" })).not.toBeInTheDocument()
    expect(screen.getByText(/yalnızca mağaza sahibi/)).toBeInTheDocument()
  })
})
