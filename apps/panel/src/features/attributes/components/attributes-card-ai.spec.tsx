import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AttributeDefinition, AttributeTemplate } from "@/features/attributes/types"
import { AttributesCard } from "./attributes-card"

const sdkFetch = vi.hoisted(() => vi.fn())
const netFetch = vi.fn()

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@/features/attributes/facts/facts-dialog", () => ({ FactsDialog: () => null }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const definition = (over: Partial<AttributeDefinition>): AttributeDefinition => ({
  id: `atdef_${over.key ?? "x"}`,
  key: "x",
  label: "X",
  type: "text",
  unit: null,
  options: null,
  rank: 0,
  is_required: false,
  is_filterable: false,
  is_seo_highlight: false,
  is_public: true,
  scope: "product",
  option_title: null,
  varies_by: null,
  ...over,
})

const TEMPLATE: AttributeTemplate = {
  id: "atpl_1",
  name: "Termos",
  handle: "termos",
  description: null,
  definitions: [
    definition({
      key: "material",
      label: "Malzeme",
      type: "select",
      rank: 0,
      options: [
        { value: "steel", label: "Çelik" },
        { value: "glass", label: "Cam" },
      ],
    }),
    definition({ key: "volume", label: "Hacim", type: "number", unit: "ml", rank: 1 }),
    definition({ key: "origin", label: "Menşei", type: "text", rank: 2 }),
    definition({ key: "brand_code", label: "Marka kodu", type: "text", rank: 3 }),
  ],
}

const task = (allowed = true) => ({
  id: "product_attributes",
  capability: "text",
  mode: "sync",
  options: [],
  allowed,
  usable: ["deepseek"],
  preference: null,
})

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

function setup(
  options: { allowed?: boolean; values?: Record<string, unknown> } = {}
): ReturnType<typeof userEvent.setup> {
  sdkFetch.mockImplementation((url: string) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve({
        services: [],
        tasks: [task(options.allowed ?? true)],
        flags: { own_keys: true },
      })
    }
    if (url === "/admin/attribute-templates") {
      return Promise.resolve({ attribute_templates: [TEMPLATE], count: 1 })
    }
    return Promise.resolve({
      template: TEMPLATE,
      values: options.values ?? { brand_code: "TR-1" },
    })
  })
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept") || url.endsWith("/dismiss")
      ? json(200, { suggestion: { id: "sug_1", text: "" } })
      : json(201, {
          suggestion: {
            id: "sug_1",
            task: "product_attributes",
            service: "deepseek",
            status: "draft",
            text: "{}",
            candidates: ["{}"],
            alternatives: [],
            attributes: {
              values: { material: "steel", volume: 750, origin: "Türkiye", __proto__x: 1 },
              dropped: 1,
            },
          },
        })
  )
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AttributesCard productId="prod_1" />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const BUTTON = "Boş özellikleri doldur"
const posted = () => netFetch.mock.calls.map(([url]) => String(url))

beforeEach(() => {
  sdkFetch.mockReset()
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("AttributesCard's AI fill (adr/0074 §5 madde 3)", () => {
  it("offers a value under each empty field; Uygula writes one in the form, nothing saved", async () => {
    const user = setup()
    await user.click(await screen.findByRole("button", { name: BUTTON }))

    expect(await screen.findByText("Öneri: Çelik")).toBeInTheDocument()
    expect(screen.getByText("Öneri: 750 ml")).toBeInTheDocument()
    expect(screen.getByText("Öneri: Türkiye")).toBeInTheDocument()
    expect(screen.getByText(/3 özellik için öneri var/)).toBeInTheDocument()
    expect(JSON.parse((netFetch.mock.calls[0]?.[1] as { body: string }).body) as unknown).toEqual({
      task: "product_attributes",
      entity_type: "product",
      entity_id: "prod_1",
    })

    await user.click(screen.getByRole("button", { name: "Menşei için öneriyi uygula" }))
    expect(screen.getByLabelText("Menşei")).toHaveValue("Türkiye")
    expect(screen.queryByText("Öneri: Türkiye")).not.toBeInTheDocument()
    // The decision once, at the first value taken; the record is never written here
    await waitFor(() => {
      expect(posted()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/accept"])
    })
    expect(
      sdkFetch.mock.calls.some(
        ([, init]) => (init as { method?: string } | undefined)?.method === "POST"
      )
    ).toBe(false)
    expect(screen.getByRole("button", { name: "Kaydet" })).toBeEnabled()
  })

  it("applies all, never over a field typed meanwhile, and records one decision", async () => {
    const user = setup()
    await user.click(await screen.findByRole("button", { name: BUTTON }))
    await screen.findByText("Öneri: Türkiye")
    await user.type(screen.getByLabelText("Menşei"), "İtalya")
    expect(screen.queryByText("Öneri: Türkiye")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Hepsini uygula" }))
    expect(screen.getByLabelText("Menşei")).toHaveValue("İtalya")
    expect(screen.getByLabelText("Hacim (ml)")).toHaveValue(750)
    expect(screen.getByText("Önerilen alanlar dolu. Kaydetmek size kalır.")).toBeInTheDocument()
    await waitFor(() => {
      expect(posted().filter((url) => url.endsWith("/accept"))).toHaveLength(1)
    })
  })

  it("ignores one, and closing with none taken dismisses the suggestion", async () => {
    const user = setup()
    await user.click(await screen.findByRole("button", { name: BUTTON }))
    await screen.findByText("Öneri: Çelik")
    await user.click(screen.getByRole("button", { name: "Malzeme için öneriyi yok say" }))
    expect(screen.queryByText("Öneri: Çelik")).not.toBeInTheDocument()

    const close = screen.getByRole("button", { name: "Önerileri kapat" })
    expect(close.className).toMatch(/destructive|red/)
    await user.click(close)
    await waitFor(() => {
      expect(posted()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/dismiss"])
    })
    expect(screen.queryByText("Öneri: Türkiye")).not.toBeInTheDocument()
  })

  it("draws no button for a role the task does not allow, or with nothing empty saved", async () => {
    setup({ allowed: false })
    expect(await screen.findByLabelText("Menşei")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: BUTTON })).not.toBeInTheDocument()
  })

  it("draws no button when every public field is filled", async () => {
    setup({
      values: { material: "glass", volume: 500, origin: "Türkiye", brand_code: "TR-1" },
    })
    const section = await screen.findByLabelText("Menşei")
    expect(section).toHaveValue("Türkiye")
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/services")
    })
    expect(within(document.body).queryByRole("button", { name: BUTTON })).not.toBeInTheDocument()
  })
})
