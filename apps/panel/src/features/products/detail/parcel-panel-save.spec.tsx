import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DirtyRegistryProvider } from "@qticaret/admin-ui/patterns/dirty-registry"
import { HeaderSaveActions } from "@qticaret/admin-ui/patterns/header-save-actions"
import "@/lib/i18n"
import type { ProductDetail } from "@/features/products/api/products"
import { ParcelPanel } from "./parcel-panel"

const fetchMock = vi.hoisted(() => vi.fn())
const updateMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { product: { update: updateMock } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({ useBlocker: () => ({ status: "idle" }) }))

const PRODUCT = {
  id: "prod_1",
  weight: null,
  length: null,
  width: null,
  height: null,
} as unknown as ProductDetail

// The product's save waits until the test lets it answer: a slow network
let answerSave: () => void = () => undefined

beforeEach(() => {
  fetchMock.mockReset()
  updateMock.mockReset()
  updateMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        answerSave = () => {
          resolve({ product: PRODUCT })
        }
      })
  )
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/catalog")) {
      return Promise.resolve({ shipping_class: null })
    }
    if (url.endsWith("/platform-settings/shipping")) {
      return Promise.resolve({ section: "shipping", version: 1, values: { shipping_classes: [] } })
    }
    if (url.endsWith("/platform-settings/store")) {
      return Promise.resolve({
        section: "store",
        version: 1,
        values: { weight_unit: "g", dimension_unit: "cm" },
      })
    }
    return Promise.resolve({ product: PRODUCT })
  })
})

function renderPage() {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <DirtyRegistryProvider>
        <HeaderSaveActions />
        <ParcelPanel product={PRODUCT} />
      </DirtyRegistryProvider>
    </QueryClientProvider>
  )
  const field = (id: string): HTMLInputElement => {
    const input = view.container.querySelector<HTMLInputElement>(`#${id}`)
    if (!input) {
      throw new Error(`no #${id} yet`)
    }
    return input
  }
  return { field }
}

const productSaved = () =>
  waitFor(() => {
    expect(updateMock).toHaveBeenCalledTimes(1)
  })

const header = () => within(screen.getByRole("group", { name: "Sayfanın kaydı" }))

describe("ParcelPanel: an edit made while 'Kaydet' is on its way stays (docs/06 'Ürün sayfası')", () => {
  it("keeps the edit and leaves 'Kaydet' active again", async () => {
    const { field } = renderPage()
    await waitFor(() => {
      expect(field("detail-weight")).toBeInTheDocument()
    })
    await userEvent.type(field("detail-weight"), "2")
    await userEvent.click(header().getByRole("button", { name: "Kaydet" }))
    await productSaved()
    expect(header().getByRole("button", { name: "Kaydet" })).toBeDisabled()
    // Typed while the server has not answered yet
    await userEvent.type(field("detail-length"), "5")
    answerSave()

    await waitFor(() => {
      expect(header().getByRole("button", { name: "Kaydet" })).toBeEnabled()
    })
    expect(field("detail-weight")).toHaveValue("2")
    expect(field("detail-length")).toHaveValue("5")
  })

  it("rests as 'Kaydedildi' when nothing was typed meanwhile", async () => {
    const { field } = renderPage()
    await waitFor(() => {
      expect(field("detail-weight")).toBeInTheDocument()
    })
    await userEvent.type(field("detail-weight"), "2")
    await userEvent.click(header().getByRole("button", { name: "Kaydet" }))
    await productSaved()
    answerSave()

    expect(await header().findByRole("button", { name: "Kaydedildi" })).toBeDisabled()
    expect(field("detail-weight")).toHaveValue("2")
  })
})
