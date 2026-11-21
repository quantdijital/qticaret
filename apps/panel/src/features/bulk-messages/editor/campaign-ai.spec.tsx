import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { useForm, useWatch } from "react-hook-form"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { campaign } from "@/features/bulk-messages/bulk-messages.fixtures"
import { valuesOf } from "@/features/bulk-messages/form"
import type { EditorValues } from "@/features/bulk-messages/form"
import { EmailAi } from "./email-ai"
import { SmsAi } from "./sms-ai"

const sdkFetch = vi.hoisted(() => vi.fn())
const netFetch = vi.fn()

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: sdkFetch } } }))

/**
 * "Yapay zekâ ile öner" on a bulk message (adr/0074 §5 madde 6): the
 * purpose is picked before asking, the words come for the saved campaign
 * (its id only, nothing typed), the subject is picked from three, and the
 * body's words replace the old ones only after one more question, its
 * cards kept. A text's candidates fill the SMS field. Nothing is saved.
 */

const PURPOSES = ["new_product", "discount", "season", "win_back"]

const task = (id: string, allowed = true) => ({
  id,
  capability: "text",
  mode: "sync",
  options: PURPOSES,
  allowed,
  usable: ["deepseek"],
  preference: null,
})

const EMAIL = {
  subjects: ["Kış seçkisi geldi", "Yün atkılar raflarda", "Soğuk günlere hazır mısınız?"],
  preheader: "Yeni gelenlere göz atın",
  paragraphs: ["Kış koleksiyonumuz raflarda.", "<b>Sizi</b> bekliyoruz."],
}

const CARD = { type: "productCard", attrs: { id: "prod_1" } }
const OLD_BODY: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Eski metin." }] }, CARD],
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))

function answer(taskId: string, candidates: string[]) {
  netFetch.mockImplementation((url: string) =>
    url.endsWith("/accept") || url.endsWith("/dismiss")
      ? json(200, { suggestion: { id: "sug_1" } })
      : json(201, {
          suggestion: {
            id: "sug_1",
            task: taskId,
            service: "deepseek",
            status: "draft",
            text: candidates[0],
            candidates,
            problems: [],
            alternatives: [],
          },
        })
  )
}

function Harness({ channel, values }: { channel: "email" | "sms"; values: Partial<EditorValues> }) {
  const form = useForm<EditorValues>({
    defaultValues: { ...valuesOf(campaign({ channel })), ...values },
  })
  const watched = useWatch({ control: form.control })
  return (
    <>
      {channel === "email" ? (
        <EmailAi form={form} campaignId="camp_1" dirty={false} />
      ) : (
        <SmsAi form={form} campaignId="camp_1" dirty={false} />
      )}
      <output aria-label="values">{JSON.stringify(watched)}</output>
    </>
  )
}

function setup(channel: "email" | "sms", values: Partial<EditorValues>, allowed = true) {
  sdkFetch.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/ai/services"
        ? {
            services: [],
            tasks: [task(`campaign_${channel}`, allowed)],
            flags: { own_keys: true },
          }
        : {}
    )
  )
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Harness channel={channel} values={values} />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

const values = () =>
  JSON.parse(screen.getByLabelText("values").textContent) as Partial<EditorValues>
const asked = () => JSON.parse((netFetch.mock.calls[0]?.[1] as { body: string }).body) as unknown
const urls = () => netFetch.mock.calls.map(([url]) => String(url))
const BUTTON = "Yapay zekâ ile öner"

beforeEach(() => {
  sdkFetch.mockReset()
  netFetch.mockReset()
  vi.stubGlobal("fetch", netFetch)
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("a bulk e-mail's words", () => {
  it("asks with the purpose picked and fills the subject picked, the preview line and the body", async () => {
    answer("campaign_email", [JSON.stringify(EMAIL)])
    const user = setup("email", {
      subject: "",
      preheader: "",
      body: { type: "doc", content: [CARD] },
    })
    await user.click(await screen.findByRole("button", { name: BUTTON }))
    const dialog = await screen.findByRole("dialog")
    // Nothing asked before the purpose step's own button
    expect(netFetch).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("radio", { name: "İndirim" }))
    await user.click(within(dialog).getByRole("button", { name: "Öner" }))
    await within(dialog).findByText("Yün atkılar raflarda")
    expect(asked()).toEqual({
      task: "campaign_email",
      entity_type: "campaign",
      entity_id: "camp_1",
      option: "discount",
    })
    // Markup a text holds is shown as text, never drawn
    expect(within(dialog).getByText("<b>Sizi</b> bekliyoruz.")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("radio", { name: /Yün atkılar raflarda/ }))
    await user.click(within(dialog).getByRole("button", { name: "Kullan" }))
    await waitFor(() => {
      expect(values().subject).toBe("Yün atkılar raflarda")
    })
    expect(values().preheader).toBe("Yeni gelenlere göz atın")
    // A body of a card only has no words to replace: no question; the card stays after the words
    expect(values().body).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Kış koleksiyonumuz raflarda." }] },
        { type: "paragraph", content: [{ type: "text", text: "<b>Sizi</b> bekliyoruz." }] },
        CARD,
      ],
    })
    expect(urls()).toEqual(["/admin/ai/suggestions", "/admin/ai/suggestions/sug_1/accept"])
    // The subject picked is recorded by its place among the three (adr/0074 §4)
    const accepted = netFetch.mock.calls[1]?.[1] as { body: string }
    expect(JSON.parse(accepted.body)).toEqual({ candidate_index: 1 })
  })

  it("asks before replacing the body's words, and may keep them", async () => {
    answer("campaign_email", [JSON.stringify(EMAIL)])
    const user = setup("email", { subject: "Eski konu", body: OLD_BODY })
    await user.click(await screen.findByRole("button", { name: BUTTON }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Öner" }))
    expect(asked()).toEqual({
      task: "campaign_email",
      entity_type: "campaign",
      entity_id: "camp_1",
    })
    await within(dialog).findByText("Kış seçkisi geldi")
    await user.click(within(dialog).getByRole("button", { name: "Kullan" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /düğmeler de değişir. Görseller ve ürün kartları kalır/
    )
    expect(values().subject).toBe("Eski konu")
    await user.click(within(dialog).getByRole("button", { name: "Yalnız konu ve önizleme satırı" }))
    await waitFor(() => {
      expect(values().subject).toBe("Kış seçkisi geldi")
    })
    expect(values().body).toEqual(OLD_BODY)
  })

  it("draws no button for a role the task does not allow", async () => {
    setup("email", {}, false)
    await waitFor(() => {
      expect(sdkFetch).toHaveBeenCalledWith("/admin/ai/services")
    })
    expect(screen.queryByRole("button", { name: BUTTON })).toBeNull()
  })
})

describe("a bulk text's words", () => {
  it("fills the field with the text picked, after asking when it has words", async () => {
    answer("campaign_sms", ["Kış seçkisi geldi.", "Yün atkılar raflarda."])
    const user = setup("sms", { sms_text: "Eski metin" })
    await user.click(await screen.findByRole("button", { name: BUTTON }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Öner" }))
    await user.click(await within(dialog).findByRole("radio", { name: /Yün atkılar raflarda/ }))
    await user.click(within(dialog).getByRole("button", { name: "Kullan" }))
    await user.click(await within(dialog).findByRole("button", { name: "Metni değiştir" }))
    await waitFor(() => {
      expect(values().sms_text).toBe("Yün atkılar raflarda.")
    })
    expect(urls()).toContain("/admin/ai/suggestions/sug_1/accept")
  })
})
