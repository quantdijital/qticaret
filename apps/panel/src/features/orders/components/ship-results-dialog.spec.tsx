import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BoardOrder } from "@/features/orders/api/orders"
import type { ShipResult } from "@/features/orders/api/shipping"
import { ShipResultsDialog } from "./ship-results-dialog"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const shipped = (orderId: string, fulfillmentId: string): ShipResult => ({
  order_id: orderId,
  ok: true,
  carrier: "aras",
  fulfillment_id: fulfillmentId,
  error: null,
  message: null,
})

function renderDialog(results: ShipResult[]) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <ShipResultsDialog
        results={results}
        orders={new Map<string, BoardOrder>()}
        onClose={() => undefined}
      />
    </QueryClientProvider>
  )
}

describe("ShipResultsDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("prints every waiting label at once, in one tab, from one file", async () => {
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() }
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Blob(["%PDF-1.4"], { type: "application/pdf" }), {
        headers: { "x-labels-missing": "0" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: () => "blob:etiketler", revokeObjectURL: vi.fn() })
    )

    renderDialog([shipped("order_1", "ful_A"), shipped("order_2", "ful_B")])
    await userEvent.click(screen.getByRole("button", { name: "2 etiketin hepsini yazdır" }))

    await waitFor(() => {
      expect(tab.location.href).toBe("blob:etiketler")
    })
    expect(open).toHaveBeenCalledWith("", "_blank")
    expect(tab.opener).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/shipping-labels?fulfillment_id=ful_A&fulfillment_id=ful_B",
      { credentials: "same-origin" }
    )
  })

  it("offers no print-all for a single label", () => {
    renderDialog([shipped("order_1", "ful_A")])

    expect(screen.queryByRole("button", { name: /hepsini yazdır/ })).toBeNull()
  })
})
