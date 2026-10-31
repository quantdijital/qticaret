import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { WebhookSubscription } from "@/features/settings/api/webhooks"
import { WebhookSecretDialog } from "./webhook-secret-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const row: WebhookSubscription = {
  id: "whsub_1",
  url: "https://depo.example.com/hook",
  events: ["order.placed"],
  status: "active",
  failure_streak: 0,
  disabled_at: null,
  created_at: "2026-10-31T09:00:00.000Z",
}

describe("WebhookSecretDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ id: "whsub_1", secret: "whsec_yeni" })
  })

  it("renews the secret only when asked, then shows the new one once", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WebhookSecretDialog row={row} onClose={vi.fn()} />
      </QueryClientProvider>
    )

    expect(screen.getByText(/depo\.example\.com\/hook/u)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Sırrı yenile" }))

    expect(await screen.findByText("whsec_yeni")).toBeInTheDocument()
    expect(screen.getByText("Bu sır bir daha gösterilmeyecek.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/webhooks/whsub_1/rotate-secret", {
      method: "POST",
      body: {},
    })
  })
})
