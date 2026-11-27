import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { FaqCard } from "./faq-card"

const sdkFetch = vi.hoisted(() => vi.fn())
const netFetch = vi.fn()

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const task = (allowed = true) => ({
  id: "product_faq",
  capability: "text",
  mode: "sync",
  options: [],
  allowed,
  usable: ["deepseek"],
  preference: null,
})

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

const ITEMS = [
  { question: "Kaç saat sıcak tutar?", answer: "Gün boyu sıcak tutar." },
  { question: "Hacmi ne kadar?", answer: "750 ml hacimlidir." },
  { question: "Bulaşık makinesinde yıkanır mı?", answer: "Elde yıkanması önerilir." },
]

/** The product's questions as the panel lists them: the shop's own and a customer's waiting one. */
const LISTED = [
  {
    id: "pq_9",
    body: "Sapı ısınır mı?",
    author_name: "Ayşe Y.",
    by_shop: false,
    status: "pending",
    has_link: false,
    created_at: "2026-11-26T10:00:00Z",
    product: { id: "prod_1", title: "Termos" },
    answers: [],
  },
  {
    id: "pq_8",
    body: "Garanti var mı?",
    author_name: "Mağaza",
    by_shop: true,
    status: "approved",
    has_link: false,
    created_at: "2026-11-25T10:00:00Z",
    product: { id: "prod_1", title: "Termos" },
    answers: [
      {
        id: "pans_8",
        body: "İki yıl garantilidir.",
        author_name: "Mağaza",
        by_shop: true,
        status: "approved",
        has_link: false,
        created_at: "2026-11-25T10:00:00Z",
      },
    ],
  },
]

function setup(
  options: { allowed?: boolean; addStatus?: number; can?: boolean; listed?: unknown[] } = {}
) {
  sdkFetch.mockImplementation((path: string) => {
    if (path === "/admin/staff/me") {
      const can = options.can ?? true
      return Promise.resolve({ role: "owner", can: { moderation: can, settings: can } })
    }
    if (path === "/admin/product-questions") {
      const listed = options.listed ?? []
      return Promise.resolve({ questions: listed, count: listed.length, limit: 50 })
    }
    if (path.startsWith("/admin/product-questions")) {
      return Promise.resolve({ question: { id: "pq_new" } })
    }
    return Promise.resolve({ services: [], tasks: [task(options.allowed ?? true)], flags: {} })
  })
  netFetch.mockImplementation((url: string) => {
    if (url.endsWith("/dismiss")) {
      return json(200, { suggestion: { id: "sug_1" } })
    }
    if (url.endsWith("/faq")) {
      return options.addStatus === 400
        ? json(400, { code: "ai.faq_item_invalid", message: "Bu haliyle eklenemez." })
        : json(201, { suggestion: { id: "sug_1", question_ids: ["pq_1", "pq_2"] } })
    }
    return json(201, {
      suggestion: {
        id: "sug_1",
        task: "product_faq",
        service: "deepseek",
        status: "draft",
        text: "{}",
        candidates: ["{}"],
        alternatives: [],
        faq: { items: [...ITEMS, { question: 3, answer: "x" }], dropped: 1 },
      },
    })
  })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FaqCard productId="prod_1" />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const BUTTON = "SSS taslağı"

/** Folded like the page's other seldom parts: opened, then the draft asked for. */
async function openDraft(user: ReturnType<typeof userEvent.setup>) {
  const fold = await screen.findByRole("button", { name: "Sık sorulan sorular" })
  expect(fold).toHaveAttribute("aria-expanded", "false")
  await user.click(fold)
  await user.click(screen.getByRole("button", { name: BUTTON }))
}
const posted = () => netFetch.mock.calls.map(([url]) => String(url))
const bodyOf = (url: string) =>
  JSON.parse(
    (netFetch.mock.calls.find(([each]) => String(each) === url)?.[1] as { body: string }).body
  ) as unknown

beforeEach(() => {
  sdkFetch.mockReset()
  netFetch.mockReset()
  vi.mocked(toast.success).mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("FaqCard (adr/0074 §5 madde 4)", () => {
  it("lists the draft's items, editable and kept, and adds the kept ones as edited", async () => {
    const user = setup()
    await openDraft(user)

    const questions = await screen.findAllByLabelText("Soru")
    expect(questions.map((each) => (each as HTMLInputElement).value)).toEqual(
      ITEMS.map((each) => each.question)
    )
    expect(bodyOf("/admin/ai/suggestions")).toEqual({
      task: "product_faq",
      entity_type: "product",
      entity_id: "prod_1",
    })

    await user.click(screen.getByRole("checkbox", { name: "3. soruyu ekle" }))
    const answer = screen.getAllByLabelText("Yanıt")[0] as HTMLTextAreaElement
    await user.clear(answer)
    await user.type(answer, "Yaklaşık 12 saat sıcak tutar.")
    await user.click(screen.getByRole("button", { name: "Seçilenleri ekle (2)" }))

    await waitFor(() => {
      expect(posted()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/faq"])
    })
    expect(bodyOf("/admin/ai/suggestions/sug_1/faq")).toEqual({
      items: [
        { q: "Kaç saat sıcak tutar?", a: "Yaklaşık 12 saat sıcak tutar." },
        { q: "Hacmi ne kadar?", a: "750 ml hacimlidir." },
      ],
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("2 soru ürün sayfasına eklendi.")
    })
    expect(screen.queryByLabelText("Soru")).not.toBeInTheDocument()
  })

  it("holds an item the server would refuse, and shows the server's refusal", async () => {
    const user = setup({ addStatus: 400 })
    await openDraft(user)
    const question = (await screen.findAllByLabelText("Soru"))[0] as HTMLInputElement
    await user.clear(question)
    await user.type(question, "Kaç saat sıcak tutar")

    expect(screen.getByText("Soru, soru işaretiyle bitmeli.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Seçilenleri ekle (3)" })).toBeDisabled()

    await user.type(question, "?")
    await user.click(screen.getByRole("button", { name: "Seçilenleri ekle (3)" }))
    expect(await screen.findByText("Bu haliyle eklenemez.")).toBeInTheDocument()
    expect(screen.getAllByLabelText("Soru")).toHaveLength(3)
  })

  it("dismisses the draft on Vazgeç, the cancel kind", async () => {
    const user = setup()
    await openDraft(user)
    await screen.findAllByLabelText("Soru")
    const close = screen.getByRole("button", { name: "Vazgeç" })
    expect(close.className).toMatch(/destructive|red/)
    await user.click(close)
    await waitFor(() => {
      expect(posted()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/dismiss"])
    })
    expect(screen.queryByLabelText("Soru")).not.toBeInTheDocument()
  })

  it("offers no draft to a role the task does not allow, and still lists the questions", async () => {
    const user = setup({ allowed: false, can: false, listed: LISTED })
    await user.click(await screen.findByRole("button", { name: "Sık sorulan sorular" }))
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/services")
    })

    expect(await screen.findByText("Garanti var mı?")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: BUTTON })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Soru ekle" })).not.toBeInTheDocument()
    // Read only: a row opens nothing
    expect(screen.queryByRole("button", { name: /Soruyu aç/ })).not.toBeInTheDocument()
  })
})

describe("FaqCard: the product's questions (owner 2026-11-27)", () => {
  it("lists every question newest first with its state and answer", async () => {
    const user = setup({ listed: LISTED })
    await user.click(await screen.findByRole("button", { name: "Sık sorulan sorular" }))

    const rows = await screen.findAllByRole("button", { name: /Soruyu aç/ })
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Sapı ısınır mı?Henüz yanıt yok"),
      expect.stringContaining("Garanti var mı?İki yıl garantilidir."),
    ])
    expect(rows[0]).toHaveTextContent("Yanıt bekliyor")
    expect(rows[1]).toHaveTextContent("Yayında")
    expect(sdkFetch).toHaveBeenCalledWith("/admin/product-questions", {
      query: { product_id: "prod_1" },
    })
  })

  it("adds a question by hand and reads the list again", async () => {
    const user = setup({ listed: [] })
    await user.click(await screen.findByRole("button", { name: "Sık sorulan sorular" }))
    expect(await screen.findByText("Bu ürüne henüz soru yok.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Soru ekle" }))
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText("Soru"), "Kapağı sızdırır mı?")
    await user.type(within(dialog).getByLabelText("Mağazanın yanıtı"), "Hayır, contalıdır.")
    await user.click(within(dialog).getByRole("button", { name: "Ekle" }))

    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/product-questions", {
        method: "POST",
        body: {
          product_id: "prod_1",
          question: "Kapağı sızdırır mı?",
          answer: "Hayır, contalıdır.",
        },
      })
    })
    await waitFor(() => {
      expect(
        sdkFetch.mock.calls.filter(([path]) => path === "/admin/product-questions")
      ).toHaveLength(3)
    })
  })

  it("edits a question's words and removes the shop's answer from its dialog", async () => {
    const user = setup({ listed: LISTED })
    await user.click(await screen.findByRole("button", { name: "Sık sorulan sorular" }))
    await user.click(await screen.findByRole("button", { name: "Soruyu aç: Garanti var mı?" }))
    const dialog = await screen.findByRole("dialog")
    const body = within(dialog).getByLabelText("Soru")
    await user.clear(body)
    await user.type(body, "Garantisi kaç yıl?")
    await user.clear(within(dialog).getByLabelText("Mağazanın yanıtı"))
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/product-questions/pq_8/edit", {
        method: "POST",
        body: { body: "Garantisi kaç yıl?", answer: null },
      })
    })
  })

  it("says in the dialog, never on the storefront, that the shop changed a customer's words", async () => {
    const edited = { ...LISTED[0], edited_at: "2026-11-27T09:00:00Z" }
    const user = setup({ listed: [edited] })
    await user.click(await screen.findByRole("button", { name: "Sık sorulan sorular" }))
    await user.click(await screen.findByRole("button", { name: "Soruyu aç: Sapı ısınır mı?" }))

    expect(
      within(await screen.findByRole("dialog")).getByText(/Mağaza tarafından düzenlendi/)
    ).toBeInTheDocument()
  })

  it("hides a published question", async () => {
    const user = setup({ listed: LISTED })
    await user.click(await screen.findByRole("button", { name: "Sık sorulan sorular" }))
    await user.click(await screen.findByRole("button", { name: "Soruyu aç: Garanti var mı?" }))
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Gizle" })
    )

    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/product-questions/moderate", {
        method: "POST",
        body: { ids: ["pq_8"], status: "rejected" },
      })
    })
  })

  it("deletes after asking, and offers Geri al", async () => {
    const user = setup({ listed: LISTED })
    await user.click(await screen.findByRole("button", { name: "Sık sorulan sorular" }))
    await user.click(await screen.findByRole("button", { name: "Soruyu aç: Garanti var mı?" }))
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Sil" }))
    await user.click(await screen.findByRole("button", { name: "Soruyu sil" }))

    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/product-questions/pq_8", { method: "DELETE" })
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Soru silindi.", {
        action: { label: "Geri al", onClick: expect.any(Function) as () => void },
      })
    })
    const undo = vi.mocked(toast.success).mock.calls.at(-1)?.[1] as unknown as {
      action: { onClick: () => void }
    }
    undo.action.onClick()
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/product-questions/pq_8/restore", {
        method: "POST",
      })
    })
  })
})
