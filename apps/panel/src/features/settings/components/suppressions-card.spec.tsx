import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SuppressionsCard } from "./suppressions-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SuppressionsCard />
    </QueryClientProvider>
  )
}

describe("SuppressionsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((path: string, init?: { method?: string }) =>
      Promise.resolve(
        init?.method
          ? { id: "msup_1", created: true }
          : {
              suppressions: [
                {
                  id: "msup_1",
                  channel: "email",
                  recipient_masked: "ge***@example.com",
                  reason: "bounce",
                  source: "resend",
                  detail: "General",
                  created_at: "2026-10-28T10:00:00Z",
                },
              ],
              count: 1,
              limit: 20,
              path,
            }
      )
    )
  })

  it("shows the masked address and why, and takes it off the list", async () => {
    renderCard()
    expect(await screen.findByText("ge***@example.com")).toBeInTheDocument()
    expect(screen.getByText("Geri döndü")).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", { name: "ge***@example.com adresini listeden çıkar" })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/messaging/suppressions/msup_1", {
        method: "DELETE",
      })
    })
  })

  it("adds an address the customer asked to be left alone", async () => {
    renderCard()
    await userEvent.type(screen.getByLabelText("E-posta adresi"), "birak@example.com")
    await userEvent.click(screen.getByRole("button", { name: "Listeye ekle" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/messaging/suppressions", {
        method: "POST",
        body: { channel: "email", address: "birak@example.com" },
      })
    })
  })
})
