import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { staff } from "@/features/bulk-messages/bulk-messages.fixtures"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { featuresQuery } from "@/features/settings/api/features"
import { navItem } from "./navigation"
import { useNavAccess } from "./use-nav-access"

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: vi.fn(() => new Promise(() => undefined)) } },
}))

function accessFor({ role, flag }: { role?: "owner" | "operations"; flag?: boolean }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  if (role) {
    client.setQueryData(STAFF_KEY, staff(role))
  }
  if (flag !== undefined) {
    client.setQueryData(featuresQuery().queryKey, [
      { key: "marketing.campaigns", default: false, owner: "tenant", enabled: flag },
    ])
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useNavAccess(), { wrapper }).result.current
}

describe("the menu's items behind a flag and a capability", () => {
  const bulk = navItem("bulkMessages")

  it("offers Toplu ileti to the owner while the shop has it on", () => {
    expect(accessFor({ role: "owner", flag: true })(bulk)).toBe(true)
  })

  it("hides it while off, from a role without the capability, and while unknown", () => {
    expect(accessFor({ role: "owner", flag: false })(bulk)).toBe(false)
    expect(accessFor({ role: "operations", flag: true })(bulk)).toBe(false)
    expect(accessFor({})(bulk)).toBe(false)
  })

  it("leaves items with neither alone", () => {
    expect(accessFor({})(navItem("promotions"))).toBe(true)
  })
})
