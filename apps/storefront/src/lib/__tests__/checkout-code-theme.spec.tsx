// @vitest-environment jsdom
import { act } from "react"
import type { ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ActionResult, FormAction } from "@qticaret/ui"
import { t } from "@/lib/i18n"
// The theme's own parts: it exports pages, not these
import { promotionWords } from "../../../../../packages/themes/atolye/src/cart/code-words"
import { SummaryCode } from "../../../../../packages/themes/atolye/src/checkout/SummaryCode"

/**
 * The checkout's code field in its order summary (D6): closed by
 * default, open when the cart holds a code; the cart page's own field
 * inside, so a refused code stays in the box with its reason, a taken
 * one empties it, and each code on the cart comes off by its chip.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  host.remove()
})

function render(node: ReactNode) {
  act(() => {
    root.render(node)
  })
}

const words = promotionWords(t)
const noRemove = () => Promise.resolve()

const code = (
  apply: FormAction,
  codes: string[] = [],
  remove: (form: FormData) => Promise<void> = noRemove
) => <SummaryCode id="odeme-kod" codes={codes} apply={apply} remove={remove} words={words} />

const details = () => host.querySelector("details")
const field = () => host.querySelector<HTMLInputElement>('input[name="code"]')

async function apply(typed: string) {
  const input = field()
  if (!input) {
    throw new Error("No code field")
  }
  input.value = typed
  await act(async () => {
    host.querySelector<HTMLButtonElement>('button[type="submit"]:not([aria-label])')?.click()
    await Promise.resolve()
  })
}

const answering = (answer: ActionResult) => vi.fn<FormAction>(() => Promise.resolve(answer))

describe("the checkout summary's code field", () => {
  it("stays closed until asked, the steps keeping the eye", () => {
    render(code(answering({ ok: true, error: null })))
    expect(details()?.open).toBe(false)
    expect(host.querySelector("summary")?.textContent).toBe(words.label)
  })

  it("opens by itself when the cart already holds a code, the code ready to come off", () => {
    render(code(answering({ ok: true, error: null }), ["YAZ2026"]))
    expect(details()?.open).toBe(true)
    expect(host.querySelector(`[aria-label="${words.remove}: YAZ2026"]`)).not.toBeNull()
  })

  it("sends the code and empties the box once it is taken", async () => {
    const send = answering({ ok: true, error: null })
    render(code(send))
    await apply("YAZ2026")
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[1].get("code")).toBe("YAZ2026")
    expect(field()?.value).toBe("")
    expect(host.textContent).toContain(words.applied)
  })

  it("keeps a refused code in the box with the reason", async () => {
    render(code(answering({ ok: false, error: "cart.promotion_invalid" })))
    await apply("YAZ2O26")
    expect(field()?.value).toBe("YAZ2O26")
    expect(field()?.getAttribute("aria-invalid")).toBe("true")
    expect(host.textContent).toContain(t("cart.promotion_invalid"))
  })

  it("says a refusal it has no words for in the general one", async () => {
    render(code(answering({ ok: false, error: "promotions.something_new" })))
    await apply("YAZ2026")
    expect(field()?.value).toBe("YAZ2026")
    expect(host.textContent).toContain(words.fallback)
  })

  it("takes a code off by its chip and stays open once the last one is gone", async () => {
    const remove = vi.fn<(form: FormData) => Promise<void>>(() => Promise.resolve())
    const send = answering({ ok: true, error: null })
    render(code(send, ["YAZ2026"], remove))
    await act(async () => {
      host.querySelector<HTMLButtonElement>(`[aria-label="${words.remove}: YAZ2026"]`)?.click()
      await Promise.resolve()
    })
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove.mock.calls[0]?.[0].get("code")).toBe("YAZ2026")
    // The page comes back without the code: the field stays under the hand
    render(code(send, [], remove))
    expect(details()?.open).toBe(true)
    expect(field()).not.toBeNull()
  })
})
