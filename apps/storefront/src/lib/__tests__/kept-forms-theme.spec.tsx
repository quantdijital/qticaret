// @vitest-environment jsdom
import { act } from "react"
import type { ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ActionResult, CartLineView, FormAction } from "@qticaret/ui"
import { PAINTLESS_WAIT_MS } from "@qticaret/ui/lib/after-paint"
import { t } from "@/lib/i18n"
// The forms themselves: the themes export pages, not their parts
import { CodeForm } from "../../../../../packages/themes/atolye/src/cart/CodeForm"
import { GiftRecipient } from "../../../../../packages/themes/atolye/src/cart/GiftRecipient"
import { QuestionForm, ReviewForm } from "../../../../../packages/themes/atolye/src/product/Forms"
import { communityWords } from "../../../../../packages/themes/atolye/src/product/words"

/**
 * A refused review, question or code keeps what the shopper typed
 * (React 19 empties a form whose action is a function once it settles,
 * refused or not); an accepted one gives way to its thanks or empties.
 */

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** A form's action starts once the press's frame is drawn (`afterPaint`): long enough for that. */
const painted = () => new Promise((resolve) => setTimeout(resolve, PAINTLESS_WAIT_MS + 20))

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

/** A field by selector; read as an input, which every field here answers to. */
const el = (selector: string): HTMLInputElement => {
  const found = host.querySelector<HTMLInputElement>(selector)
  if (!found) {
    throw new Error(`No ${selector}`)
  }
  return found
}

const fill = (selector: string, value: string) => {
  el(selector).value = value
}

const value = (selector: string) => el(selector).value

async function send() {
  await act(async () => {
    el('button[type="submit"]').click()
    await painted()
  })
}

const refusing = (error: string) =>
  vi.fn<FormAction>(() => Promise.resolve({ ok: false, error } satisfies ActionResult))
const accepting = () => vi.fn<FormAction>(() => Promise.resolve({ ok: true, error: null }))

const words = communityWords(t)
const review = (write: FormAction) => (
  <ReviewForm
    productId="prod_1"
    write={write}
    words={words}
    placeholders={{ title: "Başlık", body: "Yorum" }}
  />
)
const question = (ask: FormAction) => (
  <QuestionForm productId="prod_1" ask={ask} words={words} placeholder="Sorunuz" />
)

describe("the product page's review form", () => {
  it("keeps the stars, the title and the text when the review is refused, and says why", async () => {
    const write = refusing("errors.too_many_requests")
    render(review(write))
    el('[name="rating"][value="2"]').checked = true
    fill('[name="title"]', "Sapı kaydı")
    fill('[name="body"]', "Birkaç kullanımdan sonra sapı gevşedi.")
    await send()

    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0]?.[1].get("body")).toBe("Birkaç kullanımdan sonra sapı gevşedi.")
    expect(el('[name="rating"]:checked').value).toBe("2")
    expect(value('[name="title"]')).toBe("Sapı kaydı")
    expect(value('[name="body"]')).toBe("Birkaç kullanımdan sonra sapı gevşedi.")
    expect(host.textContent).toContain(words.errors["errors.too_many_requests"])
  })

  it("keeps them through a refusal it has no words for, with the general one", async () => {
    render(review(refusing("product.review_failed_somehow")))
    fill('[name="body"]', "Kutusundan çıktığı gibi kağıt kesiyor.")
    await send()
    expect(value('[name="body"]')).toBe("Kutusundan çıktığı gibi kağıt kesiyor.")
    expect(host.textContent).toContain(words.reviewFailed)
  })

  it("gives way to its thanks once the shop has it", async () => {
    render(review(accepting()))
    fill('[name="body"]', "Kutusundan çıktığı gibi kağıt kesiyor.")
    await send()
    expect(host.querySelector("form")).toBeNull()
    expect(host.textContent).toContain(words.reviewSent)
  })
})

describe("the product page's question form", () => {
  it("keeps the question when it is refused", async () => {
    render(question(refusing("product.sign_in_first")))
    fill('[name="body"]', "Kılıfı ayrıca satılıyor mu?")
    await send()
    expect(value('[name="body"]')).toBe("Kılıfı ayrıca satılıyor mu?")
    expect(host.textContent).toContain(words.errors["product.sign_in_first"])
  })

  it("gives way to its thanks once sent", async () => {
    render(question(accepting()))
    fill('[name="body"]', "Kılıfı ayrıca satılıyor mu?")
    await send()
    expect(host.querySelector("form")).toBeNull()
    expect(host.textContent).toContain(words.questionSent)
  })
})

describe("the cart's code field", () => {
  const code = (apply: FormAction) => (
    <CodeForm
      id="kupon"
      codes={[]}
      apply={apply}
      remove={() => Promise.resolve()}
      words={{
        label: "Kampanya kodu",
        placeholder: "Kodunuz",
        apply: "Uygula",
        remove: "Kaldır",
        applied: "Kod uygulandı",
        errors: { "cart.promotion_invalid": "Bu kod geçerli değil" },
        fallback: "Kod uygulanamadı",
      }}
    />
  )

  it("keeps a refused code to be put right", async () => {
    render(code(refusing("cart.promotion_invalid")))
    fill('[name="code"]', "YAZ2O26")
    await send()
    expect(value('[name="code"]')).toBe("YAZ2O26")
    expect(host.textContent).toContain("Bu kod geçerli değil")
  })

  it("empties once the code is taken", async () => {
    render(code(accepting()))
    fill('[name="code"]', "YAZ2026")
    await send()
    expect(value('[name="code"]')).toBe("")
    expect(host.textContent).toContain("Kod uygulandı")
  })
})

describe("a gift card's recipient in the cart", () => {
  it("sends the plain form and leaves what was typed in place", async () => {
    const save = vi.fn<(form: FormData) => Promise<void>>(() => Promise.resolve())
    render(
      <GiftRecipient
        line={{ id: "line_1" } as CartLineView}
        gift={{ recipient: null }}
        save={save}
        t={t}
      />
    )
    fill('[name="recipient_email"]', "ayse@example.com")
    fill('[name="message"]', "İyi ki doğdun")
    await send()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]?.[0].get("recipient_email")).toBe("ayse@example.com")
    expect(value('[name="recipient_email"]')).toBe("ayse@example.com")
    expect(value('[name="message"]')).toBe("İyi ki doğdun")
  })
})
