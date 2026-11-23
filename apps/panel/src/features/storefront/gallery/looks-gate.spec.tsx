import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { LooksGate } from "./looks-gate"

const fetchMock = vi.hoisted(() => vi.fn(() => new Promise(() => undefined)))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

function renderAs(role: "owner" | "admin" | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  if (role) {
    client.setQueryData(STAFF_KEY, { user_id: "user_1", role, can: { looks: role === "owner" } })
  }
  return render(
    <QueryClientProvider client={client}>
      <LooksGate>
        <p>Galeri</p>
      </LooksGate>
    </QueryClientProvider>
  )
}

/** Vitrin › Görünümler by its address (the owner, 2026-11-23: the owner's alone). */
describe("LooksGate", () => {
  it("opens the gallery to the owner", () => {
    renderAs("owner")
    expect(screen.getByText("Galeri")).toBeInTheDocument()
  })

  it("tells an admin it is the owner's, without the gallery", () => {
    renderAs("admin")
    expect(screen.queryByText("Galeri")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Görünümler" })).toBeInTheDocument()
    expect(screen.getByText("Görünümleri yalnız mağaza sahibi açabilir.")).toBeInTheDocument()
  })

  it("offers nothing while who is signed in is unknown", () => {
    renderAs(null)
    expect(screen.queryByText("Galeri")).not.toBeInTheDocument()
    expect(screen.queryByText("Görünümleri yalnız mağaza sahibi açabilir.")).not.toBeInTheDocument()
  })
})
