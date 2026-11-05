import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { Input } from "@/components/ui/input"
import type { MediaAsset } from "@/features/media/api/media"
import { asset } from "@/features/media/media.fixtures"
import { MediaField } from "./media-field"

const fetchMock = vi.hoisted(() => vi.fn())

const uploadMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { upload: { create: uploadMock } } },
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const CHOSEN = asset("media_1", { filename: "kapak.webp", alt: "Masa üstü" })

/** A form holding one picture and its alt text, as the panel's cards do. */
function Form({
  initial,
  onChange,
}: {
  initial: string | null
  onChange: (a: MediaAsset | null) => void
}) {
  const [url, setUrl] = useState(initial)
  return (
    <MediaField
      id="cover"
      label="Kapak görseli"
      value={url}
      emptyText="Kapak görseli yok"
      onChange={(chosen) => {
        onChange(chosen)
        setUrl(chosen?.url ?? null)
      }}
    >
      <Input aria-label="Alt metin" />
    </MediaField>
  )
}

function renderField(initial: string | null = null) {
  const onChange = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Form initial={initial} onChange={onChange} />
    </QueryClientProvider>
  )
  return onChange
}

describe("MediaField", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ media: [CHOSEN], count: 1 })
  })

  it("starts empty, without the words that go with a picture", () => {
    renderField()

    expect(screen.getByText("Kapak görseli yok")).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Alt metin" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /görseli kaldır/ })).not.toBeInTheDocument()
  })

  it("chooses a picture through the picker and shows it with its alt text field", async () => {
    const onChange = renderField()

    await userEvent.click(screen.getByRole("button", { name: "Kapak görseli: görsel seç" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(await within(dialog).findByRole("button", { name: "kapak.webp" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Seç" }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "media_1", alt: "Masa üstü" })
    )
    expect(screen.getByRole("img", { name: "Kapak görseli" })).toHaveAttribute("src", CHOSEN.url)
    expect(screen.getByRole("textbox", { name: "Alt metin" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Kapak görseli: görseli değiştir" })).toBeVisible()
  })

  it("is its own way in: a file dropped on the frame goes into the library and is chosen", async () => {
    const onChange = renderField()
    uploadMock.mockResolvedValue({ files: [{ id: "yeni.png", url: "https://cdn/yeni.png" }] })
    fetchMock.mockResolvedValue({ media: [asset("media_up", { filename: "yeni.png" })] })
    const frame = screen.getByRole("button", { name: "Kapak görseli: görsel seç" })
    const file = new File(["a"], "yeni.png", { type: "image/png" })

    fireEvent.drop(frame, { dataTransfer: { files: [file], types: ["Files"] } })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "media_up" }))
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/media", {
      method: "POST",
      body: { file_ids: ["yeni.png"], library: true },
    })
    // No dialog on the way, and no second button beside the frame
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("button", { name: "Görsel seç" })).toBeNull()
  })

  it("takes a picture off", async () => {
    const onChange = renderField("https://cdn.example.com/eski.webp")

    await userEvent.click(screen.getByRole("button", { name: "Kapak görseli: görseli kaldır" }))

    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.getByText("Kapak görseli yok")).toBeInTheDocument()
  })
})
