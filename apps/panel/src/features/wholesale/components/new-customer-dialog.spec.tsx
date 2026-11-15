import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { clientWith, renderWith, tier } from "@/features/wholesale/wholesale.fixtures"
import { NewCustomerDialog } from "./new-customer-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }))

const consent = { address: true, consent: null }

describe("NewCustomerDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path.startsWith("/admin/wholesale/tiers")
          ? { tiers: [tier()], count: 1 }
          : { consents: { email: consent, sms: consent } }
      )
    )
  })

  it("offers Bireysel / Toptancı where the shop sells wholesale, the wholesaler's fields on choosing it", async () => {
    renderWith(clientWith(), <NewCustomerDialog open onOpenChange={() => undefined} />)
    const individual = screen.getByRole("radio", { name: "Bireysel" })
    expect(individual).toHaveAttribute("aria-checked", "true")
    expect(screen.getByLabelText("Ad")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: "Toptancı" }))
    expect(await screen.findByRole("heading", { name: "Yeni toptancı" })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Yetkili adı soyadı/)).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Toptancı" })).toHaveAttribute("aria-checked", "true")
  })

  it.each([
    ["the flag is off", clientWith({ flag: false })],
    ["the person is operations staff", clientWith({ role: "operations" })],
  ])("is the customer window as it was when %s", (_why, client) => {
    renderWith(client, <NewCustomerDialog open onOpenChange={() => undefined} />)
    expect(screen.queryByRole("radio", { name: "Toptancı" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Ad")).toBeInTheDocument()
  })
})
