import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ApiKeyDialog } from "./api-key-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// A made-up key for the screen, not one any shop has
const TOKEN = `sk_${"0".repeat(8)}test`

describe("ApiKeyDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      key: { id: "apk_1", title: "Depo", redacted: "sk_000***est", scopes: ["orders:read"] },
      token: TOKEN,
    })
  })

  it("makes a key with its scopes and shows it once", async () => {
    const client = new QueryClient()
    render(
      <QueryClientProvider client={client}>
        <ApiKeyDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    )

    await userEvent.type(screen.getByRole("textbox", { name: "Ad" }), "Depo")
    await userEvent.click(screen.getByRole("checkbox", { name: /Stok yazma/ }))
    await userEvent.click(screen.getByRole("button", { name: "Anahtarı oluştur" }))

    expect(await screen.findByText(TOKEN)).toBeInTheDocument()
    expect(screen.getByText("Bu anahtar bir daha gösterilmeyecek.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/api-access", {
      method: "POST",
      body: { title: "Depo", scopes: ["orders:read", "stock:write"] },
    })
  })
})
