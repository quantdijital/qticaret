import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { createMailpitTransport, createResendTransport, mailbox } from "../email"
import type { OutgoingEmail } from "../email"
import { maskRecipient, normalizeRecipient } from "../recipients"
import { MESSAGE_TEMPLATES, renderEmail } from "../templates"
import type { Brand } from "../templates"
import { messageText } from "../texts"

const brand: Brand = {
  shopName: "Örnek Mağaza",
  logoUrl: null,
  color: "#2f6feb",
  contactEmail: "destek@magaza.example",
  contactPhone: "+905321234567",
  storefrontUrl: null,
}

const orderPlaced = MESSAGE_TEMPLATES["order.placed"]
type OrderVars = typeof orderPlaced.sample

const emailOf = (vars: OrderVars) => {
  const render = orderPlaced.email
  if (!render) {
    throw new Error("order.placed has an e-mail")
  }
  return render(vars, brand)
}

describe("messages (adr/0036)", () => {
  it("escapes every value and draws a link for an http(s) address only", () => {
    const { html, text } = renderEmail(
      { ...brand, shopName: `<b>"Mağaza"</b>`, logoUrl: "javascript:alert(1)" },
      {
        subject: "Konu <script>",
        preheader: "Ön <img src=x onerror=alert(1)>",
        heading: "Merhaba <i>Ayşe</i>",
        blocks: [
          { kind: "paragraph", text: "a & b" },
          { kind: "button", label: "Aç", url: "javascript:alert(1)" },
          { kind: "button", label: "Siparişe git", url: "https://magaza.example/s/1" },
        ],
        footer: "Alt",
      }
    )

    expect(html).not.toMatch(/<script|<img src=x|<i>Ayşe|<b>"Mağaza|javascript:/)
    expect(html).toContain("Merhaba &lt;i&gt;Ayşe&lt;/i&gt;")
    expect(html).toContain("a &amp; b")
    expect(html).toContain('href="https://magaza.example/s/1"')
    expect(text).toContain("Siparişe git: https://magaza.example/s/1")
    expect(text).not.toContain("javascript:")
  })

  it("tells a bank transfer where to pay, a door payment what to hand over, a card nothing more", () => {
    const sample = orderPlaced.sample
    const bank = emailOf(sample)
    const door = emailOf({ ...sample, payment: "cash_on_delivery", bank: null })
    const card = emailOf({ ...sample, payment: "card", bank: null })

    expect(bank.subject).toBe("Siparişiniz alındı (#1042)")
    expect(bank.text).toContain("IBAN: TR00 0000 0000 0000 0000 0000 00")
    expect(bank.text).toContain("Açıklama: #1042")
    expect(door.text).toContain("kuryeye yapacaksınız")
    expect(card.text).not.toMatch(/IBAN|kurye/)
    expect(orderPlaced.sms?.(sample, brand)).toBe(
      "Örnek Mağaza: #1042 numaralı siparişiniz alındı. Toplam ₺389,80. Teşekkür ederiz."
    )
  })

  it("writes a sender's name as one header word", () => {
    expect(mailbox({ email: "a@b.example", name: 'Ayşe "Usta"\r\nBcc: x@y.example' })).toBe(
      '"Ayşe \\"Usta\\" Bcc: x@y.example" <a@b.example>'
    )
    expect(mailbox({ email: "a@b.example", name: "  " })).toBe("a@b.example")
  })

  it("keeps one spelling per address and shows only a hint of it", () => {
    expect(normalizeRecipient("email", " Ayse@Example.COM ")).toBe("ayse@example.com")
    expect(normalizeRecipient("email", "not-an-address")).toBeNull()
    expect(normalizeRecipient("sms", "0532 123 45 67")).toBe("+905321234567")
    expect(maskRecipient("email", "ayse@example.com")).toBe("ay***@example.com")
    expect(maskRecipient("sms", "+905321234567")).toBe("+905*** *** ** 67")
    expect(() => messageText("does.not_exist")).toThrow("does.not_exist")
  })
})

describe("e-mail transports (adr/0036)", () => {
  let fake: FakeMail
  const email: OutgoingEmail = {
    from: { email: "bildirim@platform.example", name: "Örnek Mağaza" },
    to: "ayse@example.com",
    replyTo: "destek@magaza.example",
    subject: "Konu",
    html: "<p>Merhaba</p>",
    text: "Merhaba",
    template: "order.placed",
    idempotencyKey: "order.placed:email:order_1",
  }

  beforeAll(async () => {
    fake = await startFakeMail()
  })

  afterAll(async () => {
    await fake.close()
  })

  beforeEach(() => {
    fake.messages.length = 0
  })

  it("sends through Resend with its key, once per idempotency key", async () => {
    const resend = createResendTransport(fake.apiKey, { baseUrl: fake.url })

    const first = await resend.send(email)
    const again = await resend.send(email)
    const refused = await createResendTransport("re_yanlis_anahtar_000", { baseUrl: fake.url })
      .send(email)
      .catch((error: unknown) => error)

    expect(again.id).toBe(first.id)
    expect(fake.messages).toHaveLength(1)
    expect(fake.messages[0]).toMatchObject({
      from: '"Örnek Mağaza" <bildirim@platform.example>',
      to: ["ayse@example.com"],
      replyTo: ["destek@magaza.example"],
      template: "order_placed",
    })
    expect(refused).toMatchObject({ providerCode: "missing_api_key" })
  })

  it("sends through Mailpit's HTTP endpoint", async () => {
    const { id } = await createMailpitTransport(fake.url).send(email)

    expect(id).toEqual(expect.any(String))
    expect(fake.messages[0]).toMatchObject({
      from: "bildirim@platform.example",
      subject: "Konu",
      text: "Merhaba",
      template: "order.placed",
    })
  })
})
