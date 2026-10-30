import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OldAddress } from "@/features/settings/api/migration"
import { AddressesCard } from "@/features/settings/components/migration/addresses-card"
import { RunCard } from "@/features/settings/components/migration/run-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const address = (changes: Partial<OldAddress>): OldAddress => ({
  id: "murl_1",
  address: "/eski-kampanya",
  origins: ["search_console"],
  clicks: 500,
  entity_type: null,
  decision: "auto",
  target: null,
  outcome: null,
  state: "not_found",
  action: "undecided",
  ...changes,
})

const answers: Record<string, unknown> = {
  "/admin/migrations": { runs: [] },
  "/admin/migrations/urls/summary": {
    summary: {
      total: 2,
      matched: 1,
      decided: 0,
      undecided: 1,
      unsupported: 0,
      top: { checked: 2, unanswered: [{ address: "/eski-kampanya", clicks: 500 }] },
      ready: false,
    },
  },
  "/admin/migrations/urls?filter=all&offset=0": {
    urls: [
      address({}),
      address({
        id: "murl_2",
        address: "/urun/dokum-tava",
        action: "covered",
        state: "redirected",
        location: "/urun/yeni",
      }),
    ],
    count: 2,
    limit: 50,
  },
  "/admin/integrations/credentials": { key_configured: true, accounts: [] },
  "/admin/migrations/feed": { async_job: { id: "job_1", status: "queued", progress: 0 } },
  "/admin/async-jobs/job_1": { async_job: { id: "job_1", status: "running", progress: 40 } },
}

const renderWith = (element: React.ReactNode) => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(answers[url] ?? {}))
  return render(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>)
}

describe("Settings > Migration", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("says the cutover is not ready and takes the owner's 301 for an address", async () => {
    renderWith(<AddressesCard />)
    expect(await screen.findByText("Kesime hazır değil")).toBeInTheDocument()
    expect(screen.getByText(/1 tanesi henüz yanıt vermiyor/)).toBeInTheDocument()
    const row = (await screen.findByText("/eski-kampanya")).closest("tr") as HTMLElement
    // An address that answers already takes no decision
    const covered = screen.getByText("/urun/dokum-tava").closest("tr") as HTMLElement
    expect(within(covered).queryByRole("combobox")).not.toBeInTheDocument()

    await userEvent.click(within(row).getByRole("combobox"))
    await userEvent.click(await screen.findByRole("option", { name: "Yönlendir" }))
    await userEvent.type(within(row).getByRole("textbox"), "/urun/yeni")
    await userEvent.click(within(row).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/migrations/urls/murl_1/decision", {
        method: "POST",
        body: { decision: "redirect", target: "/urun/yeni" },
      })
    })
  })

  it("checks a feed with the owner's parcel and shows the run going", async () => {
    renderWith(<RunCard />)
    await userEvent.click(await screen.findByRole("combobox", { name: "Kaynak" }))
    await userEvent.click(await screen.findByRole("option", { name: /Ürün akışı/ }))
    await userEvent.type(screen.getByLabelText("Akış adresi"), "https://eski.example/google.xml")
    for (const [label, value] of [
      ["Ağırlık (g)", "500"],
      ["Uzunluk (cm)", "30"],
      ["Genişlik (cm)", "20"],
      ["Yükseklik (cm)", "10"],
    ] as const) {
      await userEvent.type(screen.getByLabelText(label), value)
    }
    await userEvent.click(screen.getByRole("button", { name: "Kuru çalıştır" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/migrations/feed", {
        method: "POST",
        body: {
          mode: "check",
          defaults: { weight: 500, length: 30, width: 20, height: 10 },
          url: "https://eski.example/google.xml",
        },
      })
    })
    expect(await screen.findByText(/Çalışıyor… %40/)).toBeInTheDocument()
  })
})
