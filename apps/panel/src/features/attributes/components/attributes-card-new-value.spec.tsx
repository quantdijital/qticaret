import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AttributeDefinition, AttributeTemplate } from "@/features/attributes/types"
import { AttributesCard } from "./attributes-card"

const sdkFetch = vi.hoisted(() => vi.fn())

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
      options: [{ value: "steel", label: "Çelik" }],
    }),
    definition({
      key: "use",
      label: "Kullanım",
      type: "multi_select",
      rank: 1,
      options: [{ value: "tea", label: "Çay" }],
    }),
  ],
}

const calls = (url: string) =>
  sdkFetch.mock.calls.filter(
    ([at, init]) => at === url && (init as { method?: string } | undefined)?.method === "POST"
  )

function setup() {
  sdkFetch.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (url === "/admin/ai/services") {
      return Promise.resolve({ services: [], tasks: [], flags: { own_keys: true } })
    }
    if (url === "/admin/attribute-templates") {
      return Promise.resolve({ attribute_templates: [TEMPLATE], count: 1 })
    }
    if (url === "/admin/attribute-templates/atpl_1") {
      return Promise.resolve({ attribute_template: { ...TEMPLATE, addon_template_ids: [] } })
    }
    if (init?.method === "POST") {
      return Promise.resolve({ template: TEMPLATE, values: init.body as object })
    }
    return Promise.resolve({ template: TEMPLATE, values: {} })
  })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AttributesCard productId="prod_1" />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

beforeEach(() => {
  sdkFetch.mockReset()
})

describe("AttributesCard: a missing value added from the product", () => {
  it("adds a list value to the group and picks it, without leaving the product", async () => {
    const user = setup()
    await user.click(await screen.findByRole("combobox", { name: "Malzeme" }))
    await user.click(await screen.findByRole("option", { name: "Yeni değer ekle" }))
    await user.type(screen.getByRole("textbox", { name: "Malzeme için yeni değer" }), "Bambu")
    await user.click(screen.getByRole("button", { name: "Ekle" }))

    await waitFor(() => {
      expect(calls("/admin/attribute-templates/atpl_1")).toHaveLength(1)
    })
    const sent = calls("/admin/attribute-templates/atpl_1")[0]?.[1] as {
      body: { definitions: { key: string; options: unknown }[] }
    }
    expect(sent.body.definitions.find((each) => each.key === "material")?.options).toEqual([
      { value: "steel", label: "Çelik" },
      { value: "bambu", label: "Bambu" },
    ])
    // The other field went as it was
    expect(sent.body.definitions.find((each) => each.key === "use")?.options).toEqual([
      { value: "tea", label: "Çay" },
    ])
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Malzeme" })).toHaveTextContent("Bambu")
    })

    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(calls("/admin/products/prod_1/attributes")).toHaveLength(1)
    })
    expect(
      (calls("/admin/products/prod_1/attributes")[0]?.[1] as { body: unknown }).body
    ).toMatchObject({ template_id: "atpl_1", values: { material: "bambu" } })
  })

  it("adds a value to a several-from-a-list field and ticks it; Enter does not save the card", async () => {
    const user = setup()
    const group = await screen.findByRole("group", { name: "Kullanım" })
    await user.click(within(group).getByRole("button", { name: "Yeni değer ekle" }))
    await user.type(
      screen.getByRole("textbox", { name: "Kullanım için yeni değer" }),
      "Kahve{Enter}"
    )

    expect(await within(group).findByRole("checkbox", { name: "Kahve" })).toBeChecked()
    expect(within(group).getByRole("checkbox", { name: "Çay" })).not.toBeChecked()
    expect(calls("/admin/products/prod_1/attributes")).toHaveLength(0)
  })
})
