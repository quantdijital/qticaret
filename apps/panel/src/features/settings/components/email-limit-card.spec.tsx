import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { EmailLimitCard } from "./email-limit-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <EmailLimitCard />
    </QueryClientProvider>
  )
}

describe("EmailLimitCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ section: "notifications", values: { email_daily_limit: 5000 } })
  })

  it("saves a new daily limit, and takes no number below a hundred", async () => {
    renderCard()
    const box = await screen.findByLabelText("Günde en çok")
    expect(box).toHaveValue("5000")
    const save = screen.getByRole("button", { name: "Kaydet" })

    await userEvent.clear(box)
    await userEvent.type(box, "50")
    expect(save).toBeDisabled()
    await userEvent.type(box, "00")
    await userEvent.click(save)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/platform-settings/notifications",
        expect.objectContaining({ method: "POST", body: { email_daily_limit: 5000 } })
      )
    })
  })
})
