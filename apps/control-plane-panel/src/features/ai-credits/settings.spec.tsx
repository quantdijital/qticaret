import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Toaster } from "@qticaret/admin-ui/patterns/toaster"
import "@/lib/i18n"
import type { AiCheckReason } from "@/features/ai-credits/api/schemas"
import { AiSettingsPage } from "@/features/ai-credits/pages/ai-settings-page"
import { forgetStepUp } from "@/lib/step-up"
import { stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { PROVIDERS, SETTINGS } from "@/test/ai-settings"
import { renderAs } from "@/test/member"

// Plainly fake, short: never a real key's shape
const FAKE_KEY = "fake-key-123"

function controlPlane(verdict: () => unknown) {
  return (call: Sent): Answer => {
    if (call.path === "/admin/cp/ai/settings") {
      return { status: 200, body: SETTINGS }
    }
    if (call.path === "/admin/cp/ai/providers") {
      return { status: 200, body: PROVIDERS }
    }
    if (call.path.endsWith("/test")) {
      return { status: 200, body: verdict() }
    }
    if (call.path.startsWith("/admin/cp/ai/providers/")) {
      return { status: 200, body: { provider: { service: "deepseek", has_key: true } } }
    }
    return { status: 200, body: {} }
  }
}

const page = () => renderAs(<AiSettingsPage />, "owner")

async function firstButton(name: string) {
  const [button] = await screen.findAllByRole("button", { name })
  if (!button) {
    throw new Error(`no ${name} button`)
  }
  return button
}

describe("the AI providers page (adr/0085 §2, §5)", () => {
  beforeEach(() => {
    forgetStepUp()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("never fills the key field and empties it once sent", async () => {
    const sent = stubApi(controlPlane(() => ({ ok: true })))
    page()

    await userEvent.click(await firstButton("Anahtarı değiştir"))
    const form = await screen.findByRole("dialog", { name: "DeepSeek anahtarı" })
    const field = within(form).getByLabelText("API anahtarı")
    expect(field).toHaveAttribute("type", "password")
    expect(field).toHaveAttribute("autocomplete", "off")
    expect(field).toHaveValue("")
    await userEvent.type(field, FAKE_KEY)
    await userEvent.click(within(form).getByRole("button", { name: "Anahtarı kaydet" }))

    await waitFor(() => {
      const written = sent.filter(
        (call) => call.method === "POST" && call.path === "/admin/cp/ai/providers/deepseek"
      )
      expect(written.map((call) => call.body)).toEqual([{ api_key: FAKE_KEY }])
    })
    // Never read back: no answer carried it, and the field held it only until sent
    expect(document.body.innerHTML).not.toContain(FAKE_KEY)
  })

  it("says a pasted key over 512 characters is too long, and neither cuts nor sends it", async () => {
    const sent = stubApi(controlPlane(() => ({ ok: true })))
    page()

    await userEvent.click(await firstButton("Anahtarı değiştir"))
    const form = await screen.findByRole("dialog", { name: "DeepSeek anahtarı" })
    const field = within(form).getByLabelText("API anahtarı")
    await userEvent.click(field)
    await userEvent.paste("k".repeat(513))

    expect(field).toHaveValue("k".repeat(513))
    expect(field).toHaveAccessibleDescription("Anahtar 512 karakterden uzun olamaz.")
    const submit = within(form).getByRole("button", { name: "Anahtarı kaydet" })
    expect(submit).toBeDisabled()
    await userEvent.click(submit)
    expect(sent.filter((call) => call.method === "POST")).toEqual([])
  })

  it.each<[string, Answer, string]>([
    [
      "a server error",
      { status: 500, body: {} },
      "İşlem tamamlanamadı. Biraz sonra tekrar deneyin.",
    ],
    ["success", { status: 200, body: { provider: PROVIDERS.providers[0] } }, "Anahtar silindi."],
  ])(
    "says a key deletion's answer (%s) once the confirmation has closed",
    async (_case, answer, words) => {
      const base = controlPlane(() => ({ ok: true }))
      const sent = stubApi((call) =>
        call.method === "DELETE" && call.path === "/admin/cp/ai/providers/deepseek"
          ? answer
          : base(call)
      )
      renderAs(
        <>
          <AiSettingsPage />
          <Toaster />
        </>,
        "owner"
      )

      await userEvent.click(await firstButton("Anahtarı sil"))
      const ask = await screen.findByRole("alertdialog", { name: "DeepSeek anahtarı silinsin mi?" })
      await userEvent.click(within(ask).getByRole("button", { name: "Anahtarı sil" }))

      expect(await screen.findByText(words)).toBeInTheDocument()
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      expect(sent.filter((call) => call.method === "DELETE")).toHaveLength(1)
    }
  )

  it.each<[{ ok: true } | { ok: false; reason: AiCheckReason }, string]>([
    [{ ok: true }, "DeepSeek: bağlandı."],
    [{ ok: false, reason: "no_key" }, "DeepSeek: anahtar yok."],
    [{ ok: false, reason: "rejected" }, "DeepSeek: sağlayıcı anahtarı reddetti."],
    [
      { ok: false, reason: "unreachable" },
      "DeepSeek: sağlayıcıya ulaşılamadı; biraz sonra yeniden deneyin.",
    ],
    [{ ok: false, reason: "timeout" }, "DeepSeek: sağlayıcı zamanında yanıt vermedi."],
    [{ ok: false, reason: "unexpected" }, "DeepSeek: sağlayıcıdan beklenmeyen bir yanıt geldi."],
  ])("says the connection test's verdict %j in plain words", async (verdict, words) => {
    const sent = stubApi(controlPlane(() => verdict))
    page()

    await userEvent.click(await firstButton("Bağlantıyı dene"))
    expect(await screen.findByText(words)).toHaveAttribute("aria-live", "polite")
    expect(sent.find((call) => call.path.endsWith("/test"))?.body).toEqual({})
  })

  it("offers Gemini for text and image reading only as disabled, saying why", async () => {
    stubApi(controlPlane(() => ({ ok: true })))
    page()

    const text = await screen.findByRole("radiogroup", { name: "Metin yazma: servis ve model" })
    const gemini = within(text).getByRole("radio", { name: "Google Gemini · gemini-flash" })
    expect(gemini).toBeDisabled()
    expect(gemini).toHaveAccessibleDescription(
      "Google Gemini: bu serviste çıktı sınırı belgelenmediği için platform kredisinde kullanılamaz."
    )
    const edit = screen.getByRole("radiogroup", { name: "Görsel düzenleme: servis ve model" })
    expect(within(edit).getByRole("radio", { name: "Google Gemini · gemini-image" })).toBeEnabled()
  })

  it("offers Bria only as disabled until a real call proves it, even with its key held", async () => {
    const withBria = {
      ...SETTINGS,
      targets: [...SETTINGS.targets, { service: "bria", capabilities: { image_edit: ["RMBG2"] } }],
    }
    const keyed = {
      providers: [
        ...PROVIDERS.providers,
        { service: "bria", has_key: true, version: 1, written_at: null, routed: [] },
      ],
    }
    const base = controlPlane(() => ({ ok: true }))
    stubApi((call) =>
      call.path === "/admin/cp/ai/settings"
        ? { status: 200, body: withBria }
        : call.path === "/admin/cp/ai/providers"
          ? { status: 200, body: keyed }
          : base(call)
    )
    page()

    const edit = await screen.findByRole("radiogroup", {
      name: "Görsel düzenleme: servis ve model",
    })
    const bria = within(edit).getByRole("radio", { name: "Bria · RMBG2" })
    expect(bria).toBeDisabled()
    expect(bria).toHaveAccessibleDescription(
      "Bria: bu servis henüz doğrulanmadı; platform kredisinde yönlendirilemez."
    )
    expect(within(edit).getByRole("radio", { name: "Google Gemini · gemini-image" })).toBeEnabled()
  })

  it("notes a changed price makes a new pack, and reads the settings again before saving", async () => {
    const sent = stubApi(controlPlane(() => ({ ok: true })))
    page()

    await userEvent.click(await screen.findByRole("button", { name: "Düzenle: Küçük" }))
    const form = await screen.findByRole("dialog", { name: "Paketi düzenle" })
    expect(form).toHaveTextContent(
      "Fiyatı değişen paket yeni paket sayılır; bekleyen talepler eski fiyatla kalır."
    )
    const credits = within(form).getByLabelText("Kredi")
    await userEvent.clear(credits)
    await userEvent.type(credits, "1200")
    const reads = sent.filter((call) => call.path === "/admin/cp/ai/settings").length
    await userEvent.click(within(form).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      const settings = sent.filter((call) => call.path === "/admin/cp/ai/settings")
      const saved = settings.filter((call) => call.method === "POST")
      expect(saved.map((call) => call.body)).toEqual([
        {
          packs: [
            {
              id: "pack_00000000000000aa",
              name: "Küçük",
              credits: 1200,
              amount: 19_900,
              active: true,
            },
          ],
        },
      ])
      // A fresh read came right before the save
      expect(settings.length).toBeGreaterThan(reads + 1)
      expect(settings[settings.findIndex((call) => call.method === "POST") - 1]?.method).toBe("GET")
    })
  })
})
