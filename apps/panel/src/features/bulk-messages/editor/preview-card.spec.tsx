import { QueryClientProvider } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BulkMessage } from "@/features/bulk-messages/api/types"
import { campaign, clientWith } from "@/features/bulk-messages/bulk-messages.fixtures"
import { valuesOf } from "@/features/bulk-messages/form"
import type { EditorValues } from "@/features/bulk-messages/form"
import { frameDocument } from "./frame-document"
import { PreviewCard } from "./preview-card"
import { RENDER_DELAY_MS, useRenderedPreview } from "./use-rendered-preview"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

const HTML =
  '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Kış</title></head>' +
  '<body><p>Merhaba Selin</p><a href="https://magaza.example/indirim">Alışverişe başla</a></body></html>'

const EMAIL = {
  subject: "Selin, kış indirimi başladı",
  preheader: "Seçili ürünlerde %20",
  html: HTML,
}

const PREVIEW_URL = "/admin/bulk-messages/bm_1/preview"

/** The editor's form and the rendered preview as the editor wires them; `typed` not yet saved. */
function Harness({
  stored,
  typed = {},
}: {
  stored: BulkMessage
  typed?: Partial<EditorValues> | undefined
}) {
  const form = useForm<EditorValues>({ defaultValues: { ...valuesOf(stored), ...typed } })
  const rendered = useRenderedPreview(stored)
  return <PreviewCard campaign={stored} form={form} sender="Bıçakçı" rendered={rendered} />
}

function renderCard(stored: BulkMessage, typed?: Partial<EditorValues>) {
  const client: QueryClient = clientWith()
  const view = render(
    <QueryClientProvider client={client}>
      <Harness stored={stored} typed={typed} />
    </QueryClientProvider>
  )
  return {
    rerender: (next: BulkMessage) => {
      view.rerender(
        <QueryClientProvider client={client}>
          <Harness stored={next} typed={typed} />
        </QueryClientProvider>
      )
    },
  }
}

const previewCalls = () => fetchMock.mock.calls.filter(([url]) => url === PREVIEW_URL)

describe("PreviewCard (adr/0050 §10)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string, init?: { query?: { channel?: string } }) =>
      url === PREVIEW_URL
        ? Promise.resolve(
            init?.query?.channel === "sms"
              ? {
                  text: "Selin, kış indirimi başladı. Bıçakçı. Ret için RET yazıp 4609'a gönderin",
                  parts: 2,
                }
              : EMAIL
          )
        : Promise.reject(new Error(`unexpected ${url}`))
    )
  })

  it("renders the saved e-mail in a frame that runs nothing, its subject and preview line above", async () => {
    renderCard(campaign())

    const frame = await screen.findByTitle("E-posta önizlemesi")
    expect(fetchMock).toHaveBeenCalledWith(PREVIEW_URL, { query: { channel: "email" } })
    expect(frame.tagName).toBe("IFRAME")
    // No scripts, no forms, no origin of its own, no new windows
    expect(frame).toHaveAttribute("sandbox", "")
    const doc = frame.getAttribute("srcdoc") ?? ""
    expect(doc).toContain("<p>Merhaba Selin</p>")
    expect(doc).toMatch(
      /^<!doctype html><html lang="tr"><head><base target="_blank"><style>a,a \*\{pointer-events:none/
    )
    const inbox = within(screen.getByLabelText("Gelen kutusu satırı"))
    expect(inbox.getByText("Bıçakçı")).toBeInTheDocument()
    expect(inbox.getByText("Selin, kış indirimi başladı")).toBeInTheDocument()
    expect(inbox.getByText("Seçili ürünlerde %20")).toBeInTheDocument()
    expect(screen.queryByText(/kaydedince önizlenir/)).toBeNull()
  })

  it("shows the e-mail at a desktop's width or a phone's", async () => {
    const user = userEvent.setup()
    renderCard(campaign())

    const frame = await screen.findByTitle("E-posta önizlemesi")
    expect(frame).toHaveStyle({ width: "720px" })
    expect(screen.getByRole("radio", { name: "Masaüstü" })).toHaveAttribute("aria-checked", "true")

    await user.click(screen.getByRole("radio", { name: "Telefon" }))

    expect(screen.getByTitle("E-posta önizlemesi")).toHaveStyle({ width: "375px" })
    expect(screen.getByRole("radio", { name: "Telefon" })).toHaveAttribute("aria-checked", "true")
    // The same rendering: a device is no new request
    expect(previewCalls()).toHaveLength(1)
  })

  it("says unsaved changes show once saved, and asks nothing for them", async () => {
    renderCard(campaign(), { subject: "Yeni konu" })

    expect(
      await screen.findByText("Kaydedilmemiş değişiklikler kaydedince önizlenir.")
    ).toBeInTheDocument()
    // What is shown is still the stored one
    expect(await screen.findByText("Selin, kış indirimi başladı")).toBeInTheDocument()
    expect(previewCalls()).toHaveLength(1)
  })

  it("asks again once the saved content changes and rests, not for a name or an audience", async () => {
    const { rerender } = renderCard(campaign())
    await screen.findByTitle("E-posta önizlemesi")

    rerender(campaign({ name: "Kış indirimi 2", audience: [{ kind: "newsletter" }] }))
    await new Promise((resolve) => setTimeout(resolve, RENDER_DELAY_MS + 100))
    expect(previewCalls()).toHaveLength(1)

    rerender(campaign({ subject: "{ad}, son gün" }))
    // Not at once: the saved content rests first
    expect(previewCalls()).toHaveLength(1)
    await waitFor(
      () => {
        expect(previewCalls()).toHaveLength(2)
      },
      { timeout: RENDER_DELAY_MS * 4 }
    )
  })

  it("shows a text as the bubble with the backend's parts at the longest name", async () => {
    renderCard(campaign({ channel: "sms", sms_text: "{ad}, kış indirimi başladı" }))

    const bubble = within(await screen.findByLabelText("SMS önizlemesi"))
    expect(fetchMock).toHaveBeenCalledWith(PREVIEW_URL, { query: { channel: "sms" } })
    expect(
      bubble.getByText("Selin, kış indirimi başladı. Bıçakçı. Ret için RET yazıp 4609'a gönderin")
    ).toBeInTheDocument()
    expect(bubble.getByText("En çok 2 parça (en uzun alıcı adıyla sayıldı)")).toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: "Telefon" })).toBeNull()
  })

  it("says why it could not render, with a way to try again", async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error("limit"), { status: 429, message: "Çok fazla istek." })
    )
    renderCard(campaign())

    expect(await screen.findByRole("alert")).toHaveTextContent("Çok fazla istek.")
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument()
  })
})

describe("frameDocument", () => {
  it("locks the links inside the head, the doctype kept first", () => {
    expect(frameDocument("<!doctype html><html><head><title>x</title></head></html>")).toBe(
      '<!doctype html><html><head><base target="_blank"><style>a,a *{pointer-events:none!important;cursor:default!important}</style><title>x</title></head></html>'
    )
    expect(frameDocument("<p>bare</p>")).toMatch(
      /^<base target="_blank"><style>.*<\/style><p>bare<\/p>$/
    )
    // A <header> is no head
    expect(frameDocument("<header>h</header>")).toMatch(/^<base /)
  })
})
