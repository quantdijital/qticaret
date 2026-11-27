import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { staff } from "@/features/bulk-messages/bulk-messages.fixtures"
import { featuresQuery } from "@/features/settings/api/features"
import { POPUPS_FLAG } from "@/features/popups/api/types"
import { PopupsGate } from "./popups-gate"

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: vi.fn(() => new Promise(() => undefined)) } },
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

function renderGate(enabled: boolean, title?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(STAFF_KEY, staff("owner"))
  client.setQueryData(featuresQuery().queryKey, [
    { key: POPUPS_FLAG, default: false, owner: "tenant", enabled },
  ])
  return render(
    <QueryClientProvider client={client}>
      <PopupsGate title={title}>
        <p>Pop-up listesi</p>
      </PopupsGate>
    </QueryClientProvider>
  )
}

describe("PopupsGate", () => {
  it("shows its children while pop-ups are on", () => {
    renderGate(true, "Pop-up'lar")
    expect(screen.getByText("Pop-up listesi")).toBeInTheDocument()
  })

  it("draws the page heading over the off state when the page has none of its own", () => {
    renderGate(false, "Pop-up'lar")
    expect(screen.queryByText("Pop-up listesi")).toBeNull()
    expect(screen.getByRole("heading", { level: 1, name: "Pop-up'lar" })).toBeInTheDocument()
    expect(screen.getByText(/Pop-up'lar kapalı/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Özelliklerden aç" })).toHaveAttribute(
      "href",
      "/settings/features"
    )
  })

  it("leaves the heading to the page around it when no title is given", () => {
    renderGate(false)
    expect(screen.getByText(/Pop-up'lar kapalı/)).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  })
})
