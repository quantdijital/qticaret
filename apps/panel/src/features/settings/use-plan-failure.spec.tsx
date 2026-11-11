import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { PLAN_KEY } from "@/features/settings/api/plan"
import { isPlanRefusal, usePlanFailureToast } from "./use-plan-failure"

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({ Link: () => null }))

const SENTENCE =
  "Paketinizin ürün limitine ulaştınız (500/500). Paketinizi ve kullanımınızı Ayarlar > Abonelik sayfasında görebilirsiniz."

describe("plan refusals in the panel (adr/0061 Ek C14)", () => {
  it("knows one by its key, or by a 403 the SDK kept only the sentence of", () => {
    expect(isPlanRefusal({ status: 403, message: SENTENCE })).toBe(true)
    expect(isPlanRefusal({ status: 403, code: "plan.limit_reached", message: SENTENCE })).toBe(true)
    expect(isPlanRefusal({ status: 403, code: "staff.forbidden" })).toBe(false)
    // Ek C15: a write the shop's status closes
    expect(isPlanRefusal({ status: 403, code: "plan.restricted", message: "Kısıtlı" })).toBe(true)
    expect(isPlanRefusal({ status: 400, message: "x" })).toBe(false)
    expect(isPlanRefusal(null)).toBe(false)
  })

  it("toasts the backend's sentence with a link, and refreshes the plan", () => {
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, "invalidateQueries")
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => usePlanFailureToast(), { wrapper })

    result.current({ status: 403, message: SENTENCE })
    result.current({ status: 400, message: "Ürün adı gerekli." })

    expect(toast.error).toHaveBeenNthCalledWith(
      1,
      SENTENCE,
      expect.objectContaining({ action: expect.anything() as unknown })
    )
    expect(toast.error).toHaveBeenNthCalledWith(2, "Ürün adı gerekli.")
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: PLAN_KEY })
  })
})
