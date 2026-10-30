import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SetupBanner } from "./setup-banner"

const sdk = vi.hoisted(() => ({
  store: vi.fn(),
  count: vi.fn(),
  accounts: vi.fn(),
}))
const reach = vi.hoisted(() => ({ settings: true }))

vi.mock("@/lib/sdk", () => ({
  sdk: {
    admin: {
      store: { list: sdk.store },
      region: { list: sdk.count },
      stockLocation: { list: sdk.count },
      shippingOption: { list: sdk.count },
      product: { list: sdk.count },
    },
  },
}))
vi.mock("@/features/settings/api/payments", () => ({ fetchProviderAccounts: sdk.accounts }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: (capability: string) => capability === "settings" && reach.settings,
}))
vi.mock("@tanstack/react-router", () => ({ Link: () => null }))

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SetupBanner />
    </QueryClientProvider>
  )
}

describe("SetupBanner", () => {
  beforeEach(() => {
    reach.settings = true
    sdk.store.mockResolvedValue({ stores: [{ name: "Demo", supported_currencies: [] }] })
    sdk.count.mockResolvedValue({ count: 0 })
    sdk.accounts.mockResolvedValue({ accounts: [] })
  })

  it("says when the setup steps cannot be read, and tries again", async () => {
    const user = userEvent.setup()
    sdk.accounts.mockRejectedValueOnce(Object.assign(new Error("down"), { status: 500 }))
    renderBanner()

    expect(await screen.findByRole("alert")).toHaveTextContent("Kurulum adımları okunamadı.")
    await user.click(screen.getByRole("button", { name: "Tekrar dene" }))

    expect(await screen.findByText("Mağazanızı satışa hazırlayın")).toBeInTheDocument()
  })

  it("is not shown, nor read, to staff who cannot change the shop's settings", () => {
    reach.settings = false
    renderBanner()

    expect(screen.queryByRole("alert")).toBeNull()
    expect(sdk.accounts).not.toHaveBeenCalled()
  })
})
