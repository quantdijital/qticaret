import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ReturnCodeCard } from "./return-code-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const wrap = (node: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

const CODES = { aras: null, yurtici: "998877", other_carrier: null, other_code: null }
const RETURNS = {
  withdrawal_days: 14,
  return_shipping: "shop",
  package_travel: false,
  contracted_return: CODES,
}

describe("the contracted return code (adr/0031 Ek 2026-11-26)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: { body?: { contracted_return?: object } }) =>
      Promise.resolve({
        values: {
          ...RETURNS,
          contracted_return: { ...CODES, ...init?.body?.contracted_return },
        },
      })
    )
  })

  it("saves this carrier's code alone, after warning while there is none", async () => {
    wrap(<ReturnCodeCard target="aras" />)

    const field = await screen.findByLabelText("Anlaşmalı iade kodu")
    expect(screen.getByTestId("return-code-missing")).toHaveTextContent(
      "Anlaşmalı iade kodu girilmedi"
    )
    await userEvent.type(field, " AR-48213 ")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/returns", {
        method: "POST",
        body: { contracted_return: { aras: "AR-48213" } },
      })
    })
    await waitFor(() => {
      expect(screen.queryByTestId("return-code-missing")).toBeNull()
    })
  })

  it("shows a saved code without the warning, and refuses a malformed one", async () => {
    wrap(<ReturnCodeCard target="yurtici" />)

    const field = await screen.findByLabelText("Anlaşmalı iade kodu")
    expect(field).toHaveValue("998877")
    expect(screen.queryByTestId("return-code-missing")).toBeNull()
    await userEvent.clear(field)
    await userEvent.type(field, "<kod>")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByText(/en çok 40 karakter/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/platform-settings/returns",
      expect.anything()
    )
  })

  it("names BirFatura's carrier with its code, both or neither", async () => {
    wrap(<ReturnCodeCard target="other" />)

    await userEvent.type(await screen.findByLabelText("Kargo firması"), "MNG Kargo")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText(/birlikte girin/)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("Anlaşmalı iade kodu"), "555")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/returns", {
        method: "POST",
        body: { contracted_return: { other_carrier: "MNG Kargo", other_code: "555" } },
      })
    })
  })
})
