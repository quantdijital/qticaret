import { randomBytes } from "node:crypto"
import { fakeVkn, seededRandom, startFakeParasut } from "@qticaret/testing"
import type { FakeParasut } from "@qticaret/testing"
import { createMemoryStore } from "../../../security/rate-limit"
import { isProviderError } from "../../../errors"
import {
  createParasutApi,
  createParasutOauth,
  downloadParasutPdf,
  parasutAuthorizeUrl,
  parasutThrottle,
} from ".."
import type { ParasutApi } from ".."

const codeOf = async (run: Promise<unknown>): Promise<string> => {
  try {
    await run
  } catch (error) {
    return isProviderError(error) ? error.providerCode : String(error)
  }
  return "no error"
}

// Random each run: no client secret is ever written into a test
const client = {
  clientId: "test-parasut",
  clientSecret: randomBytes(16).toString("hex"),
}
const user = { username: "test@example.com", password: randomBytes(16).toString("hex") }
const fast = { timeoutMs: 1000, retry: { baseDelayMs: 1 }, sleep: () => Promise.resolve() }

const invoice = {
  attributes: { item_type: "invoice", issue_date: "2026-10-31", currency: "TRL" },
  relationships: {
    details: {
      data: [
        {
          type: "sales_invoice_details",
          attributes: {
            quantity: 3,
            unit_price: "83.3333",
            vat_rate: 20,
            discount_type: "amount",
            discount_value: "0",
          },
        },
      ],
    },
  },
}

describe("Paraşüt client against the fake server (adr/0034)", () => {
  let fake: FakeParasut
  let api: ParasutApi
  let token: string
  const oauth = () => createParasutOauth({ ...fast, origin: fake.url })

  beforeEach(async () => {
    fake = await startFakeParasut(client, user)
    api = createParasutApi(fake.companyId, { ...fast, origin: fake.url })
    token = (await oauth().exchangeCode(client, fake.issueCode())).accessToken
  })

  afterEach(async () => {
    await fake.close()
  })

  it("trades a pasted code once, and each refresh token once", async () => {
    const code = fake.issueCode()
    const first = await oauth().exchangeCode(client, code)
    const again = await codeOf(oauth().exchangeCode(client, code))
    const renewed = await oauth().refresh(client, first.refreshToken)
    const stale = await codeOf(oauth().refresh(client, first.refreshToken))

    expect(first.expiresAt.getTime()).toBeGreaterThan(Date.now() + 7000_000)
    expect(again).toBe("invalid_grant")
    expect(renewed.refreshToken).not.toBe(first.refreshToken)
    expect(stale).toBe("invalid_grant")
    expect(parasutAuthorizeUrl(client, fake.url)).toBe(
      `${fake.url}/oauth/authorize?client_id=test-parasut&redirect_uri=urn%3Aietf%3Awg%3Aoauth%3A2.0%3Aoob&response_type=code`
    )
  })

  it("issues an e-Arşiv for a buyer without an inbox, step by step to its PDF", async () => {
    const contact = await api.createContact(token, {
      name: "Ayşe Yılmaz",
      contact_type: "person",
      account_type: "customer",
      tax_number: "11111111111",
    })
    const created = await api.createSalesInvoice(token, {
      ...invoice,
      relationships: {
        ...invoice.relationships,
        contact: { data: { id: contact, type: "contacts" } },
      },
    })
    const inbox = await api.inboxOf(token, "11111111111")
    const job = await api.startEDocument(token, "e_archives", created.id, {
      internet_sale: {
        url: "https://ornek.com",
        payment_type: "KREDIKARTI/BANKAKARTI",
        payment_platform: "PayTR",
        payment_date: "2026-10-31",
      },
    })
    const steps = [await api.readJob(token, job), await api.readJob(token, job)]
    const read = await api.readSalesInvoice(token, created.id)
    const document = read.document
    if (!document) {
      throw new Error("no e-document")
    }
    const links = [
      await api.pdfLink(token, document.type, document.id),
      await api.pdfLink(token, document.type, document.id),
    ]

    expect(await api.findContact(token, { taxNumber: "11111111111" })).toBe(contact)
    expect(created.gross_total).toBe("300.00")
    expect(inbox).toBeNull()
    expect(steps.map((step) => step.status)).toEqual(["running", "done"])
    expect(document.type).toBe("e_archives")
    expect(document.invoice_number).toMatch(/^SHT\d{13}$/)
    expect(document.cancellable_until).toBeTruthy()
    expect(links[0]).toBeNull()
    expect((await downloadParasutPdf(links[1] ?? "", fake.url)).subarray(0, 5).toString()).toBe(
      "%PDF-"
    )
  })

  it("issues an e-Fatura to an inbox, and says why a job failed", async () => {
    const vkn = fakeVkn(seededRandom(5))
    fake.inboxes.add(vkn)
    const created = await api.createSalesInvoice(token, invoice)
    const address = await api.inboxOf(token, vkn)
    fake.failNextJob(["Alıcı posta kutusu yanıt vermedi"])
    const job = await api.startEDocument(token, "e_invoices", created.id, {
      scenario: "basic",
      to: address,
    })
    await api.readJob(token, job)

    expect(address).toBe(`urn:mail:${vkn}@sahte.parasut`)
    expect(await api.readJob(token, job)).toEqual({
      status: "error",
      errors: ["Alıcı posta kutusu yanıt vermedi"],
    })
    expect(fake.requests.at(-3)?.body).toMatchObject({
      data: { relationships: { invoice: { data: { id: created.id } } } },
    })
  })

  it("deletes an invoice no e-document was made of, and names a refusal by its title", async () => {
    const created = await api.createSalesInvoice(token, invoice)
    await api.deleteSalesInvoice(token, created.id)

    expect(await codeOf(api.readSalesInvoice(token, created.id))).toBe("not_found")
    expect(await codeOf(api.createSalesInvoice(token, { attributes: {}, relationships: {} }))).toBe(
      "validation_failed"
    )
    fake.expireTokens()
    expect(await codeOf(api.inboxOf(token, "1"))).toBe("unauthorized")
  })

  it("waits its turn past five requests in a ten-second window, all processes in one", async () => {
    let clock = 0
    const store = createMemoryStore(() => clock)
    const waits: number[] = []
    const throttle = parasutThrottle(store, fake.companyId, (ms) => {
      waits.push(ms)
      clock += ms
      return Promise.resolve()
    })
    for (let n = 0; n < 5; n++) {
      await throttle()
    }
    const before = waits.length
    await throttle()

    expect(before).toBe(0)
    expect(waits).toEqual([10_050])
  })

  it("gives the turn up when the window never opens, for the caller to try later", async () => {
    const store = createMemoryStore(() => 0)
    const throttle = parasutThrottle(store, fake.companyId, () => Promise.resolve())
    for (let n = 0; n < 5; n++) {
      await throttle()
    }

    await expect(throttle()).rejects.toThrow("einvoice.rate_limited")
  })
})
