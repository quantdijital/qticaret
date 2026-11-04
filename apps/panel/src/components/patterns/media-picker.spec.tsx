import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { asset } from "@/features/media/media.fixtures"
import { MediaPicker } from "./media-picker"

const fetchMock = vi.hoisted(() => vi.fn())
const uploadMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { upload: { create: uploadMock } } },
}))

const LIBRARY = [
  asset("media_1", { filename: "kapak.webp" }),
  asset("media_2", { filename: "afis.webp" }),
  asset("media_3", { filename: "logo.png" }),
]

function renderPicker(props: { multiple?: boolean; max?: number } = {}) {
  const onSelect = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MediaPicker open onOpenChange={onOpenChange} onSelect={onSelect} {...props} />
    </QueryClientProvider>
  )
  return { onSelect, onOpenChange }
}

describe("MediaPicker", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    uploadMock.mockReset()
    fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
      if (url === "/admin/media/import") {
        const { url: address } = init?.body as { url: string }
        return address.includes("yerel")
          ? Promise.reject(
              Object.assign(new Error("refused"), {
                status: 400,
                message: "Bu adresten görsel alınamaz. Herkese açık bir https adresi girin.",
              })
            )
          : Promise.resolve({ media: asset("media_imported", { filename: "kampanya.png" }) })
      }
      if (url === "/admin/media" && init?.method === "POST") {
        return Promise.resolve({ media: [asset("media_up", { filename: "yeni.png" })] })
      }
      return Promise.resolve({ media: LIBRARY, count: LIBRARY.length })
    })
  })

  it("opens on the library: one image is marked and chosen", async () => {
    const { onSelect, onOpenChange } = renderPicker()
    const dialog = await screen.findByRole("dialog")
    const choose = within(dialog).getByRole("button", { name: "Seç" })

    expect(choose).toBeDisabled()
    await userEvent.click(await within(dialog).findByRole("button", { name: "kapak.webp" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "afis.webp" }))

    expect(within(dialog).getByRole("button", { name: "afis.webp" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(within(dialog).getByRole("button", { name: "kapak.webp" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    await userEvent.click(choose)
    expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: "media_2" })])
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("chooses several up to the room left", async () => {
    const { onSelect } = renderPicker({ multiple: true, max: 2 })
    const dialog = await screen.findByRole("dialog")

    for (const name of ["kapak.webp", "afis.webp", "logo.png"]) {
      await userEvent.click(await within(dialog).findByRole("button", { name }))
    }

    expect(within(dialog).getByText("2 görsel seçildi")).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Seç" }))
    expect(onSelect).toHaveBeenCalledWith([
      expect.objectContaining({ id: "media_1" }),
      expect.objectContaining({ id: "media_2" }),
    ])
  })

  it("uploads from this computer into the library, then chooses what went up", async () => {
    uploadMock.mockResolvedValue({ files: [{ id: "yeni.png", url: "https://cdn/yeni.png" }] })
    const { onSelect } = renderPicker()
    const dialog = await screen.findByRole("dialog")

    await userEvent.click(within(dialog).getByRole("tab", { name: "Bilgisayardan yükle" }))
    await userEvent.upload(
      within(dialog).getByLabelText("Bilgisayardan görsel seç"),
      new File(["a"], "yeni.png", { type: "image/png" })
    )

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: "media_up" })])
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/media", {
      method: "POST",
      body: { file_ids: ["yeni.png"], library: true },
    })
  })

  it("brings an image in from an address, or says why it cannot", async () => {
    const { onSelect } = renderPicker()
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("tab", { name: "Adres" }))
    const address = within(dialog).getByRole("textbox", { name: "Görselin adresi" })
    const bring = within(dialog).getByRole("button", { name: "Kütüphaneye al ve seç" })

    await userEvent.type(address, "http://yerel/a.png")
    await userEvent.click(bring)
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Bu adresten görsel alınamaz"
    )
    expect(onSelect).not.toHaveBeenCalled()

    await userEvent.clear(address)
    await userEvent.type(address, "https://cdn.example.com/kampanya.png")
    await userEvent.click(bring)

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: "media_imported" })])
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/media/import", {
      method: "POST",
      body: { url: "https://cdn.example.com/kampanya.png" },
    })
  })
})
