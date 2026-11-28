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
// The library picker has its own spec: a stand-in that, open, picks one picture
vi.mock("@/components/patterns/media-picker", () => ({
  MediaPicker: (props: {
    open: boolean
    onSelect: (assets: { url: string; alt: string | null }[]) => void
  }) =>
    props.open ? (
      <button
        type="button"
        onClick={() => {
          props.onSelect([{ url: "https://cdn.example.com/secilen.webp", alt: "Seçilen" }])
        }}
      >
        Kütüphaneden seç
      </button>
    ) : null,
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

/** The only element of a list, which the test expects to be alone. */
const only = (list: HTMLElement[]): HTMLElement => {
  const [found] = list
  if (!found || list.length !== 1) {
    throw new Error(`expected one element, found ${String(list.length)}`)
  }
  return found
}

const titles = () => screen.queryAllByPlaceholderText("Örn. Varış ve şehir turu")
const titleValues = () => titles().map((input) => (input as HTMLInputElement).value)
/** A step's line, the button that opens and folds it. */
const line = (name: RegExp) => screen.getByRole("button", { name, expanded: false })

describe("ProgramEditor (adr/0078)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("says what an empty program is and shows no save until something changes", () => {
    renderEditor({ unit: "day", steps: [] })
    expect(screen.getByText(/Henüz adım yok/)).toBeDefined()
    expect(screen.queryByRole("button", { name: "Kaydet" })).toBeNull()
  })

  it("folds each step to a line with its label, title, picture and what it includes", async () => {
    renderEditor({
      unit: "day",
      steps: [
        {
          label: null,
          title: "Göreme",
          body: null,
          image: { url: "https://cdn.example.com/g.webp", alt: null },
          tags: ["breakfast", "dinner"],
        },
        { label: "Son gün", title: "Dönüş", body: null, image: null, tags: [] },
      ],
    })
    expect(titles()).toHaveLength(0)
    expect(screen.queryByRole("button", { name: /Görsel ekle|görsel seç/ })).toBeNull()
    const first = line(/1\. Gün\s*Göreme/)
    expect(first.closest("li")?.textContent).toContain("2 dahil")
    expect(first.closest("li")?.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example.com/g.webp"
    )
    expect(line(/Son gün\s*Dönüş/)).toBeDefined()

    await userEvent.click(first)
    expect(first.getAttribute("aria-expanded")).toBe("true")
    expect(titleValues()).toEqual(["Göreme"])
    // Open, the picture is a small thumbnail with its change and remove
    expect(screen.getByRole("button", { name: "Görsel: görseli değiştir" })).toBeDefined()
    await userEvent.click(screen.getByRole("button", { name: "Görsel: görseli kaldır" }))
    expect(screen.getByRole("button", { name: "Görsel: görsel seç" })).toBeDefined()
  })

  it("opens or folds every step at once in a long program", async () => {
    renderEditor({
      unit: "day",
      steps: ["A", "B", "C"].map((title) => ({
        label: null,
        title,
        body: null,
        image: null,
        tags: [],
      })),
    })
    await userEvent.click(screen.getByRole("button", { name: "Tümünü aç" }))
    expect(titleValues()).toEqual(["A", "B", "C"])
    await userEvent.click(screen.getByRole("button", { name: "Tümünü kapat" }))
    expect(titles()).toHaveLength(0)
  })

  it("adds a step open and asks for its title before saving", async () => {
    renderEditor({ unit: "day", steps: [] })
    await userEvent.click(screen.getByRole("button", { name: "Gün ekle" }))
    expect(titles()).toHaveLength(1)
    expect(screen.queryByText(/Henüz adım yok/)).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText("Adıma bir başlık yazın.")).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("opens a folded step the save refuses", async () => {
    renderEditor({
      unit: "day",
      steps: [{ label: null, title: "Göreme", body: null, image: null, tags: [] }],
    })
    await userEvent.click(line(/Göreme/))
    await userEvent.clear(only(titles()))
    await userEvent.click(screen.getByRole("button", { name: /Başlıksız/, expanded: true }))
    expect(titles()).toHaveLength(0)
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText("Adıma bir başlık yazın.")).toBeDefined()
    expect(titles()).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("saves the whole program in the server's shape", async () => {
    fetchMock.mockImplementation((_path: string, init?: { body: Program }) =>
      Promise.resolve({ booking_mode: "departure", program: init?.body ?? STORED })
    )
    renderEditor(STORED)
    await userEvent.click(screen.getByRole("button", { name: "Gün ekle" }))
    // Only the new step is open
    await userEvent.type(only(titles()), "  Dönüş ")
    await userEvent.click(only(screen.getAllByRole("button", { name: "Akşam yemeği" })))
    await userEvent.click(screen.getByRole("button", { name: "Görsel: görsel seç" }))
    await userEvent.click(screen.getByRole("button", { name: "Kütüphaneden seç" }))
    await userEvent.click(screen.getByRole("radio", { name: /Adım \(1\. Adım/ }))
    expect(screen.getByRole("button", { name: "Adım ekle" })).toBeDefined()
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

  it("marks a tag pressed, and removes or moves a step, which stays open", async () => {
    renderEditor({
      unit: "day",
      steps: [...STORED.steps, { label: "Son", title: "Dönüş", body: null, image: null, tags: [] }],
    })
    await userEvent.click(line(/Göreme/))
    const breakfast = only(screen.getAllByRole("button", { name: "Kahvaltı" }))
    expect(breakfast.getAttribute("aria-pressed")).toBe("true")
    await userEvent.click(screen.getByRole("button", { name: "2. adımı yukarı taşı" }))
    // Göreme moved down open; Dönüş moved up folded
    expect(titleValues()).toEqual(["Göreme"])
    expect(line(/Son\s*Dönüş/)).toBeDefined()
    await userEvent.click(screen.getByRole("button", { name: "1. adımı sil" }))
    expect(titleValues()).toEqual(["Göreme"])
    expect(screen.queryByRole("button", { name: /Dönüş/ })).toBeNull()
  })

  it("puts the program back as it was on Vazgeç", async () => {
    renderEditor(STORED)
    await userEvent.click(screen.getByRole("button", { name: "1. adımı sil" }))
    expect(screen.queryByRole("button", { name: /Göreme/ })).toBeNull()
    // The red Vazgeç beside Kaydet, not another button of the same name
    const save = screen.getByRole("button", { name: "Kaydet" })
    await userEvent.click(
      within(save.parentElement ?? document.body).getByRole("button", { name: "Vazgeç" })
    )
    expect(line(/Göreme/)).toBeDefined()
    expect(screen.queryByRole("button", { name: "Kaydet" })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
