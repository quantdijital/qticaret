import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AttributeTemplate } from "@/features/attributes/types"
import { FactsDialog } from "./facts-dialog"
import type { FactsPreview } from "./types"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const TEMPLATE: AttributeTemplate = {
  id: "atpl_1",
  name: "Genel",
  handle: "genel",
  description: null,
  groups: null,
  definitions: [
    {
      id: "def_1",
      key: "uzunluk",
      label: "Uzunluk",
      type: "number",
      unit: "cm",
      options: null,
      rank: 0,
      is_required: false,
      is_filterable: false,
      is_seo_highlight: false,
      scope: "product",
      option_title: null,
      varies_by: null,
    },
  ],
}

const counts = (more: Partial<FactsPreview["counts"]> = {}): FactsPreview["counts"] => ({
  products: 1,
  with_facts: 1,
  no_template: 0,
  ready: 1,
  same: 0,
  filled: 0,
  unparsed: 0,
  conflict: 0,
  ambiguous: 0,
  unmatched: 1,
  ...more,
})

const PREVIEW: FactsPreview = {
  products: [
    {
      id: "prod_1",
      title: "Masa lambası",
      template_id: "atpl_1",
      template_given: false,
      source: "doc",
      rows: [
        {
          label: "Uzunluk",
          value: "220 mm",
          source_path: "content.1.content.1",
          status: "ready",
          field: "uzunluk",
          value_parsed: 22,
        },
        {
          label: "Garanti",
          value: "2 yıl",
          source_path: "content.1.content.2",
          status: "unmatched",
        },
      ],
    },
  ],
  suggestions: [
    {
      template_id: "atpl_1",
      fields: [
        {
          name: "garanti",
          label: "Garanti",
          key: "garanti",
          type: "text",
          unit: null,
          options: null,
          group: null,
          products: 1,
          values: ["2 yıl"],
        },
      ],
    },
  ],
  counts: counts(),
  suggested_template_id: null,
}

interface Init {
  method?: string
  body?: Record<string, unknown>
}

const [OWN] = PREVIEW.products as [FactsPreview["products"][number]]

function serve(preview: (body: Record<string, unknown>) => FactsPreview) {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/description-facts/preview") {
      return Promise.resolve(preview(init?.body ?? {}))
    }
    if (url === "/admin/attribute-templates") {
      return Promise.resolve({ attribute_templates: [TEMPLATE], count: 1 })
    }
    if (url === "/admin/async-jobs") {
      return Promise.resolve({ async_job: { id: "job_1", status: "queued" } })
    }
    return Promise.resolve({
      async_job: {
        id: "job_1",
        status: "succeeded",
        has_result: true,
        result_summary: {
          products: 1,
          changed: 1,
          unchanged: 0,
          skipped: 0,
          failed: 0,
          values: 2,
          fields_added: 1,
          aliases_added: 0,
        },
      },
    })
  })
}

function renderDialog(productIds: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <FactsDialog productIds={productIds} onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

describe("FactsDialog (adr/0013 Ek 2026-11-05)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows each row's field and value, and adds a ticked label as a field", async () => {
    serve(() => PREVIEW)
    renderDialog(["prod_1"])
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText("Uzunluk: 22 cm")).toBeTruthy()
    expect(within(dialog).getByText("Yazılacak")).toBeTruthy()
    expect(within(dialog).getByText("Grupta yok")).toBeTruthy()
    await userEvent.click(within(dialog).getByLabelText("Özellik olarak ekle"))
    await userEvent.click(within(dialog).getByRole("button", { name: "Aktar" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/async-jobs",
        expect.objectContaining({ method: "POST" })
      )
    })
    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/admin/async-jobs") as [
      string,
      Init,
    ]
    expect(init.body).toEqual({
      type: "catalog.description_facts",
      input: {
        product_ids: ["prod_1"],
        overwrite: false,
        fields: [
          {
            template_id: "atpl_1",
            label: "Garanti",
            type: "text",
            unit: null,
            options: null,
            group: null,
          },
        ],
        aliases: [],
      },
    })
    expect(await within(dialog).findByText("1 ürüne 2 değer yazıldı.")).toBeTruthy()
  })

  it("reads products without a template against the one their facts fit", async () => {
    serve((body) =>
      body["template_id"]
        ? { ...PREVIEW, counts: counts({ no_template: 0 }) }
        : {
            ...PREVIEW,
            products: [{ ...OWN, template_id: null }],
            suggestions: [],
            counts: counts({ no_template: 1, ready: 0, unmatched: 2 }),
            suggested_template_id: "atpl_1",
          }
    )
    renderDialog(["prod_1"])
    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText("Özellik grubu olmayan 1 ürün için grup")).toBeTruthy()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/description-facts/preview",
        expect.objectContaining({ body: { product_ids: ["prod_1"], template_id: "atpl_1" } })
      )
    })
    expect(await within(dialog).findByText("Uzunluk: 22 cm")).toBeTruthy()
  })

  it("says so when the descriptions state no facts", async () => {
    serve(() => ({
      products: [{ ...OWN, rows: [] }],
      suggestions: [],
      counts: counts({ with_facts: 0, ready: 0, unmatched: 0 }),
      suggested_template_id: null,
    }))
    renderDialog(["prod_1"])
    const dialog = await screen.findByRole("dialog")
    expect(
      await within(dialog).findByText(/Açıklamada aktarılacak özellik bulunamadı/)
    ).toBeTruthy()
    expect(within(dialog).queryByRole("button", { name: "Aktar" })).toBeNull()
  })
})
