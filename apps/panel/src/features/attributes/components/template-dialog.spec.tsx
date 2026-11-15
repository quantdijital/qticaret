import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { useRecordWalk } from "@qticaret/admin-ui/hooks/use-record-walk"
import type { AttributeDefinition, AttributeTemplate } from "@/features/attributes/types"
import { TemplateDialog } from "./template-dialog"

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

/** A folded attribute's line (its menu button is named after it too). */
const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}(?!:)`) })

function renderDialog(saved: AttributeTemplate) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TemplateDialog template={saved} onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

describe("TemplateDialog: spec table groups", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: { body?: object }) =>
      Promise.resolve({ attribute_template: { ...template(), ...init?.body } })
    )
  })

  it("adds a group by name, puts a field in it and sends both", async () => {
    renderDialog(template())

    await userEvent.click(screen.getByRole("tab", { name: "Gruplar (0)" }))
    await userEvent.type(screen.getByRole("textbox", { name: "Yeni grup adı" }), "Ölçüler")
    await userEvent.click(screen.getByRole("button", { name: "Grup ekle" }))
    // A second one with the same name gets a key of its own
    await userEvent.type(screen.getByRole("textbox", { name: "Yeni grup adı" }), "Ölçüler{Enter}")
    expect(screen.getByRole("textbox", { name: "1. grubun adı" })).toHaveValue("Ölçüler")
    await userEvent.clear(screen.getByRole("textbox", { name: "2. grubun adı" }))
    await userEvent.type(screen.getByRole("textbox", { name: "2. grubun adı" }), "Bakım")

    await userEvent.click(screen.getByRole("tab", { name: "Özellikler (1)" }))
    await userEvent.click(row("Genişlik"))
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
    renderDialog(template())

    await userEvent.click(screen.getByRole("tab", { name: "Şablon bilgisi" }))
    await userEvent.type(screen.getByRole("textbox", { name: /Şablon adı/ }), " ve dekor")
    await userEvent.click(screen.getByRole("tab", { name: "Özellikler (1)" }))
    await userEvent.click(row("Genişlik"))
    expect(screen.queryByRole("combobox", { name: "Grup" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    const body = await savedBody()
    expect(body).not.toHaveProperty("groups")
    const [sent] = body["definitions"] as Record<string, unknown>[]
    expect(sent).toMatchObject({ id: "def_1", key: "genislik" })
    expect(sent).not.toHaveProperty("group")
  })

  it("moves a group up, and a removed group's fields fall back to none", async () => {
    renderDialog(
      template({
        groups: [
          { key: "olculer", name: "Ölçüler", rank: 0 },
          { key: "bakim", name: "Bakım", rank: 1 },
        ],
        definitions: [definition({ group: "olculer" })],
      })
    )

    await userEvent.click(screen.getByRole("tab", { name: "Gruplar (2)" }))
    // Each group says how many attributes it holds
    expect(screen.getByText("1 özellik")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "2. grup: yukarı taşı" }))
    await userEvent.click(screen.getByRole("button", { name: "2. grup: kaldır" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    const body = await savedBody()
    expect(body["groups"]).toEqual([{ key: "bakim", name: "Bakım", rank: 0 }])
    expect(body["definitions"]).toEqual([expect.objectContaining({ id: "def_1", group: null })])
  })
})

const FIRST = template()
const SHOP = [FIRST, template({ id: "tpl_2", name: "Bıçak", handle: "bicak", definitions: [] })]

/** The settings page's part: the shop's templates, one open in the dialog. */
function Walked() {
  const walk = useRecordWalk(SHOP, (each) => each.id)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          walk.show(FIRST)
        }}
      >
        Aç
      </button>
      {walk.open ? (
        <TemplateDialog
          template={walk.open}
          steps={walk.steps}
          templateAt={(index) => SHOP[index]}
          onClose={walk.close}
        />
      ) : null}
    </>
  )
}

describe("TemplateDialog: walking the shop's templates", () => {
  it("goes to the next template in the same dialog, asking before dropping a change", async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Walked />
      </QueryClientProvider>
    )
    await user.click(screen.getByRole("button", { name: "Aç" }))
    const dialog = screen.getByRole("dialog", { name: "Mobilya" })
    expect(within(dialog).getByText("1 / 2")).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Sonraki şablon" }))
    expect(screen.getByRole("dialog", { name: "Bıçak" })).toBe(dialog)
    expect(within(dialog).getByRole("textbox", { name: /Şablon adı/ })).toHaveValue("Bıçak")

    await user.type(within(dialog).getByRole("textbox", { name: /Şablon adı/ }), " seti")
    await user.click(within(dialog).getByRole("button", { name: "Önceki şablon" }))
    await user.click(await screen.findByRole("button", { name: "Değişiklikleri at" }))
    expect(within(dialog).getByRole("textbox", { name: /Şablon adı/ })).toHaveValue("Mobilya")
    expect(within(dialog).getByText("1 / 2")).toBeInTheDocument()
  })
})
