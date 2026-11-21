import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductDetail } from "@/features/products/api/products"
import { OrganizeCard } from "./organize-card"

const sdkFetch = vi.hoisted(() => vi.fn())
const admin = vi.hoisted(() => ({
  product: { update: vi.fn() },
  productTag: { create: vi.fn() },
}))
const netFetch = vi.fn()
// The tree stands in as the ids it holds
const treeValue = vi.hoisted(() => ({ ids: [] as string[] }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => true }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock("@qticaret/admin-ui/patterns/search-picker", () => ({ SearchPicker: () => null }))
vi.mock("@/features/products/components/vat-select", () => ({ VatSelect: () => null }))
vi.mock("@/features/products/components/category-tree", () => ({
  CategoryTree: ({ value }: { value: string[] }) => {
    treeValue.ids = value
    return <output aria-label="tree">{value.join(",")}</output>
  },
}))

const PRODUCT = {
  id: "prod_1",
  title: "Keten Gömlek",
  categories: [{ id: "pcat_1", name: "Giyim" }],
  tags: [{ id: "ptag_1", value: "pamuklu" }],
  type: null,
  brand: null,
  collection: null,
} as unknown as ProductDetail

const task = (id: string) => ({
  id,
  capability: "text",
  mode: "sync",
  options: [],
  allowed: true,
  usable: ["deepseek"],
  preference: null,
})

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const suggestion = (taskId: string, picks: unknown) => ({
  suggestion: {
    id: `sug_${taskId}`,
    task: taskId,
    service: "deepseek",
    status: "draft",
    text: JSON.stringify(picks),
    candidates: [JSON.stringify(picks)],
    picks,
    problems: [],
    alternatives: [],
  },
})

function setup() {
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/ai/services"
        ? {
            services: [],
            tasks: [task("product_tags"), task("product_category")],
            flags: { own_keys: true },
          }
        : { rates: [], default: null }
    )
  )
  netFetch.mockImplementation((url: string, init: { body: string }) => {
    if (url.endsWith("/accept") || url.endsWith("/dismiss")) {
      return json(200, { suggestion: { id: "x", text: "" } })
    }
    const body = JSON.parse(init.body) as { task: string }
    return json(
      201,
      body.task === "product_tags"
        ? suggestion("product_tags", {
            picked: [
              { id: "ptag_2", name: "keten" },
              { id: "ptag_1", name: "pamuklu" },
            ],
            new_tags: ["yaz sezonu"],
          })
        : suggestion("product_category", {
            picked: [{ id: "pcat_2", name: "Giyim > Gömlek" }],
            new_tags: [],
          })
    )
  })
  admin.product.update.mockReset().mockResolvedValue({ product: PRODUCT })
  admin.productTag.create.mockReset().mockResolvedValue({ product_tag: { id: "ptag_new" } })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <OrganizeCard product={PRODUCT} />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const urls = () => netFetch.mock.calls.map(([url]) => String(url))

beforeEach(() => {
  sdkFetch.mockReset()
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("OrganizeCard's AI picks (adr/0074 §5 madde 2)", () => {
  it("shows the product's tags on its line", () => {
    setup()
    expect(screen.getByText("pamuklu")).toBeInTheDocument()
  })

  it("adds a suggested category as a chip click, recorded once, and saves it with the form", async () => {
    const user = setup()
    await user.click(screen.getByRole("button", { name: /düzenle/i }))
    const dialog = await screen.findByRole("dialog")
    await user.click(await within(dialog).findByRole("button", { name: "Kategori öner" }))
    await user.click(await within(dialog).findByRole("button", { name: "Giyim > Gömlek ekle" }))

    expect(within(dialog).getByLabelText("tree")).toHaveTextContent("pcat_1,pcat_2")
    expect(within(dialog).getByRole("button", { name: "Giyim > Gömlek eklendi" })).toBeDisabled()
    await waitFor(() => {
      expect(urls()).toEqual([
        "/admin/ai/suggestions",
        "/admin/ai/suggestions/sug_product_category/accept",
      ])
    })
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(admin.product.update).toHaveBeenCalledWith("prod_1", {
        categories: [{ id: "pcat_1" }, { id: "pcat_2" }],
        type_id: null,
      })
    })
  })

  it("adds an existing tag and a new one; the new one is created only on Save", async () => {
    const user = setup()
    await user.click(screen.getByRole("button", { name: /düzenle/i }))
    const dialog = await screen.findByRole("dialog")
    await user.click(await within(dialog).findByRole("button", { name: "Etiket öner" }))
    // The product's own tag is drawn as added
    expect(await within(dialog).findByRole("button", { name: "pamuklu eklendi" })).toBeDisabled()
    await user.click(within(dialog).getByRole("button", { name: "keten ekle" }))
    await user.click(within(dialog).getByRole("button", { name: "yaz sezonu (yeni) ekle" }))
    expect(admin.productTag.create).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(admin.product.update).toHaveBeenCalledWith("prod_1", {
        tags: [{ id: "ptag_1" }, { id: "ptag_2" }, { id: "ptag_new" }],
      })
    })
    expect(admin.productTag.create).toHaveBeenCalledWith({ value: "yaz sezonu" })
    // One decision for the suggestion, at the first chip
    expect(urls().filter((url) => url.endsWith("/accept"))).toHaveLength(1)
  })

  it("dismisses a suggestion closed with nothing taken, and takes a tag off", async () => {
    const user = setup()
    await user.click(screen.getByRole("button", { name: /düzenle/i }))
    const dialog = await screen.findByRole("dialog")
    await user.click(await within(dialog).findByRole("button", { name: "Etiket öner" }))
    await within(dialog).findByRole("button", { name: "keten ekle" })
    await user.click(within(dialog).getByRole("button", { name: "Önerileri kapat" }))
    await waitFor(() => {
      expect(urls()).toContain("/admin/ai/suggestions/sug_product_tags/dismiss")
    })

    await user.click(within(dialog).getByRole("button", { name: "pamuklu etiketini kaldır" }))
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(admin.product.update).toHaveBeenCalledWith("prod_1", { tags: [] })
    })
  })
})
