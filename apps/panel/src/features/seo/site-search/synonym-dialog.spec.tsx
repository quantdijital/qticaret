import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { SynonymGroup } from "@/features/seo/api/synonyms"
import { SynonymDialog } from "./synonym-dialog"
import { answerWritesWith } from "./synonyms.fixtures"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const GROUP: SynonymGroup = {
  id: "ssyn_1",
  terms: ["tişört", "t shirt"],
  created_at: "2026-11-03T09:00:00.000Z",
  updated_at: "2026-11-03T10:00:00.000Z",
}

function renderDialog(group?: SynonymGroup) {
  const onOpenChange = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SynonymDialog open onOpenChange={onOpenChange} group={group} />
    </QueryClientProvider>
  )
  return { onOpenChange, field: screen.getByRole("textbox", { name: "Terimler" }) }
}

const chips = () =>
  screen
    .getAllByRole("button", { name: /terimini çıkar$/ })
    .map((button) => button.getAttribute("aria-label")?.replace(/“(.*)” terimini çıkar/, "$1"))

describe("SynonymDialog", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    toast.success.mockReset()
    answerWritesWith(fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("takes terms with Enter and a comma, as the server keeps them, and adds the group", async () => {
    fetchMock.mockResolvedValue({ synonym: { ...GROUP, terms: ["çakı", "bıçak", "cep bıçağı"] } })
    const { onOpenChange, field } = renderDialog()

    // The group's rules, in the panel's own words
    expect(
      screen.getByText("Aramada aynı ürünleri bulması gereken 2–10 terim yazın.")
    ).toBeInTheDocument()
    expect(screen.getByText(/Her terim en çok 3 kelime ve 60 karakter/)).toBeInTheDocument()

    await userEvent.type(field, "Çakı{Enter}")
    await userEvent.type(field, "BIÇAK, Cep  Bıçağı,")
    expect(chips()).toEqual(["çakı", "bıçak", "cep bıçağı"])
    expect(screen.getByText("3 / 10")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Grubu ekle" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/search/synonyms", {
        method: "POST",
        body: { terms: ["çakı", "bıçak", "cep bıçağı"] },
      })
    })
    expect(toast.success).toHaveBeenCalledWith(
      "Eş anlamlı grup eklendi; bir dakika içinde vitrine yansır."
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("refuses what the server would refuse, before sending anything", async () => {
    const { field } = renderDialog()

    // A long phrase stays in the field to be fixed
    await userEvent.type(field, "kısa olmayan bir ifade{Enter}")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bir terim en çok 3 kelime olabilir; daha uzun ifadeyi kısaltın."
    )
    expect(field).toHaveValue("kısa olmayan bir ifade")
    expect(field).toHaveAttribute("aria-invalid", "true")

    // A repeat is no refusal: the server keeps a term once anyway, so it is passed over
    await userEvent.clear(field)
    await userEvent.type(field, "Kupa{Enter}KUPA{Enter}")
    expect(screen.queryByRole("alert")).toBeNull()
    expect(field).toHaveValue("")
    expect(chips()).toEqual(["kupa"])

    await userEvent.click(screen.getByRole("button", { name: "Grubu ekle" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Grup için en az 2 terim ekleyin.")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("holds a group at ten terms", async () => {
    const { field } = renderDialog()
    await userEvent.type(field, "a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11{Enter}")
    expect(chips()).toHaveLength(10)
    expect(field).toHaveValue("a11")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bir grupta en çok 10 terim olabilir; yeni terim için birini çıkarın."
    )
  })

  it("changes a group in place: a term removed, one added, sent to the group", async () => {
    fetchMock.mockResolvedValue({ synonym: { ...GROUP, terms: ["tişört", "tshirt"] } })
    const { field } = renderDialog(GROUP)
    expect(screen.getByRole("heading", { name: "Eş anlamlı grubu düzenle" })).toBeInTheDocument()
    expect(chips()).toEqual(["tişört", "t shirt"])

    await userEvent.click(screen.getByRole("button", { name: "“t shirt” terimini çıkar" }))
    await userEvent.type(field, "tee{Enter}")
    // Backspace in an empty field takes the last term back
    await userEvent.type(field, "{Backspace}")
    await userEvent.type(field, "tshirt{Enter}")
    expect(chips()).toEqual(["tişört", "tshirt"])

    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/search/synonyms/ssyn_1", {
        method: "POST",
        body: { terms: ["tişört", "tshirt"] },
      })
    })
    expect(toast.success).toHaveBeenCalledWith(
      "Eş anlamlı grup kaydedildi; bir dakika içinde vitrine yansır."
    )
  })

  it("says the server's refusals in words, not as keys", async () => {
    // The server has no sentence for its key yet: the key is named in its general one
    fetchMock.mockRejectedValueOnce({
      status: 400,
      message: "İşlem tamamlanamadı (hata kodu: search.synonyms_too_many).",
    })
    const { field } = renderDialog()
    await userEvent.type(field, "çakı, bıçak{Enter}")
    await userEvent.click(screen.getByRole("button", { name: "Grubu ekle" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Mağazada en çok 1.000 eş anlamlı grup olabilir; yenisini eklemek için kullanmadığınız bir grubu silin."
    )

    fetchMock.mockRejectedValueOnce({ status: 404, code: "search.synonym_unknown", message: "x" })
    await userEvent.click(screen.getByRole("button", { name: "Grubu ekle" }))
    expect(await screen.findByText(/Bu grup artık yok/)).toBeInTheDocument()
    expect(screen.queryByText(/search\./)).toBeNull()
  })

  it("says the server's size rules in the panel's own words, by their key", async () => {
    // As the backend answers the panel's session: its own sentence, the key beside it
    fetchMock.mockRejectedValueOnce({
      status: 400,
      type: "invalid_data",
      code: "search.synonym_term_length",
      message: "Sunucunun cümlesi",
    })
    const { field } = renderDialog()
    await userEvent.type(field, "çakı, bıçak{Enter}")
    await userEvent.click(screen.getByRole("button", { name: "Grubu ekle" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bir terim en çok 60 karakter olabilir."
    )
    expect(screen.queryByText("Sunucunun cümlesi")).toBeNull()

    fetchMock.mockRejectedValueOnce({
      status: 400,
      code: "search.synonym_terms_too_many",
      message: "Sunucunun cümlesi",
    })
    await userEvent.click(screen.getByRole("button", { name: "Grubu ekle" }))
    expect(
      await screen.findByText(
        "Bir grupta en çok 10 terim olabilir; yeni terim için birini çıkarın."
      )
    ).toBeInTheDocument()
  })
})
