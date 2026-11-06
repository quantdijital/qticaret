import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MyProfile } from "@/features/settings/api/account"
import { MyProfileCard } from "./my-profile-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const MINE: MyProfile = {
  profile: {
    id: "user_1",
    email: "elif@ornek.com",
    first_name: "Elif",
    last_name: "Kaya",
    job_title: "Depo sorumlusu",
    role: "operations",
    created_at: "2026-10-01T09:00:00.000Z",
  },
  sessions: { open: 2 },
}

const renderCard = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MyProfileCard />
    </QueryClientProvider>
  )

describe("MyProfileCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(MINE)
  })

  it("shows the member's name, job title, role, address and since when", async () => {
    renderCard()

    expect(await screen.findByText("Elif Kaya")).toBeInTheDocument()
    expect(screen.getByText("EK")).toBeInTheDocument()
    expect(screen.getByText("Depo sorumlusu")).toBeInTheDocument()
    expect(screen.getByText("Operasyon")).toBeInTheDocument()
    expect(screen.getByText("elif@ornek.com")).toBeInTheDocument()
    expect(screen.getByText(/2026/u)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/staff/me/profile")
  })

  it("edits the name and job title in a dialog; saving waits for a change and a name", async () => {
    renderCard()
    await screen.findByText("Elif Kaya")

    await userEvent.click(screen.getByRole("button", { name: "Düzenle" }))
    const save = screen.getByRole("button", { name: "Kaydet" })
    expect(save).toBeDisabled()

    const first = screen.getByLabelText(/^Ad/u)
    await userEvent.clear(first)
    expect(save).toBeDisabled()
    await userEvent.type(first, "Elif Su")
    await userEvent.clear(screen.getByLabelText(/^Unvan/u))
    await userEvent.click(save)

    expect(fetchMock).toHaveBeenCalledWith("/admin/staff/me/profile", {
      method: "POST",
      body: { first_name: "Elif Su", last_name: "Kaya", job_title: null },
    })
  })

  it("says the server's refusal in the dialog", async () => {
    renderCard()
    await screen.findByText("Elif Kaya")
    fetchMock.mockRejectedValueOnce({ status: 400, message: "Unvan geçersiz karakter içeriyor." })

    await userEvent.click(screen.getByRole("button", { name: "Düzenle" }))
    await userEvent.type(screen.getByLabelText(/^Unvan/u), "!")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Unvan geçersiz karakter içeriyor.")
  })
})
