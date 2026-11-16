import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AttributeDefinition, AttributeTemplate } from "@/features/attributes/types"
import { TemplateDialog } from "./template-dialog"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

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
  aliases: [],
  ...more,
})

const SAVED: AttributeTemplate = {
  id: "tpl_1",
  name: "Mobilya",
  handle: "mobilya",
  description: null,
  groups: null,
  definitions: [
    definition(),
    definition({
      id: "def_2",
      key: "malzeme",
      label: "Malzeme",
      type: "select",
      unit: null,
      options: [{ value: "mese", label: "Meşe" }],
      rank: 1,
      is_required: true,
      is_filterable: true,
      aliases: ["Ahşap türü"],
    }),
    definition({
      id: "def_3",
      key: "not",
      label: "İç not",
      type: "text",
      unit: null,
      rank: 2,
      is_public: false,
    }),
  ],
}

const URL = "/admin/attribute-templates/tpl_1"

function renderDialog(saved: AttributeTemplate | null = SAVED) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TemplateDialog template={saved} onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

/** A folded attribute's line (its menu button is named after it too). */
const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}(?!:)`) })
const itemOf = (name: string) => row(name).closest("li") as HTMLElement

/** The labels of the definitions the one save sent, in order. */
async function sentDefinitions(): Promise<Record<string, unknown>[]> {
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalled()
  })
  const [, init] = fetchMock.mock.calls[0] as [string, { body: Record<string, unknown> }]
  return init.body["definitions"] as Record<string, unknown>[]
}

describe("TemplateDialog: the attributes tab", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ attribute_template: SAVED })
    vi.mocked(toast.error).mockClear()
  })

  it("shows each attribute on one line, badges only for what is on", () => {
    renderDialog()
    expect(within(itemOf("Genişlik")).queryByText("Zorunlu")).toBeNull()
    const material = itemOf("Malzeme")
    expect(within(material).getByText("Tek seçim")).toBeInTheDocument()
    expect(within(material).getByText("Zorunlu")).toBeInTheDocument()
    expect(within(material).getByText("Filtre")).toBeInTheDocument()
    expect(within(itemOf("İç not")).getByText("Vitrinde gizli")).toBeInTheDocument()
    // Folded: no field shows
    expect(screen.queryByRole("textbox", { name: /Özellik adı/ })).toBeNull()
  })

  it("opens one attribute at a time, the advanced part folded and counted", async () => {
    renderDialog()
    await userEvent.click(row("Genişlik"))
    expect(screen.getByRole("textbox", { name: /Özellik adı/ })).toHaveValue("Genişlik")
    expect(screen.getByRole("textbox", { name: "Birim" })).toHaveValue("cm")

    await userEvent.click(row("Malzeme"))
    expect(screen.getAllByRole("textbox", { name: /Özellik adı/ })).toHaveLength(1)
    expect(screen.getByRole("textbox", { name: /Özellik adı/ })).toHaveValue("Malzeme")
    // A choice: its options; a number's unit is gone
    expect(screen.getByText("Meşe")).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Birim" })).toBeNull()

    const advanced = screen.getByRole("button", { name: /Gelişmiş/ })
    expect(advanced).toHaveTextContent("1 ayar açık")
    expect(screen.queryByText("Ahşap türü")).toBeNull()
    await userEvent.click(advanced)
    expect(screen.getByText("Ahşap türü")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Arama başlığında öne çıkar" })).not.toBeChecked()
  })

  it("turning off the shop's view turns off its filter too", async () => {
    renderDialog()
    await userEvent.click(row("Malzeme"))
    await userEvent.click(screen.getByRole("switch", { name: "Vitrinde göster" }))
    expect(screen.getByRole("switch", { name: "Mağazada filtre olsun" })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    const [, material] = await sentDefinitions()
    expect(material).toMatchObject({ is_public: false, is_filterable: false })
  })

  it("adds an attribute open, the caret in its name", async () => {
    renderDialog()
    await userEvent.click(row("Genişlik"))
    await userEvent.click(screen.getByRole("button", { name: "Özellik ekle" }))

    const name = screen.getByRole("textbox", { name: /Özellik adı/ })
    expect(name).toHaveValue("")
    await waitFor(() => {
      expect(name).toHaveFocus()
    })
    await userEvent.type(name, "Ağırlık")
    expect(screen.getByRole("tab", { name: "Özellikler (4)" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    const sent = await sentDefinitions()
    expect(sent.map((each) => each["label"])).toEqual(["Genişlik", "Malzeme", "İç not", "Ağırlık"])
    expect(sent[3]).toMatchObject({ key: "agirlik", rank: 3 })
  })

  it("moves an attribute from its menu", async () => {
    renderDialog()
    await userEvent.click(screen.getByRole("button", { name: "Genişlik: işlemler" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Aşağı taşı" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    const sent = await sentDefinitions()
    expect(sent.map((each) => [each["label"], each["rank"]])).toEqual([
      ["Malzeme", 0],
      ["Genişlik", 1],
      ["İç not", 2],
    ])
  })

  it("moves an attribute by dragging it onto another", async () => {
    renderDialog()
    const handle = itemOf("İç not").querySelector("[draggable=true]")
    if (!handle) throw new Error("no drag handle")
    const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn() }

    fireEvent.dragStart(handle, { dataTransfer })
    // jsdom's boxes have no height: the pointer is in the lower half, after the row
    fireEvent.dragOver(itemOf("Genişlik"), { dataTransfer, clientY: 10 })
    fireEvent.drop(itemOf("Genişlik"), { dataTransfer, clientY: 10 })
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    const sent = await sentDefinitions()
    expect(sent.map((each) => each["label"])).toEqual(["Genişlik", "İç not", "Malzeme"])
  })

  it("asks before removing a saved attribute's values", async () => {
    renderDialog()
    await userEvent.click(screen.getByRole("button", { name: "Malzeme: işlemler" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Özelliği kaldır" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByText(/Malzeme özelliği ürünlerde değer taşıyor/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Kaldır ve kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(url).toBe(URL)
    expect(init.body).toMatchObject({ confirm_delete_values: true })
    expect((init.body["definitions"] as unknown[]).length).toBe(2)
  })
})

describe("TemplateDialog: a new template", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.mocked(toast.error).mockClear()
  })

  it("opens on its name and will not save without one", async () => {
    renderDialog(null)
    expect(screen.getByRole("tab", { name: "Şablon bilgisi" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    await userEvent.click(screen.getByRole("tab", { name: "Özellikler (0)" }))
    expect(screen.getByText("Bu şablonda henüz özellik yok.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Özellik ekle" }))
    await userEvent.type(screen.getByRole("textbox", { name: /Özellik adı/ }), "Renk")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(toast.error).toHaveBeenCalledWith("Şablona bir ad verin.")
    expect(fetchMock).not.toHaveBeenCalled()
    // Back to the name, the caret in it
    expect(screen.getByRole("tab", { name: "Şablon bilgisi" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByRole("textbox", { name: /Şablon adı/ })).toHaveFocus()
  })
})
