import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { aiServicesQuery } from "@/features/ai/api/ai"
import { featuresQuery } from "@/features/settings/api/features"
import { AssistantSetting } from "./assistant-setting"

const sdkFetch = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ role: "owner" }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("@/features/auth/api/staff", () => ({ useStaff: () => staff }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderSetting(services: string[], on = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(featuresQuery().queryKey, [
    { key: "ai.assistant", default: false, owner: "tenant", enabled: on },
  ])
  client.setQueryData(aiServicesQuery().queryKey, {
    services: [],
    tasks: [],
    flags: { own_keys: true },
    assistant_services: services,
  })
  render(
    <QueryClientProvider client={client}>
      <AssistantSetting />
    </QueryClientProvider>
  )
}

describe("Settings › Yapay zekâ › Yardımcı (adr/0079 §8)", () => {
  beforeEach(() => {
    staff.role = "owner"
    sdkFetch.mockReset()
    sdkFetch.mockResolvedValue({ feature: { key: "ai.assistant", enabled: true } })
  })

  it("cannot be turned on without a service whose tool calling is verified, and says so", () => {
    renderSetting([])
    expect(screen.getByRole("switch", { name: "Yardımcı" })).toBeDisabled()
    expect(screen.getByText(/Yapay zekâyı bağla/)).toBeInTheDocument()
  })

  it("asks first, saying what it does, where the words go and how long they stay", async () => {
    const user = userEvent.setup()
    renderSetting(["minimax"])
    await user.click(screen.getByRole("switch", { name: "Yardımcı" }))

    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("24 saat")
    expect(dialog).toHaveTextContent("yapay zekâ servisine")
    // Backing out turns nothing on
    await user.click(screen.getByRole("button", { name: "Vazgeç" }))
    expect(sdkFetch).not.toHaveBeenCalled()

    await user.click(screen.getByRole("switch", { name: "Yardımcı" }))
    await user.click(await screen.findByRole("button", { name: "Yardımcıyı aç" }))
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/features/ai.assistant", {
        method: "POST",
        body: { enabled: true },
      })
    })
  })

  it("is the owner's alone", () => {
    staff.role = "admin"
    renderSetting(["minimax"])
    expect(screen.getByRole("switch", { name: "Yardımcı" })).toBeDisabled()
    expect(screen.getByText(/yalnız mağaza sahibi/)).toBeInTheDocument()
  })
})
