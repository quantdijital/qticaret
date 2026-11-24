import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AddonTemplate } from "@/features/products/api/addon-templates"
import type { ProductAddon } from "@/features/products/api/addons"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import { AddonsCard } from "@/features/products/detail/addons-card"
import { AddonTemplatePage } from "./addon-template-page"
import { carryOutcome } from "./carry-check"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Links as plain anchors: rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  getRouteApi: () => ({ useParams: () => ({ id: "adtpl_1" }) }),
  useNavigate: () => vi.fn(),
}))

const addon = (id: string, label: string, price = 150): ProductAddon => ({
  id,
  kind: "text",
  label,
  help: null,
  required: false,
  max_quantity: null,
  non_withdrawable: true,
  price,
  text: { max_length: 30, charset: "letters_digits" },
})

const ENGRAVING: AddonTemplate = {
  id: "adtpl_1",
  name: "Kazıma",
  addons: [addon("ad_t1", "Bıçağa isim kazıma")],
  product_count: 3,
  attribute_templates: [{ id: "atpl_1", name: "Bıçak" }],
}
const BIG: AddonTemplate = {
  id: "adtpl_2",
  name: "Paket",
  addons: [addon("ad_b1", "A"), addon("ad_b2", "B"), addon("ad_b3", "C"), addon("ad_b4", "D")],
  product_count: 0,
  attribute_templates: [],
}
const GIFT: AddonTemplate = {
  id: "adtpl_3",
  name: "Hediye",
  addons: [addon("ad_g1", "Hediye notu", 0)],
  product_count: 0,
  attribute_templates: [],
}

const CATALOG: ProductCatalog = {
  condition: "new",
  kind: "physical",
  primary_category_id: null,
  withdrawal_excluded: false,
  restriction: null,
  is_gift_card: false,
  addons: [addon("ad_own", "Kılıf yazısı", 20)],
  addon_templates: [
    { id: "adtpl_1", name: "Kazıma", addons: ENGRAVING.addons, via: "product" },
    {
      id: "adtpl_9",
      name: "Bıçak ekleri",
      addons: [addon("ad_c1", "Sap")],
      via: "attribute_template",
    },
  ],
  addons_hidden: 0,
  description_doc: null,
  summary_doc: null,
  successor: null,
  categories: [],
  variants: [],
}

interface Init {
  method?: string
  body?: Record<string, unknown>
}

function serve() {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/features") {
      return Promise.resolve({ features: [{ key: "catalog.addons", enabled: true }] })
    }
    if (url === "/admin/addon-templates" && init?.method !== "POST") {
      return Promise.resolve({ addon_templates: [ENGRAVING, BIG, GIFT] })
    }
    if (url.endsWith("/addon-templates") && init?.method === "POST") {
      return Promise.resolve(CATALOG)
    }
    if (url.startsWith("/admin/addon-templates") && init?.method === "POST") {
      const body = init.body ?? {}
      return Promise.resolve({
        addon_template: { ...ENGRAVING, ...body, addons: ENGRAVING.addons },
      })
    }
    if (url.startsWith("/admin/addon-templates")) {
      return Promise.resolve({ addon_template: ENGRAVING })
    }
    return Promise.resolve(CATALOG)
  })
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
const posts = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as Init | undefined)?.method === "POST")

describe("add-on templates on the product's card (adr/0052 Ek 2026-11-23)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve()
  })

  it("shows each template's add-ons read-only, with how the product reaches it", async () => {
    render(
      <QueryClientProvider client={client()}>
        <AddonsCard productId="prod_1" />
      </QueryClientProvider>
    )
    const linked = await screen.findByRole("region", { name: "Kazıma" })
    const carried = screen.getByRole("region", { name: "Bıçak ekleri" })
    expect(within(linked).getByText("Bıçağa isim kazıma")).toBeTruthy()
    expect(within(linked).getByText("Grup")).toBeTruthy()
    expect(within(carried).getByText("Özellik grubundan")).toBeTruthy()
    // Read-only: no edit buttons on a template's add-on, only on the product's own
    expect(within(linked).queryByRole("button", { name: /düzenle$/ })).toBeNull()
    expect(screen.getByRole("button", { name: "Kılıf yazısı: düzenle" })).toBeTruthy()
    // Only one linked here can be unlinked here
    expect(within(linked).getByRole("button", { name: "Kaldır" })).toBeTruthy()
    expect(within(carried).queryByRole("button", { name: "Kaldır" })).toBeNull()
  })

  it("unlinks a template, sending the rest of the list", async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client()}>
        <AddonsCard productId="prod_1" />
      </QueryClientProvider>
    )
    const linked = await screen.findByRole("region", { name: "Kazıma" })
    await user.click(within(linked).getByRole("button", { name: "Kaldır" }))
    await waitFor(() => {
      expect(posts()).toHaveLength(1)
    })
    expect(posts()[0]).toEqual([
      "/admin/products/prod_1/addon-templates",
      { method: "POST", body: { template_ids: [] } },
    ])
  })

  it("links a template that fits; one past the five is shown, not offered", async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client()}>
        <AddonsCard productId="prod_1" />
      </QueryClientProvider>
    )
    await user.click(await screen.findByRole("button", { name: "Grup ekle" }))
    const dialog = await screen.findByRole("dialog")
    // Three used of five: a template of four does not fit
    const big = await within(dialog).findByRole("radio", { name: /Paket/ })
    expect(big).toHaveProperty("disabled", true)
    expect(within(dialog).queryByRole("radio", { name: /Kazıma/ })).toBeNull()
    await user.click(within(dialog).getByRole("radio", { name: /Hediye/ }))
    await user.click(within(dialog).getByRole("button", { name: "Ekle" }))
    await waitFor(() => {
      expect(posts()).toHaveLength(1)
    })
    expect(posts()[0]?.[1]).toEqual({
      method: "POST",
      body: { template_ids: ["adtpl_1", "adtpl_3"] },
    })
  })
})

describe("the add-on template's page", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve()
  })

  it("shows the add-ons and who uses the template, in one window", async () => {
    render(
      <QueryClientProvider client={client()}>
        <AddonTemplatePage />
      </QueryClientProvider>
    )
    expect(await screen.findByRole("heading", { name: "Kazıma", level: 1 })).toBeTruthy()
    expect(screen.getByText("Bıçağa isim kazıma")).toBeTruthy()
    expect(screen.getByText("3 ürün")).toBeTruthy()
    expect(screen.getByText("Bıçak")).toBeTruthy()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("edits an add-on in the one add-on dialog and saves the whole list with its id", async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client()}>
        <AddonTemplatePage />
      </QueryClientProvider>
    )
    await user.click(await screen.findByRole("button", { name: "Bıçağa isim kazıma: düzenle" }))
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    const label = within(screen.getByRole("dialog")).getByLabelText(/^Ad/)
    await user.type(label, " (isim)")
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(posts()).toHaveLength(1)
    })
    const [url, init] = posts()[0] as [string, Init]
    expect(url).toBe("/admin/addon-templates/adtpl_1")
    expect(init.body?.["addons"]).toEqual([
      expect.objectContaining({ id: "ad_t1", label: "Bıçağa isim kazıma (isim)", price: 150 }),
    ])
    expect(init.body).not.toHaveProperty("name")
  })

  it("renames the template on its own", async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client()}>
        <AddonTemplatePage />
      </QueryClientProvider>
    )
    const name = await screen.findByLabelText(/Grup adı/)
    await user.clear(name)
    await user.type(name, "İsim kazıma")
    const [nameSave] = screen.getAllByRole("button", { name: "Kaydet" })
    if (!nameSave) {
      throw new Error("the name card has no save")
    }
    await user.click(nameSave)
    await waitFor(() => {
      expect(posts()).toHaveLength(1)
    })
    expect(posts()[0]?.[1]).toEqual({ method: "POST", body: { name: "İsim kazıma" } })
  })
})

describe("changing a product's attribute template: add-ons past five", () => {
  const own = [addon("o1", "A"), addon("o2", "B"), addon("o3", "C")]

  it("counts own, carried and linked as the server does, each once", () => {
    expect(
      carryOutcome({ own, carried: [{ id: "adtpl_1", addons: ENGRAVING.addons }], linked: [] })
    ).toEqual({ hidden: 0, requiredHidden: false })
    expect(
      carryOutcome({
        own,
        carried: [BIG],
        linked: [{ id: "adtpl_2", addons: BIG.addons }],
      })
    ).toEqual({ hidden: 2, requiredHidden: false })
  })

  it("says when a required add-on would be hidden", () => {
    const required = { ...addon("r1", "Zorunlu", 0), required: true }
    expect(
      carryOutcome({
        own,
        carried: [{ id: "adtpl_x", addons: [addon("x1", "X"), addon("x2", "Y")] }],
        linked: [{ id: "adtpl_y", addons: [required] }],
      })
    ).toEqual({ hidden: 1, requiredHidden: true })
  })
})
