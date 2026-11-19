import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { AiScenesCard } from "./ai-scenes-card"

/**
 * Settings › Yapay zekâ › Sahneler (docs/22 Aşama 7): the shop's own
 * scenes in a compact list (name and a line of description), added and
 * changed in one dialog, deleted after a question, and one switch for the
 * sector pack's starting scenes. The list is saved whole to the
 * `ai_scenes` section; owner and admin only.
 */

const fetchMock = vi.hoisted(() => vi.fn())
const can = vi.hoisted(() => ({ settings: true }))
vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => can.settings }))

interface Scene {
  id: string
  name: string
  prompt: string
}
let values: { show_pack_scenes: boolean; scenes: Scene[] }
const saves: unknown[] = []

beforeEach(() => {
  can.settings = true
  saves.length = 0
  values = {
    show_pack_scenes: true,
    scenes: [{ id: "own_aaaaaaaa", name: "Bebek odası", prompt: "pembe battaniye üstünde" }],
  }
  fetchMock.mockReset()
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
    if (url === "/admin/platform-settings/ai_scenes" && init?.method === "POST") {
      saves.push(init.body)
      const sent = init.body as Partial<{ show_pack_scenes: boolean; scenes: Partial<Scene>[] }>
      values = {
        show_pack_scenes: sent.show_pack_scenes ?? values.show_pack_scenes,
        scenes: (sent.scenes ?? values.scenes).map((each, at) => ({
          id: each.id ?? `own_new0000${String(at)}`,
          name: each.name ?? "",
          prompt: each.prompt ?? "",
        })),
      }
    }
    return Promise.resolve({ section: "ai_scenes", values, version: 1 })
  })
})

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AiScenesCard />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

describe("AiScenesCard", () => {
  it("lists the shop's scenes by name with a line of their description", async () => {
    renderCard()
    const table = await screen.findByRole("table", { name: "Sahneler" })
    expect(within(table).getByText("Bebek odası")).toBeInTheDocument()
    expect(within(table).getByText("pembe battaniye üstünde")).toBeInTheDocument()
    expect(screen.getByText(/\(1\/12\)/)).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Hazır sahneleri göster" })).toBeChecked()
  })

  it("adds a scene in a dialog, its Vazgeç red, the list sent whole", async () => {
    const user = renderCard()
    await user.click(await screen.findByRole("button", { name: "Sahne ekle" }))
    const dialog = await screen.findByRole("dialog", { name: "Sahne ekle" })
    expect(within(dialog).getByRole("button", { name: "Vazgeç" })).toHaveAttribute(
      "data-variant",
      "cancel"
    )
    await user.type(within(dialog).getByRole("textbox", { name: "Tarif" }), "taş zemin, sabah")
    expect(within(dialog).getByText("16/200")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(saves).toEqual([
        {
          scenes: [
            { id: "own_aaaaaaaa", name: "Bebek odası", prompt: "pembe battaniye üstünde" },
            { name: "", prompt: "taş zemin, sabah" },
          ],
        },
      ])
    })
    expect(await screen.findByText("taş zemin, sabah")).toBeInTheDocument()
  })

  it("changes a scene and deletes one from its ⋯ menu", async () => {
    const user = renderCard()
    await user.click(await screen.findByRole("button", { name: "Bebek odası için işlemler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Düzenle" }))
    const dialog = await screen.findByRole("dialog", { name: "Sahneyi düzenle" })
    const name = within(dialog).getByRole("textbox", { name: "Ad" })
    await user.clear(name)
    await user.type(name, "Bebek")
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(saves.at(-1)).toEqual({
        scenes: [{ id: "own_aaaaaaaa", name: "Bebek", prompt: "pembe battaniye üstünde" }],
      })
    })

    await user.click(await screen.findByRole("button", { name: "Bebek için işlemler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Sil" }))
    const ask = await screen.findByRole("alertdialog", { name: "Bebek silinsin mi?" })
    await user.click(within(ask).getByRole("button", { name: "Sil" }))
    await waitFor(() => {
      expect(saves.at(-1)).toEqual({ scenes: [] })
    })
    expect(await screen.findByText(/Kayıtlı sahne yok/)).toBeInTheDocument()
  })

  it("hides the packs' scenes with its switch", async () => {
    const user = renderCard()
    await user.click(await screen.findByRole("switch", { name: "Hazır sahneleri göster" }))
    await waitFor(() => {
      expect(saves).toEqual([{ show_pack_scenes: false }])
    })
  })

  it("closes adding at twelve scenes", async () => {
    values.scenes = Array.from({ length: 12 }, (_, at) => ({
      id: `own_full000${String(at).padStart(2, "0")}`,
      name: `Sahne ${String(at)}`,
      prompt: "taş",
    }))
    renderCard()
    expect(await screen.findByRole("button", { name: "Sahne ekle" })).toBeDisabled()
  })

  it("shows the list only to a role that may not change it", async () => {
    can.settings = false
    renderCard()
    expect(await screen.findByText("Bebek odası")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sahne ekle" })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Bebek odası için işlemler" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Hazır sahneleri göster" })).toBeDisabled()
  })
})
