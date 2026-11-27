import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { staff } from "@/features/bulk-messages/bulk-messages.fixtures"
import { offeredKinds } from "@/features/collections/api/flag"
import { featuresQuery } from "@/features/settings/api/features"
import { CollectionsGate } from "./collections-gate"

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: vi.fn(() => new Promise(() => undefined)) } },
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

function renderGate(enabled: boolean | undefined, role: "owner" | "operations" = "owner") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(STAFF_KEY, staff(role))
  if (enabled !== undefined) {
    client.setQueryData(featuresQuery().queryKey, [
      { key: "catalog.collections", default: true, owner: "tenant", enabled },
    ])
  }
  return render(
    <QueryClientProvider client={client}>
      <CollectionsGate>
        <p>Koleksiyon listesi</p>
      </CollectionsGate>
    </QueryClientProvider>
  )
}

describe("CollectionsGate", () => {
  it("shows the collection screens while the shop has collections on", () => {
    renderGate(true)
    expect(screen.getByText("Koleksiyon listesi")).toBeInTheDocument()
  })

  it("says collections are off, records kept, and offers the switch to the owner", () => {
    renderGate(false)
    expect(screen.queryByText("Koleksiyon listesi")).toBeNull()
    // The page keeps its own heading while off (the panel's page walkers wait for it)
    expect(screen.getByRole("heading", { level: 1, name: "Koleksiyonlar" })).toBeInTheDocument()
    expect(screen.getByText(/Koleksiyonlar bu mağazada kapalı/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Özelliklere git" })).toHaveAttribute(
      "href",
      "/settings/features"
    )
  })

  it("offers no switch to a role that cannot change settings", () => {
    renderGate(false, "operations")
    expect(screen.getByRole("heading", { level: 1, name: "Koleksiyonlar" })).toBeInTheDocument()
    expect(screen.getByText(/Koleksiyonlar bu mağazada kapalı/)).toBeInTheDocument()
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("waits for the flags before drawing either", () => {
    renderGate(undefined)
    expect(screen.queryByText("Koleksiyon listesi")).toBeNull()
    expect(screen.queryByText(/kapalı/)).toBeNull()
  })
})

describe("offeredKinds", () => {
  const kinds = ["category", "collection", "brand"] as const

  it("offers every kind while collections are on", () => {
    expect(offeredKinds(kinds, true)).toEqual(["category", "collection", "brand"])
  })

  it("leaves collections out while off, unless already chosen", () => {
    expect(offeredKinds(kinds, false)).toEqual(["category", "brand"])
    expect(offeredKinds(kinds, false, "category")).toEqual(["category", "brand"])
    expect(offeredKinds(kinds, false, "collection")).toEqual(["category", "collection", "brand"])
  })
})
