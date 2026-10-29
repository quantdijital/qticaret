import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { MetaSettings } from "./meta-settings"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@/components/patterns/leave-guard", () => ({ LeaveGuard: () => null }))

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MetaSettings account={undefined} keyConfigured />
    </QueryClientProvider>
  )
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement
// A token of the run's own: no fixed value a scanner could take for a real one
const TOKEN = `EAA${crypto.randomUUID().replace(/-/g, "")}`

describe("MetaSettings", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ account: null, check: "valid" })
  })

  it("takes a pixel id of digits and the token, and leaves the test code out when empty", async () => {
    renderSettings()
    await userEvent.type(field("meta-pixel-id"), "piksel")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet ve doğrula" }))
    expect(await screen.findByText(/Yalnızca rakamlardan/)).toBeInTheDocument()

    await userEvent.clear(field("meta-pixel-id"))
    await userEvent.type(field("meta-pixel-id"), "123456789012")
    await userEvent.type(field("meta-access-token"), TOKEN)
    await userEvent.click(screen.getByRole("button", { name: "Kaydet ve doğrula" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/meta", {
        method: "POST",
        body: {
          settings: { pixel_id: "123456789012" },
          secrets: { access_token: TOKEN },
        },
      })
    })
  })
})
