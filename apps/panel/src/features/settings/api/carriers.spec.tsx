import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { useCarrierShown } from "./carriers"

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe("useCarrierShown (adr/0027 Ek 2026-11-26 askı)", () => {
  it("shows a carrier only once the server offers it, other choices always", async () => {
    let answer: (value: { carriers: string[] }) => void = () => undefined
    fetchMock.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    const { result } = renderHook(() => useCarrierShown(), { wrapper })

    // While the list loads no carrier shows, so a suspended one never flashes
    expect(result.current("dhlecommerce")).toBe(false)
    expect(result.current("aras")).toBe(false)
    expect(result.current("manual")).toBe(true)
    expect(result.current("own")).toBe(true)

    answer({ carriers: ["aras", "yurtici", "surat"] })
    await waitFor(() => {
      expect(result.current("aras")).toBe(true)
    })
    expect(result.current("dhlecommerce")).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith("/admin/shipping-setup/carriers")
  })
})
