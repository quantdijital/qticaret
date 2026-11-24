// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlaceOrderResult } from "@qticaret/ui"
import { TurnstileProvider } from "@qticaret/ui/hooks/use-turnstile"
import { t } from "@/lib/i18n"
// The theme's own parts: it exports pages, not these
import { NewsletterForm } from "../../../../../packages/themes/atolye/src/frame/NewsletterForm"
import { newsletterWords } from "../../../../../packages/themes/atolye/src/frame/newsletter-words"

/**
 * The Grafit theme's forms behind Turnstile (adr/0044 Ek 2026-11-24): a
 * past-the-limit gate draws and loads nothing until the backend asks, then
 * sends the form once more with a token.
 * Cloudflare's API is faked.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let host: HTMLDivElement
let made = 0
let rendered: Record<string, unknown>[] = []

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  made = 0
  rendered = []
  window.turnstile = {
    render: vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
      rendered.push(options)
      return `w${String(rendered.length)}`
    }),
    execute: vi.fn(() => {
      made += 1
      const callback = rendered.at(-1)?.["callback"] as (token: string) => void
      queueMicrotask(() => {
        callback(`tok-${String(made)}`)
      })
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  }
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
  delete window.turnstile
})

const setup = {
  siteKey: "1x00000000000000000000AA",
  label: t("turnstile.label"),
  hint: t("turnstile.hint"),
}

async function settle() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

describe("Turnstile in the Grafit theme's forms", () => {
  it("the newsletter box answers the backend's 428 with a token and sends once more", async () => {
    const sent: Record<string, FormDataEntryValue>[] = []
    const answers: PlaceOrderResult[] = [
      {
        ok: false,
        error: null,
        challenge: null,
        turnstile: { action: "newsletter", failed: false },
      },
      { ok: true, error: null, challenge: null },
    ]
    // What each send carried, as it was sent (the token leaves the form after it)
    const action = vi.fn((_state: PlaceOrderResult, form: FormData) => {
      sent.push(Object.fromEntries(form.entries()))
      return Promise.resolve(answers.shift() ?? { ok: true, error: null, challenge: null })
    })
    act(() => {
      root.render(
        <TurnstileProvider setup={setup}>
          <NewsletterForm
            id="bulten"
            action={action}
            privacyPath={null}
            words={newsletterWords(t, "Onay metni")}
          />
        </TurnstileProvider>
      )
    })
    // Nothing of Cloudflare's before the backend asks
    expect(host.querySelector("[data-turnstile]")).toBeNull()

    const form = host.querySelector("form")
    const email = host.querySelector<HTMLInputElement>("input[type=email]")
    if (!form || !email) {
      throw new Error("no form")
    }
    email.value = "ayse@example.com"
    const consent = host.querySelector<HTMLInputElement>('input[name="consent"]')
    if (consent) {
      consent.checked = true
    }
    act(() => {
      form.requestSubmit()
    })
    await settle()

    expect(action).toHaveBeenCalledTimes(2)
    expect(sent[0]?.["turnstile"]).toBeUndefined()
    expect(sent[1]?.["turnstile"]).toBe("tok-1")
    expect(rendered[0]).toMatchObject({ action: "newsletter", appearance: "interaction-only" })
    expect(host.querySelector('[role="status"]')?.textContent).toBe(t("newsletter.sent"))
  })
})
