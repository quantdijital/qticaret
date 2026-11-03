import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AddonInput, ProductAddon } from "@/features/products/api/addons"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import { AddonsCard } from "./addons-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// Links as plain anchors: the card is rendered without a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

const ENGRAVING: ProductAddon = {
  id: "ad_1",
  kind: "text",
  label: "Ürün üzerine yazı",
  help: null,
  required: false,
  max_quantity: 10,
  non_withdrawable: true,
  price: 35,
  text: { max_length: 50, charset: "letters_digits" },
}

const CASE: ProductAddon = {
  id: "ad_2",
  kind: "choice",
  label: "Kılıf",
  help: "Ürünle birlikte gönderilir.",
  required: false,
  max_quantity: null,
  non_withdrawable: false,
  choices: [
    { id: "ch_1", label: "Desenli", price: 300 },
    { id: "ch_2", label: "Desensiz", price: 250 },
  ],
}

const CATALOG: ProductCatalog = {
  condition: "new",
  kind: "physical",
  primary_category_id: null,
  withdrawal_excluded: false,
  restriction: null,
  is_gift_card: false,
  addons: [ENGRAVING, CASE],
  description_doc: null,
  successor: null,
  categories: [],
  variants: [],
}

// The server keeps the ids sent and gives new ones theirs
const stored = (addons: AddonInput[] | null): ProductAddon[] =>
  (addons ?? []).map((addon, index) =>
    addon.kind === "text"
      ? { ...addon, id: addon.id ?? `ad_new${index}`, help: addon.help ?? null }
      : {
          ...addon,
          id: addon.id ?? `ad_new${index}`,
          help: addon.help ?? null,
          choices: addon.choices.map((choice, at) => ({ ...choice, id: choice.id ?? `ch_${at}` })),
        }
  )

interface Init {
  method?: string
  body?: { addons?: AddonInput[] | null }
}

function serve(
  catalog: Partial<ProductCatalog>,
  { flag = true, post }: { flag?: boolean; post?: () => Promise<unknown> } = {}
) {
  fetchMock.mockImplementation((url: string, init?: Init) => {
    if (url === "/admin/features") {
      return Promise.resolve({ features: [{ key: "catalog.addons", enabled: flag }] })
    }
    if (init?.method === "POST") {
      return post
        ? post()
        : Promise.resolve({ ...CATALOG, ...catalog, addons: stored(init.body?.addons ?? null) })
    }
    return Promise.resolve({ ...CATALOG, ...catalog })
  })
}

const renderCard = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AddonsCard productId="prod_1" />
    </QueryClientProvider>
  )

const posted = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as Init | undefined)?.method === "POST")

const NEW_TEXT = {
  kind: "text",
  label: "Hediye notu",
  help: null,
  required: false,
  max_quantity: null,
  non_withdrawable: false,
  price: 0,
  text: { max_length: 50, charset: "letters_digits" },
}

describe("AddonsCard (adr/0052)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    serve({})
  })

  it("lists each add-on with its kind, price, rules and the withdrawal badge", async () => {
    renderCard()
    const rows = within(await screen.findByRole("list")).getAllByRole("listitem")
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent("Ürün üzerine yazı")
    expect(rows[0]).toHaveTextContent(
      "Yazı · +₺35,00 · En çok 50 karakter, harf ve rakam · Satırda en çok 10 adet"
    )
    // The badge on the engraving alone
    expect(screen.getAllByText("Cayma dışı")).toHaveLength(1)
    expect(screen.getByText("Cayma dışı").closest("li")).toBe(rows[0])
    expect(rows[1]).toHaveTextContent("Seçim · +₺250,00 – +₺300,00 · 2 seçenek")
    expect(screen.getByText(/Örnek: Ürün üzerine yazı, \+35 TL/)).toBeInTheDocument()
  })

  it("adds one from the sheet, saving the whole list with ids kept and the new one without", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("button", { name: "Ek seçenek ekle" }))
    const sheet = screen.getByRole("dialog")
    await user.type(within(sheet).getByLabelText(/^Ad\*?$/), "Hediye notu")
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
        method: "POST",
        // As stored, ids and all: a dropped id would stop the carts holding it
        body: { addons: [ENGRAVING, CASE, NEW_TEXT] },
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(3)
  })

  it("refuses a required paid add-on before anything is sent", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("button", { name: "Ek seçenek ekle" }))
    const sheet = screen.getByRole("dialog")
    await user.type(within(sheet).getByLabelText(/^Ad\*?$/), "Hediye notu")
    await user.type(within(sheet).getByLabelText("Fiyat (TL)"), "35")
    await user.click(within(sheet).getByRole("switch", { name: "Zorunlu" }))
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "Ücretli ek seçenek zorunlu olamaz."
    )
    expect(posted()).toHaveLength(0)

    // Free, it may be required
    await user.clear(within(sheet).getByLabelText("Fiyat (TL)"))
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(posted()).toHaveLength(1)
    })
    const body = (posted()[0]?.[1] as Init).body
    expect(body?.addons?.[2]).toEqual({ ...NEW_TEXT, required: true })
  })

  it("starts a choice add-on with two options and never goes below two", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("button", { name: "Ek seçenek ekle" }))
    const sheet = screen.getByRole("dialog")
    await user.click(within(sheet).getByRole("radio", { name: "Seçim" }))
    await user.type(within(sheet).getByLabelText(/^Ad\*?$/), "Paket")

    const first = within(sheet).getByRole("button", { name: "1. seçenek: kaldır" })
    expect(first).toBeDisabled()
    expect(within(sheet).getByRole("button", { name: "2. seçenek: kaldır" })).toBeDisabled()
    await user.click(within(sheet).getByRole("button", { name: "Seçenek ekle" }))
    expect(first).toBeEnabled()
    await user.click(first)
    expect(within(sheet).getByRole("button", { name: "1. seçenek: kaldır" })).toBeDisabled()

    // An option without a name is refused here
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))
    expect(await within(sheet).findAllByText("Seçeneğin adı 1-60 karakter olmalı.")).toHaveLength(2)
    expect(posted()).toHaveLength(0)

    await user.type(within(sheet).getByLabelText("1. seçeneğin adı"), "Kutulu")
    await user.type(within(sheet).getByLabelText("1. seçeneğin fiyatı"), "20")
    await user.type(within(sheet).getByLabelText("2. seçeneğin adı"), "Kutusuz")
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(posted()).toHaveLength(1)
    })
    expect((posted()[0]?.[1] as Init).body?.addons?.[2]).toEqual({
      kind: "choice",
      label: "Paket",
      help: null,
      required: false,
      max_quantity: null,
      non_withdrawable: false,
      choices: [
        { label: "Kutulu", price: 20 },
        { label: "Kutusuz", price: 0 },
      ],
    })
  })

  it("reorders and removes in the list, saved with the card", async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole("button", { name: "Ürün üzerine yazı: aşağı taşı" }))
    await user.click(screen.getByRole("button", { name: "Ürün üzerine yazı: kaldır" }))
    // A removed add-on stops the carts holding it at checkout: said before saving
    expect(screen.getByRole("status")).toHaveTextContent("ödemeden önce seçimlerini değiştirmek")
    await user.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(posted()).toHaveLength(1)
    })
    const sent = (posted()[0]?.[1] as Init).body?.addons ?? []
    expect(sent.map((addon) => addon.id)).toEqual(["ad_2"])
  })

  it("is not shown while the shop's add-ons are off and the product has none", async () => {
    serve({ addons: [] }, { flag: false })
    renderCard()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/features")
    })
    expect(screen.queryByText("Ek seçenekler")).toBeNull()
  })

  it("shows a product's add-ons while the flag is off, unchangeable, with where to turn it on", async () => {
    serve({}, { flag: false })
    renderCard()
    const note = await screen.findByRole("status")
    expect(note).toHaveTextContent("Ek seçenekler kapalı")
    expect(within(note).getByRole("link", { name: "Özelliklere git" })).toHaveAttribute(
      "href",
      "/settings/features"
    )
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.queryByRole("button", { name: "Ek seçenek ekle" })).toBeNull()
    expect(screen.queryByRole("button", { name: /düzenle$/ })).toBeNull()
  })

  it("says the shop's add-ons are off when the server refuses so, linking to the features", async () => {
    const user = userEvent.setup()
    serve(
      {},
      {
        post: () =>
          Promise.reject(
            Object.assign(new Error("Ek seçenekler kapalı."), {
              status: 400,
              code: "catalog.addons_disabled",
            })
          ),
      }
    )
    renderCard()
    await user.click(await screen.findByRole("button", { name: "Ürün üzerine yazı: düzenle" }))
    const sheet = screen.getByRole("dialog")
    // A saved add-on keeps its kind
    expect(within(sheet).getByRole("radio", { name: "Seçim" })).toBeDisabled()
    await user.click(within(sheet).getByRole("button", { name: "Kaydet" }))

    const alert = await within(sheet).findByRole("alert")
    expect(alert).toHaveTextContent("Açmak için Ayarlar > Özellikler'e gidin.")
    expect(within(alert).getByRole("link", { name: "Özelliklere git" })).toHaveAttribute(
      "href",
      "/settings/features"
    )
  })
})
