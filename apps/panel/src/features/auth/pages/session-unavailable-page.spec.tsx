import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { SessionUnavailableError } from "@/features/auth/api/session"
import { SessionErrorBoundary } from "./session-unavailable-page"

const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock("@tanstack/react-router", () => ({ useRouter: () => router }))
// The introduction beside the box: not this page's concern
vi.mock("@/features/auth/components/auth-intro", () => ({ AuthIntro: () => null }))

const show = (error: Error) =>
  render(<SessionErrorBoundary error={error} reset={vi.fn()} info={{ componentStack: "" }} />)

describe("SessionErrorBoundary", () => {
  beforeEach(() => {
    router.invalidate.mockReset()
  })

  it("says the panel could not load and tries again, with no sign-in form", async () => {
    show(new SessionUnavailableError("unavailable"))

    expect(screen.getByRole("alert")).toHaveTextContent("Panel şu an yüklenemedi")
    expect(screen.queryByLabelText("Şifre")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }))

    expect(router.invalidate).toHaveBeenCalledTimes(1)
  })

  it("says too many requests on a 429", () => {
    show(new SessionUnavailableError("rateLimited"))

    expect(screen.getByRole("alert")).toHaveTextContent("Çok fazla istek")
  })

  it("shows any other error in the panel's own words, never its internals", async () => {
    show(new Error('relation "order" does not exist'))

    expect(screen.getByRole("alert")).toHaveTextContent("Bilgiler yüklenemedi.")
    expect(screen.queryByText(/does not exist/u)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Tekrar dene" }))

    expect(router.invalidate).toHaveBeenCalledTimes(1)
  })
})
