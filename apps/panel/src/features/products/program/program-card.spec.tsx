import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { Program } from "@/features/products/api/program"
import { ProgramEditor } from "./program-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// ProseMirror cannot lay out in jsdom: the document shown as JSON
vi.mock("@/features/content/editor/rich-editor", () => ({
  RichEditor: (props: { value: JSONContent; label: string }) => (
    <output aria-label={props.label}>{JSON.stringify(props.value)}</output>
  ),
}))
// The library picker has its own spec: a stand-in that picks one picture
vi.mock("@/components/patterns/media-field", () => ({
  MediaField: (props: {
    label: string
    value: string | null
    onChange: (asset: { url: string; alt: string | null } | null) => void
  }) => (
    <button
      type="button"
      onClick={() => {
        props.onChange({ url: "https://cdn.example.com/secilen.webp", alt: "Seçilen" })
      }}
    >
      {`${props.label}: ${props.value ?? "-"}`}
    </button>
  ),
}))

const STORED: Program = {
  unit: "day",
  steps: [{ label: null, title: "Göreme", body: null, image: null, tags: ["breakfast"] }],
}

function renderEditor(program: Program) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProgramEditor productId="prod_1" program={program} />
    </QueryClientProvider>
  )
}

/** The second of a list, which the test has just made. */
const second = (list: HTMLElement[]): HTMLElement => {
  const found = list[1]
  if (!found) {
    throw new Error("no second element")
  }
  return found
}

const titles = () => screen.queryAllByPlaceholderText("Örn. Varış ve şehir turu")

describe("ProgramEditor (adr/0078)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("says what an empty program is and shows no save until something changes", () => {
    renderEditor({ unit: "day", steps: [] })
    expect(screen.getByText(/Henüz adım yok/)).toBeDefined()
    expect(screen.queryByRole("button", { name: "Kaydet" })).toBeNull()
  })

  it("adds a step and asks for its title before saving", async () => {
    renderEditor({ unit: "day", steps: [] })
    await userEvent.click(screen.getByRole("button", { name: "Adım ekle" }))
    expect(titles()).toHaveLength(1)
    expect(screen.queryByText(/Henüz adım yok/)).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText("Adıma bir başlık yazın.")).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("saves the whole program in the server's shape", async () => {
    fetchMock.mockImplementation((_path: string, init?: { body: Program }) =>
      Promise.resolve({ booking_mode: "departure", program: init?.body ?? STORED })
    )
    renderEditor(STORED)
    await userEvent.click(screen.getByRole("button", { name: "Adım ekle" }))
    await userEvent.type(second(titles()), "  Dönüş ")
    await userEvent.click(second(screen.getAllByRole("button", { name: "Akşam yemeği" })))
    await userEvent.click(second(screen.getAllByRole("button", { name: /^Görsel:/ })))
    await userEvent.click(screen.getByRole("radio", { name: /Adım \(1\. Adım/ }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/program", {
        method: "POST",
        body: {
          unit: "step",
          steps: [
            { label: null, title: "Göreme", body: null, image: null, tags: ["breakfast"] },
            {
              label: null,
              title: "Dönüş",
              body: null,
              image: { url: "https://cdn.example.com/secilen.webp", alt: "Seçilen" },
              tags: ["dinner"],
            },
          ],
        },
      })
    })
  })

  it("marks a tag pressed, and removes or moves a step", async () => {
    renderEditor({
      unit: "day",
      steps: [...STORED.steps, { label: "Son", title: "Dönüş", body: null, image: null, tags: [] }],
    })
    const [breakfast] = screen.getAllByRole("button", { name: "Kahvaltı" })
    expect(breakfast?.getAttribute("aria-pressed")).toBe("true")
    await userEvent.click(screen.getByRole("button", { name: "2. adımı yukarı taşı" }))
    expect(titles().map((input) => (input as HTMLInputElement).value)).toEqual(["Dönüş", "Göreme"])
    await userEvent.click(screen.getByRole("button", { name: "1. adımı sil" }))
    expect(titles().map((input) => (input as HTMLInputElement).value)).toEqual(["Göreme"])
  })

  it("puts the program back as it was on Vazgeç", async () => {
    renderEditor(STORED)
    await userEvent.click(screen.getByRole("button", { name: "1. adımı sil" }))
    expect(titles()).toHaveLength(0)
    // The red Vazgeç beside Kaydet, not another button of the same name
    const save = screen.getByRole("button", { name: "Kaydet" })
    await userEvent.click(
      within(save.parentElement ?? document.body).getByRole("button", { name: "Vazgeç" })
    )
    expect(titles().map((input) => (input as HTMLInputElement).value)).toEqual(["Göreme"])
    expect(screen.queryByRole("button", { name: "Kaydet" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
