import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AddonTemplate } from "@/features/products/api/addon-templates"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import { AddonsCard } from "@/features/products/detail/addons-card"
import { AddonTemplatePage } from "./addon-template-page"

const fetchMock = vi.hoisted(() => vi.fn())
const productsMock = vi.hoisted(() => vi.fn())
const categoriesMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: { product: { list: productsMock }, productCategory: { list: categoriesMock } },
  },
}))
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
  },
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  getRouteApi: () => ({ useParams: () => ({ id: "adtpl_1" }) }),
  useNavigate: () => vi.fn(),
}))

const TEMPLATE: AddonTemplate = {
  id: "adtpl_1",
  name: "Kazıma",
  addons: [
    {
      id: "ad_t1",
      kind: "text",
      label: "Bıçağa isim kazıma",
      help: null,
      required: false,
      max_quantity: null,
      non_withdrawable: true,
      price: 150,
      text: { max_length: 30, charset: "letters_digits" },
    },
  ],
  product_count: 3,
  attribute_templates: [],
}

const CATALOG: ProductCatalog = {
  condition: "new",
  kind: "physical",
  primary_category_id: null,
  withdrawal_excluded: false,
  restriction: null,
  is_gift_card: false,
  addons: [],
  addon_templates: [{ id: "adtpl_old", name: "Eski", addons: [], via: "product" }],
  addons_hidden: 0,
  description_doc: null,
  summary_doc: null,
  successor: null,
  categories: [],
  variants: [],
}

const SUMMARY = {
  action: "addon_template",
  products: 40,
  changed: 37,
  unchanged: 0,
  skipped: 3,
  failed: 0,
}

interface Init {
  method?: string
  body?: Record<string, unknown>
}

function serve(catalog: Partial<ProductCatalog> = {}) {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/features") {
      return Promise.resolve({ features: [{ key: "catalog.addons", enabled: true }] })
    }
    if (url === "/admin/async-jobs" && init?.method === "POST") {
      return Promise.resolve({ async_job: { id: "job_1", status: "queued", progress: 0 } })
    }
    if (url.startsWith("/admin/async-jobs/")) {
      return Promise.resolve({
        async_job: {
          id: "job_1",
          status: "succeeded",
          progress: 100,
          has_result: true,
          result_summary: SUMMARY,
          error_message: null,
        },
      })
    }
    if (url === "/admin/addon-templates" && init?.method === "POST") {
      return Promise.resolve({
        addon_template: { ...TEMPLATE, id: "adtpl_new", name: init.body?.["name"] },
      })
    }
    if (url.endsWith("/addon-templates") && init?.method === "POST") {
      return Promise.resolve({ ...CATALOG, ...catalog })
    }
    if (url.startsWith("/admin/addon-templates")) {
      return Promise.resolve({ addon_template: TEMPLATE, addon_templates: [TEMPLATE] })
    }
    return Promise.resolve({ ...CATALOG, ...catalog })
  })
}

const wrap = (ui: ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>
  )

const posts = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as Init | undefined)?.method === "POST")
const postTo = (url: string) => posts().find(([to]) => to === url)?.[1] as Init | undefined

async function openNewAddon(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Ek seçenek ekle" }))
  const dialog = screen.getByRole("dialog")
  await user.type(within(dialog).getByLabelText(/^Ad\*?$/), "Bıçağa isim kazıma")
  return dialog
}

describe("a new add-on's scope on the product page (2026-11-23)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.mocked(toast.warning).mockReset()
    serve()
  })

  it("keeps the product's own list by default", async () => {
    const user = userEvent.setup()
    wrap(<AddonsCard productId="prod_1" />)
    const dialog = await openNewAddon(user)
    expect(within(dialog).getByRole("radio", { name: "Yalnız bu ürün" })).toBeChecked()
    expect(within(dialog).queryByRole("radio", { name: "Tüm ürünler" })).toBeNull()
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(postTo("/admin/products/prod_1/catalog")).toBeDefined()
    })
    expect(postTo("/admin/addon-templates")).toBeUndefined()
  })

  it("saves it as a template named after it and applies it to every product, then says what the job did", async () => {
    const user = userEvent.setup()
    wrap(<AddonsCard productId="prod_1" />)
    const dialog = await openNewAddon(user)
    await user.click(within(dialog).getByRole("radio", { name: "Grup olarak kaydet ve uygula" }))
    expect(within(dialog).getByRole("radio", { name: "Tüm ürünler" })).toBeChecked()
    // No category on the product: that target is not offered
    expect(
      within(dialog).getByRole("radio", { name: "Bu ürünün kategorisindeki ürünler" })
    ).toBeDisabled()
    expect(within(dialog).getByLabelText("Grup adı")).toHaveAttribute(
      "placeholder",
      "Bıçağa isim kazıma"
    )
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(postTo("/admin/async-jobs")).toBeDefined()
    })
    const created = postTo("/admin/addon-templates")?.body
    expect(created?.["name"]).toBe("Bıçağa isim kazıma")
    expect((created?.["addons"] as { label: string; id?: string }[])[0]).toMatchObject({
      label: "Bıçağa isim kazıma",
    })
    expect(postTo("/admin/async-jobs")?.body).toEqual({
      type: "catalog.bulk_edit",
      input: {
        scope: { kind: "all" },
        change: { action: "addon_template", mode: "add", template_id: "adtpl_new" },
      },
    })
    // Not the product's own add-on
    expect(postTo("/admin/products/prod_1/catalog")).toBeUndefined()
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "37 ürün güncellendi.",
        expect.objectContaining({
          id: "bulk-job-job_1",
          description: expect.stringContaining("3 ürün atlandı") as unknown,
          action: expect.objectContaining({ label: "Raporu indir" }) as unknown,
        })
      )
    })
  })

  it("applies it to the product's category under the name typed", async () => {
    serve({
      primary_category_id: "pcat_2",
      categories: [
        { id: "pcat_1", name: "Mutfak" },
        { id: "pcat_2", name: "Bıçaklar" },
      ],
    })
    const user = userEvent.setup()
    wrap(<AddonsCard productId="prod_1" />)
    const dialog = await openNewAddon(user)
    await user.click(within(dialog).getByRole("radio", { name: "Grup olarak kaydet ve uygula" }))
    await user.click(
      within(dialog).getByRole("radio", {
        name: "Bu ürünün kategorisindeki ürünler (Bıçaklar)",
      })
    )
    await user.type(within(dialog).getByLabelText("Grup adı"), "Kazıma hizmeti")
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(postTo("/admin/async-jobs")).toBeDefined()
    })
    expect(postTo("/admin/addon-templates")?.body?.["name"]).toBe("Kazıma hizmeti")
    expect(postTo("/admin/async-jobs")?.body?.["input"]).toMatchObject({
      scope: { kind: "category", category_id: "pcat_2" },
    })
  })

  it("links it to this product alone without a job, keeping the templates linked already", async () => {
    const user = userEvent.setup()
    wrap(<AddonsCard productId="prod_1" />)
    const dialog = await openNewAddon(user)
    await user.click(within(dialog).getByRole("radio", { name: "Grup olarak kaydet ve uygula" }))
    await user.click(within(dialog).getByRole("radio", { name: "Bu ürün" }))
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(postTo("/admin/products/prod_1/addon-templates")?.body).toEqual({
        template_ids: ["adtpl_old", "adtpl_new"],
      })
    })
    expect(postTo("/admin/async-jobs")).toBeUndefined()
  })
})

describe("'Ürünlere uygula' on a template's page (2026-11-23)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve()
    categoriesMock.mockResolvedValue({
      product_categories: [
        { id: "pcat_1", name: "Mutfak", handle: "mutfak", parent_category_id: null, rank: 0 },
        { id: "pcat_2", name: "Bıçaklar", handle: "bicak", parent_category_id: "pcat_1", rank: 0 },
      ],
    })
    productsMock.mockResolvedValue({ products: [{ id: "prod_9", title: "Şef bıçağı" }] })
  })

  it("removes it from a category's products and shows the job's outcome, reading the usage again", async () => {
    const user = userEvent.setup()
    wrap(<AddonTemplatePage />)
    await user.click(await screen.findByRole("button", { name: "Ürünlere uygula" }))
    const dialog = screen.getByRole("dialog", { name: "Ürünlere uygula" })
    await user.click(within(dialog).getByRole("radio", { name: "Kaldır" }))
    await user.click(within(dialog).getByRole("radio", { name: "Kategori" }))
    // Nothing picked: said, nothing sent
    await user.click(within(dialog).getByRole("button", { name: "Kaldır" }))
    expect(await within(dialog).findByText("Bir kategori seçin.")).toBeInTheDocument()
    expect(postTo("/admin/async-jobs")).toBeUndefined()

    await user.click(within(dialog).getByRole("combobox", { name: "Kategori" }))
    await user.click(await screen.findByRole("option", { name: "Mutfak › Bıçaklar" }))
    const reads = () =>
      fetchMock.mock.calls.filter(([url]) => url === "/admin/addon-templates/adtpl_1").length
    const before = reads()
    await user.click(within(dialog).getByRole("button", { name: "Kaldır" }))

    await waitFor(() => {
      expect(postTo("/admin/async-jobs")?.body).toEqual({
        type: "catalog.bulk_edit",
        input: {
          scope: { kind: "category", category_id: "pcat_2" },
          change: { action: "addon_template", mode: "remove", template_id: "adtpl_1" },
        },
      })
    })
    expect(await within(dialog).findByText("37 ürün güncellendi.")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Raporu indir" })).toBeInTheDocument()
    await waitFor(() => {
      expect(reads()).toBeGreaterThan(before)
    })
  })

  it("links it to products picked one by one", async () => {
    const user = userEvent.setup()
    wrap(<AddonTemplatePage />)
    await user.click(await screen.findByRole("button", { name: "Ürünlere uygula" }))
    const dialog = screen.getByRole("dialog", { name: "Ürünlere uygula" })
    expect(within(dialog).getByRole("radio", { name: "Ekle" })).toBeChecked()
    await user.click(within(dialog).getByRole("radio", { name: "Seçili ürünler" }))
    await user.click(within(dialog).getByRole("combobox", { name: "Ürünler" }))
    await user.click(await screen.findByRole("option", { name: "Şef bıçağı" }))
    await user.click(within(dialog).getByRole("button", { name: "Ekle" }))

    await waitFor(() => {
      expect(postTo("/admin/async-jobs")?.body).toEqual({
        type: "catalog.bulk_edit",
        input: {
          product_ids: ["prod_9"],
          change: { action: "addon_template", mode: "add", template_id: "adtpl_1" },
        },
      })
    })
  })
})
