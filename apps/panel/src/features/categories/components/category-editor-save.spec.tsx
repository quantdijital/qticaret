import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { categoryTreeQuery } from "@/features/categories/api/categories"
import { CategoryEditor } from "./category-editor"

const fetchMock = vi.hoisted(() => vi.fn())
const admin = vi.hoisted(() => ({
  productCategory: { list: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock("sonner", () => ({ toast: toastMock }))

// The server's copy: the tree reads it, a save answers and changes it
let stored = {
  id: "sef",
  name: "Şef bıçakları",
  handle: "sef",
  description: "",
  parent_category_id: null as string | null,
  rank: 0,
  is_active: true,
  is_internal: false,
  updated_at: "2026-11-01T10:00:00Z",
}
// The save waits until the test lets it answer: a slow network
let answerSave: () => void = () => undefined

beforeEach(() => {
  toastMock.success.mockReset()
  stored = { ...stored, name: "Şef bıçakları", is_active: true }
  fetchMock.mockReset().mockResolvedValue({ values: { url_style: { category: "prefixed" } } })
  admin.productCategory.list
    .mockReset()
    .mockImplementation(() => Promise.resolve({ product_categories: [{ ...stored }] }))
  admin.productCategory.update.mockReset().mockImplementation(
    (_id: string, input: Partial<typeof stored>) =>
      new Promise((resolve) => {
        answerSave = () => {
          stored = { ...stored, ...input }
          resolve({ product_category: { ...stored } })
        }
      })
  )
})

// As the category page draws it: from the tree, which a save refetches
function Page() {
  const { data } = useQuery(categoryTreeQuery())
  const category = data?.find(({ id }) => id === "sef")
  return data && category ? (
    <CategoryEditor key={category.id} categories={data} category={category} onDeleted={vi.fn()} />
  ) : null
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>
  )
}

const saveButton = () => screen.getByRole("button", { name: "Kaydet" })
// The card's Kaydet/Vazgeç row shows only while it has unsaved edits (CardForm)
const dirty = () => !saveButton().parentElement?.classList.contains("hidden")

describe("CategoryEditor: an edit made while 'Kaydet' is on its way stays (adr/0075)", () => {
  it("keeps the edit and leaves the card dirty", async () => {
    renderPage()
    const name = await screen.findByRole("textbox", { name: /Kategori adı/ })
    await userEvent.clear(name)
    await userEvent.type(name, "Şef ve santoku")
    await userEvent.click(saveButton())
    await waitFor(() => {
      expect(admin.productCategory.update).toHaveBeenCalledTimes(1)
    })
    // Typed while the server has not answered yet
    await userEvent.type(name, " seti")
    answerSave()

    // The save settles once the tree is read again (the mutation awaits it), then says so;
    // the card's state shows on the render after that, not with the button's
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledTimes(1)
    })
    expect(admin.productCategory.list).toHaveBeenCalledTimes(2)
    await waitFor(() => {
      expect(dirty()).toBe(true)
    })
    // And it stays so: nothing that lands later (the tree's render) cleans it
    await new Promise((settled) => setTimeout(settled, 50))
    expect(dirty()).toBe(true)
    expect(name).toHaveValue("Şef ve santoku seti")
    expect(saveButton()).toBeEnabled()
  })

  it("rests clean with what the server stored when nothing was typed meanwhile", async () => {
    renderPage()
    const name = await screen.findByRole("textbox", { name: /Kategori adı/ })
    await userEvent.clear(name)
    await userEvent.type(name, "Şef ve santoku")
    await userEvent.click(saveButton())
    await waitFor(() => {
      expect(admin.productCategory.update).toHaveBeenCalledTimes(1)
    })
    answerSave()

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(dirty()).toBe(false)
    })
    expect(name).toHaveValue("Şef ve santoku")
  })
})
