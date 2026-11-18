import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductDetail } from "@/features/products/api/products"
import { GeneralCard } from "./general-card"

const fetchMock = vi.hoisted(() => vi.fn())
const updateMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { product: { update: updateMock } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const PRODUCT = {
  id: "prod_1",
  title: "Keten Gömlek",
  handle: "keten-gomlek",
  description: "Yazlık keten gömlek.",
} as unknown as ProductDetail

// The AI services answer: the name task offered only where a test says so
const ai = vi.hoisted(() => ({ tasks: [] as unknown[] }))

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GeneralCard product={PRODUCT} />
    </QueryClientProvider>
  )
}

describe("GeneralCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    updateMock.mockReset()
    ai.tasks = []
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/ai/services"
          ? { services: [], tasks: ai.tasks, flags: { own_keys: true } }
          : // The shop's URL style, for the address prefix
            { values: { url_style: { product: "nested" } } }
      )
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // The form keeps dirty values when the product reloads; undo must not
  it("puts back what was saved on undo, in every field typed in", async () => {
    renderCard()
    const title = screen.getByRole("textbox", { name: /Ürün adı/ })
    const handle = screen.getByRole("textbox", { name: /Ürün adresi/ })

    await userEvent.type(title, " Beyaz")
    await userEvent.clear(handle)
    await userEvent.type(handle, "beyaz-gomlek")
    await userEvent.click(screen.getByRole("button", { name: "Geri al" }))

    expect(title).toHaveValue("Keten Gömlek")
    expect(handle).toHaveValue("keten-gomlek")
  })

  // ADR-0055: the description is its own card, in the content editor
  it("leaves the description out, saving the name and address only", async () => {
    updateMock.mockResolvedValue({ product: { ...PRODUCT, title: "Keten Gömlek Beyaz" } })
    renderCard()
    expect(screen.queryByRole("textbox", { name: "Açıklama" })).toBeNull()

    await userEvent.type(screen.getByRole("textbox", { name: /Ürün adı/ }), " Beyaz")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await vi.waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith("prod_1", {
        title: "Keten Gömlek Beyaz",
        handle: "keten-gomlek",
      })
    })
  })

  it("puts a suggested name in the field as a change; Save writes it, nothing before", async () => {
    const SUGGESTED = "Yazlık Keten Gömlek Beyaz"
    ai.tasks = [
      {
        id: "product_title",
        capability: "text",
        mode: "sync",
        options: [],
        allowed: true,
        usable: ["deepseek"],
        preference: null,
      },
    ]
    const net = vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            suggestion: {
              id: "sug_1",
              task: "product_title",
              service: "deepseek",
              text: SUGGESTED,
            },
          }),
          { status: url.endsWith("/accept") ? 200 : 201 }
        )
      )
    )
    vi.stubGlobal("fetch", net)
    updateMock.mockResolvedValue({ product: { ...PRODUCT, title: SUGGESTED } })
    const user = userEvent.setup()
    renderCard()

    await user.click(
      await screen.findByRole("button", { name: "Ürün adı için yapay zekâ ile öner" })
    )
    await user.click(await screen.findByRole("button", { name: "Kullan" }))

    const title = screen.getByRole("textbox", { name: /Ürün adı/ })
    await vi.waitFor(() => {
      expect(title).toHaveValue(SUGGESTED)
    })
    expect(net.mock.calls.map(([url]) => url)).toEqual([
      "/admin/ai/suggestions",
      "/admin/ai/suggestions/sug_1/accept",
    ])
    expect(
      JSON.parse((net.mock.calls[0] as unknown as [string, { body: string }])[1].body)
    ).toEqual({ task: "product_title", entity_type: "product", entity_id: "prod_1" })
    expect(updateMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    await vi.waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith("prod_1", {
        title: SUGGESTED,
        handle: "keten-gomlek",
      })
    })
  })
})
