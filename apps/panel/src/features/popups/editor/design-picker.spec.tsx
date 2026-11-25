import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PopupDetail, PopupType } from "@/features/popups/api/types"
import { popupFixture } from "@/features/popups/popups.fixtures"
import { PopupForm } from "./popup-form"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => vi.fn(),
  useBlocker: () => ({ status: "idle" }),
}))

const saveMock = vi.fn<typeof fetch>()

function renderForm(existing: PopupDetail | null, type: PopupType = "info") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PopupForm existing={existing} type={type} canWrite />
    </QueryClientProvider>
  )
}

const designs = () => screen.getByRole("radiogroup", { name: "Tasarım" })
const preview = () => document.querySelector<HTMLElement>("[data-preview-design]")

/** The design picker and the preview (adr/0080 §6a). */
describe("pop-up design", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    saveMock.mockReset()
    fetchMock.mockResolvedValue({
      promotions: [{ id: "promo_1", code: "KIS10", status: "active", is_automatic: false }],
      batch_counts: {},
    })
    vi.stubGlobal("fetch", saveMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("offers five designs, a new info pop-up starting classic, each drawn in the preview", async () => {
    renderForm(null)
    const radios = screen.getAllByRole("radio").filter((each) => designs().contains(each))
    expect(radios).toHaveLength(5)
    expect(screen.getByRole("radio", { name: "Klasik" })).toBeChecked()
    expect(preview()?.dataset["previewDesign"]).toBe("classic")
    expect(document.querySelectorAll("[data-design-shape]")).toHaveLength(5)

    await userEvent.click(screen.getByRole("radio", { name: "Sade" }))
    expect(preview()?.dataset["previewDesign"]).toBe("minimal")
    expect(screen.getByText(/Görselsiz; büyük başlık/)).toBeInTheDocument()
  })

  it("sends the chosen design with the save", async () => {
    saveMock.mockResolvedValue(
      new Response(JSON.stringify({ popup: popupFixture({ id: "popup_9", design: "split" }) }), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    )
    renderForm(null)
    await userEvent.type(screen.getByLabelText(/^Ad/), "Kargo")
    await userEvent.type(screen.getByLabelText(/^Başlık/), "Kargo bedava")
    await userEvent.click(screen.getByRole("radio", { name: "Yan yana" }))
    await userEvent.click(screen.getByRole("button", { name: "Pop-up oluştur" }))
    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1)
    })
    const body = JSON.parse(saveMock.mock.calls[0]?.[1]?.body as string) as { design: string }
    expect(body.design).toBe("split")
  })

  it("starts a new campaign as a coupon, its code on a ticket in the preview", () => {
    renderForm(null, "campaign")
    expect(screen.getByRole("radio", { name: "Kupon" })).toBeChecked()
    expect(preview()?.dataset["previewDesign"]).toBe("coupon")
    expect(document.querySelector("[data-preview-ticket]")).not.toBeNull()
  })

  it("shows a saved pop-up's own design", () => {
    renderForm(popupFixture({ design: "hero" }))
    expect(screen.getByRole("radio", { name: "Büyük görsel" })).toBeChecked()
    expect(preview()?.dataset["previewDesign"]).toBe("hero")
  })
})
