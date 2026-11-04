import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AttributeDefinition, AttributeTemplate } from "@/features/attributes/types"
import { TemplateSheet } from "./template-sheet"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const URL = "/admin/attribute-templates/tpl_1"

const definition = (more: Partial<AttributeDefinition> = {}): AttributeDefinition => ({
  id: "def_1",
  key: "genislik",
  label: "Genişlik",
  type: "number",
  unit: "cm",
  options: null,
  rank: 0,
  is_required: false,
  is_filterable: false,
  is_seo_highlight: false,
  is_public: true,
  scope: "product",
  option_title: null,
  varies_by: null,
  group: null,
  ...more,
})

const template = (more: Partial<AttributeTemplate> = {}): AttributeTemplate => ({
  id: "tpl_1",
  name: "Mobilya",
  handle: "mobilya",
  description: null,
  groups: null,
  definitions: [definition()],
  ...more,
})

/** The body of the template's one save. */
async function savedBody(): Promise<Record<string, unknown>> {
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(URL, expect.objectContaining({ method: "POST" }))
  })
  const [, init] = fetchMock.mock.calls.find(([url]) => url === URL) as [
    string,
    { body: Record<string, unknown> },
  ]
  return init.body
}

function renderSheet(saved: AttributeTemplate) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TemplateSheet template={saved} open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  )
}

describe("TemplateSheet: spec table groups", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: { body?: object }) =>
      Promise.resolve({ attribute_template: { ...template(), ...init?.body } })
    )
  })

  it("adds a group by name, puts a field in it and sends both", async () => {
    renderSheet(template())

    await userEvent.type(screen.getByRole("textbox", { name: "Yeni grup adı" }), "Ölçüler")
    await userEvent.click(screen.getByRole("button", { name: "Grup ekle" }))
    // A second one with the same name gets a key of its own
    await userEvent.type(screen.getByRole("textbox", { name: "Yeni grup adı" }), "Ölçüler{Enter}")
    expect(screen.getByRole("textbox", { name: "1. grubun adı" })).toHaveValue("Ölçüler")
    await userEvent.clear(screen.getByRole("textbox", { name: "2. grubun adı" }))
    await userEvent.type(screen.getByRole("textbox", { name: "2. grubun adı" }), "Bakım")

    await userEvent.click(screen.getByRole("button", { name: /Genişlik/ }))
    await userEvent.click(screen.getByRole("combobox", { name: "Grup" }))
    await userEvent.click(await screen.findByRole("option", { name: "Bakım" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    const body = await savedBody()
    expect(body["groups"]).toEqual([
      { key: "olculer", name: "Ölçüler", rank: 0 },
      { key: "olculer_2", name: "Bakım", rank: 1 },
    ])
    expect(body["definitions"]).toEqual([
      expect.objectContaining({ id: "def_1", group: "olculer_2" }),
    ])
  })

  it("saves a template without groups as before", async () => {
    renderSheet(template())

    await userEvent.type(screen.getByRole("textbox", { name: /Şablon adı/ }), " ve dekor")
    await userEvent.click(screen.getByRole("button", { name: /Genişlik/ }))
    expect(screen.queryByRole("combobox", { name: "Grup" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    const body = await savedBody()
    expect(body).not.toHaveProperty("groups")
    const [sent] = body["definitions"] as Record<string, unknown>[]
    expect(sent).toMatchObject({ id: "def_1", key: "genislik" })
    expect(sent).not.toHaveProperty("group")
  })

  it("moves a group up, and a removed group's fields fall back to none", async () => {
    renderSheet(
      template({
        groups: [
          { key: "olculer", name: "Ölçüler", rank: 0 },
          { key: "bakim", name: "Bakım", rank: 1 },
        ],
        definitions: [definition({ group: "olculer" })],
      })
    )

    await userEvent.click(screen.getByRole("button", { name: "2. grup: yukarı taşı" }))
    await userEvent.click(screen.getByRole("button", { name: "2. grup: kaldır" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    const body = await savedBody()
    expect(body["groups"]).toEqual([{ key: "bakim", name: "Bakım", rank: 0 }])
    expect(body["definitions"]).toEqual([expect.objectContaining({ id: "def_1", group: null })])
  })
})
